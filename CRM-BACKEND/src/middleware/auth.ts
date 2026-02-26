// Disabled require-await rule for this file as some middleware functions are async for consistency
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import type { JwtPayload } from '@/types/auth';
import type { ApiResponse } from '@/types/api';
import { logger } from '@/config/logger';
import { query } from '@/config/database';
import {
  hasSystemScopeBypass,
  isFieldExecutionActor,
  getPrimaryRoleNameFromRbac,
  isScopedOperationsUser,
} from '@/security/rbacAccess';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    permissionCodes?: string[];
    capabilities?: {
      systemScopeBypass: boolean;
      operationalScope: boolean;
      executionActor: boolean;
    };
    assignedClientIds?: number[];
    assignedProductIds?: number[];
    roles?: string[];
    primaryRole?: string;
    teamLeaderId?: string | null;
    managerId?: string | null;
    deviceId?: string;
  };
}

type DbUserAuthContext = {
  id: string;
  permissionCodes: string[];
  assignedClientIds: number[];
  assignedProductIds: number[];
  roles: string[];
  teamLeaderId: string | null;
  managerId: string | null;
};

export const loadUserAuthContext = async (userId: string): Promise<DbUserAuthContext | null> => {
  const userResult = await query<{
    id: string;
    permissionCodes: string[] | null;
    assignedClientIds: number[] | null;
    assignedProductIds: number[] | null;
    roles: string[] | null;
    teamLeaderId: string | null;
    managerId: string | null;
  }>(
    `
      SELECT
        u.id,
        COALESCE((
          SELECT array_agg(DISTINCT p.code)
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::varchar[]) as "permissionCodes",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT uca."clientId" ORDER BY uca."clientId")
          FROM "userClientAssignments" uca
          WHERE uca."userId" = u.id
        ), ARRAY[]::int[]) as "assignedClientIds",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT upa."productId" ORDER BY upa."productId")
          FROM "userProductAssignments" upa
          WHERE upa."userId" = u.id
        ), ARRAY[]::int[]) as "assignedProductIds",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT rv.name ORDER BY rv.name)
          FROM user_roles ur
          JOIN roles_v2 rv ON rv.id = ur.role_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::varchar[]) as roles,
        u.team_leader_id as "teamLeaderId",
        u.manager_id as "managerId"
      FROM users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  const row = userResult.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    permissionCodes: row.permissionCodes || [],
    assignedClientIds: row.assignedClientIds || [],
    assignedProductIds: row.assignedProductIds || [],
    roles: row.roles || [],
    teamLeaderId: row.teamLeaderId ?? null,
    managerId: row.managerId ?? null,
  };
};

const buildRequestCapabilities = (
  ctx: DbUserAuthContext
): NonNullable<AuthenticatedRequest['user']>['capabilities'] => {
  const userLike: NonNullable<AuthenticatedRequest['user']> = {
    id: ctx.id,
    permissionCodes: ctx.permissionCodes,
    assignedClientIds: ctx.assignedClientIds,
    assignedProductIds: ctx.assignedProductIds,
    roles: ctx.roles,
    primaryRole: getPrimaryRoleNameFromRbac(ctx.roles),
    teamLeaderId: ctx.teamLeaderId,
    managerId: ctx.managerId,
  };

  return {
    systemScopeBypass: hasSystemScopeBypass(userLike),
    operationalScope: isScopedOperationsUser(userLike),
    executionActor: isFieldExecutionActor(userLike),
  };
};

const verifyTokenAndSetUser = (
  token: string,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    void (async () => {
      const userContext = await loadUserAuthContext(decoded.userId);
      if (!userContext) {
        res.status(401).json({
          success: false,
          message: 'User not found',
          error: { code: 'UNAUTHORIZED' },
        });
        return;
      }

      req.user = {
        id: userContext.id,
        permissionCodes: userContext.permissionCodes,
        capabilities: buildRequestCapabilities(userContext),
        assignedClientIds: userContext.assignedClientIds,
        assignedProductIds: userContext.assignedProductIds,
        roles: userContext.roles,
        primaryRole: getPrimaryRoleNameFromRbac(userContext.roles),
        teamLeaderId: userContext.teamLeaderId,
        managerId: userContext.managerId,
        ...(decoded.deviceId && { deviceId: decoded.deviceId }),
      };
      next();
    })().catch(error => {
      logger.error('Failed to load authenticated user context:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load user context',
        error: { code: 'AUTH_CONTEXT_LOAD_ERROR' },
      });
    });
  } catch (error) {
    logger.error('Token verification failed:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Invalid or expired token',
      error: {
        code: 'INVALID_TOKEN',
      },
    };
    res.status(401).json(response);
  }
};

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const rawAuthHeader = req.headers.authorization;
  const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
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

  verifyTokenAndSetUser(token, req, res, next);
};

// Flexible authentication that supports both header and query parameter
export const authenticateTokenFlexible = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Try Authorization header first
  const rawAuthHeader = req.headers.authorization;
  const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // If no header token, try query parameter (for image serving)
  if (!token) {
    token = req.query.token as string;
  }

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

  verifyTokenAndSetUser(token, req, res, next);
};

export const requireRole = (_allowedRoles: unknown[]) => {
  return (req: AuthenticatedRequest, res: Response, _next: NextFunction): void => {
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

    res.status(403).json({
      success: false,
      message: 'Legacy role middleware is disabled. Use authorize(permission).',
      error: { code: 'FORBIDDEN' },
    });
  };
};

export const requireAdmin = requireRole([]);
export const requireBackendOrAdmin = requireRole([]);
export const requireFieldOrHigher = requireRole([]);

// Enhanced auth middleware that loads user permissions
export const auth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    // First run the basic token authentication
    authenticateToken(req, res, () => {
      void (async () => {
        if (!req.user) {
          return; // authenticateToken already handled the response
        }

        try {
          const userData = await loadUserAuthContext(req.user.id);
          if (userData) {
            req.user.permissionCodes = userData.permissionCodes;
            req.user.capabilities = buildRequestCapabilities(userData);
            req.user.assignedClientIds = userData.assignedClientIds;
            req.user.assignedProductIds = userData.assignedProductIds;
            req.user.roles = userData.roles;
            req.user.primaryRole = getPrimaryRoleNameFromRbac(userData.roles);
            req.user.teamLeaderId = userData.teamLeaderId;
            req.user.managerId = userData.managerId;
          }

          next();
        } catch (error) {
          logger.error('Error loading user permissions:', error);
          const response: ApiResponse = {
            success: false,
            message: 'Failed to load user permissions',
            error: { code: 'PERMISSION_LOAD_ERROR' },
          };
          res.status(500).json(response);
        }
      })().catch(error => {
        logger.error('Auth middleware inner error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: { code: 'INTERNAL_ERROR' },
        });
      });
    });
  } catch (error) {
    logger.error('Auth middleware error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Authentication failed',
      error: { code: 'AUTH_ERROR' },
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
        error: { code: 'UNAUTHORIZED' },
      };
      res.status(401).json(response);
      return;
    }

    const permissionCode = `${resource}.${action}`;
    const permissionCodes = req.user.permissionCodes || [];
    const hasCode = permissionCodes.includes('*') || permissionCodes.includes(permissionCode);

    if (!hasCode) {
      const response: ApiResponse = {
        success: false,
        message: 'Insufficient permissions',
        error: {
          code: 'FORBIDDEN',
          details: {
            requiredPermission: permissionCode,
            userPermissionCodes: permissionCodes,
          },
        },
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};
