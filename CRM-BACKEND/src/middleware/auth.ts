import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { JwtPayload, Role } from '@/types/auth';
import { ApiResponse } from '@/types/api';
import { logger } from '@/config/logger';
import { query } from '@/config/database';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: Role;
    roleId?: string;
    permissions?: any;
    deviceId?: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    const response: ApiResponse = {
      success: false,
      message: 'Access token required',
      error: {
        code: 'UNAUTHORIZED',
      },
    };
    res.status(401).json(response);
    return;
  }

  // Development bypass
  if (config.nodeEnv === 'development' && token === 'dev-token') {
    req.user = {
      id: '02dbbee4-37ed-48e1-b899-24bb21a87b5d', // Use actual admin user UUID
      username: 'admin',
      role: Role.ADMIN,
    };
    next();
    return;
  }

  // Development field agent bypass
  if (config.nodeEnv === 'development' && token === 'field-agent-token') {
    req.user = {
      id: '66ed9c1b-e02e-4769-b7d5-903bcc0a3ba9', // nikhil.parab's ID from debug script
      username: 'nikhil.parab',
      role: Role.FIELD_AGENT,
    };
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      ...(decoded.deviceId && { deviceId: decoded.deviceId }),
    };
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Invalid or expired token',
      error: {
        code: 'INVALID_TOKEN',
      },
    };
    res.status(403).json(response);
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: {
          code: 'UNAUTHORIZED',
        },
      };
      res.status(401).json(response);
      return;
    }

    // SUPER_ADMIN bypasses role checks
    if (req.user.role !== Role.SUPER_ADMIN && !allowedRoles.includes(req.user.role)) {
      const response: ApiResponse = {
        success: false,
        message: 'Insufficient permissions',
        error: {
          code: 'FORBIDDEN',
          details: {
            requiredRoles: allowedRoles,
            userRole: req.user.role,
          },
        },
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole([Role.ADMIN]);
export const requireBackendOrAdmin = requireRole([Role.ADMIN, Role.BACKEND_USER]);
export const requireFieldOrHigher = requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER, Role.FIELD_AGENT]);

// Enhanced auth middleware that loads user permissions
export const auth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // First run the basic token authentication
    authenticateToken(req, res, async () => {
      if (!req.user) {
        return; // authenticateToken already handled the response
      }

      try {
        // Load user's role and permissions from database
        const userQuery = `
          SELECT
            u.id,
            u.username,
            u.role,
            u."roleId",
            r.name as "roleName",
            r.permissions
          FROM users u
          LEFT JOIN roles r ON u."roleId" = r.id
          WHERE u.id = $1
        `;

        const result = await query(userQuery, [req.user.id]);

        if (result.rows.length > 0) {
          const userData = result.rows[0];
          req.user.roleId = userData.roleId;
          req.user.permissions = userData.permissions || {};

          // If user has a roleId, use the database role permissions
          // Otherwise fall back to the legacy role system
          if (userData.roleId && userData.permissions) {
            req.user.permissions = userData.permissions;
          }
        }

        next();
      } catch (error) {
        logger.error('Error loading user permissions:', error);
        const response: ApiResponse = {
          success: false,
          message: 'Failed to load user permissions',
          error: { code: 'PERMISSION_LOAD_ERROR' }
        };
        res.status(500).json(response);
      }
    });
  } catch (error) {
    logger.error('Auth middleware error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Authentication failed',
      error: { code: 'AUTH_ERROR' }
    };
    res.status(500).json(response);
  }
};

// Permission-based access control middleware
export const requirePermission = (resource: string, action: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHORIZED' }
      };
      res.status(401).json(response);
      return;
    }

    // SUPER_ADMIN and ADMIN users have all permissions
    if (req.user.role === Role.SUPER_ADMIN || req.user.role === Role.ADMIN) {
      next();
      return;
    }

    // Check if user has the required permission
    const permissions = req.user.permissions || {};
    const resourcePermissions = permissions[resource];

    if (!resourcePermissions || !resourcePermissions[action]) {
      const response: ApiResponse = {
        success: false,
        message: 'Insufficient permissions',
        error: {
          code: 'FORBIDDEN',
          details: {
            requiredPermission: `${resource}.${action}`,
            userRole: req.user.role,
            userPermissions: permissions
          }
        }
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};
