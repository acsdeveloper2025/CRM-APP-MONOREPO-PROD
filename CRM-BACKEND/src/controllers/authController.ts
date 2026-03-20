import type { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '@/config/database';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { createError } from '@/middleware/errorHandler';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { createAuditLog } from '@/utils/auditLogger';
import type { LoginRequest, LoginResponse, JwtPayload, RefreshTokenPayload } from '@/types/auth';
import type { ApiResponse } from '@/types/api';
import {
  getPrimaryRoleNameFromRbac,
  isFieldExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';

export const login = async (req: Request, res: Response): Promise<void> => {
  // eslint-disable-next-line no-useless-catch
  try {
    const { username, password }: LoginRequest = req.body;

    // Find user by username
    const userRes = await query(
      `SELECT u.id, u.name, u.username, u.email, u."passwordHash", u."roleId", u."employeeId", u.designation, u.department, u."profilePhotoUrl"
       FROM users u
       WHERE u.username = $1`,
      [username]
    );
    const user = userRes.rows[0];

    if (!user) {
      await createAuditLog({
        action: 'WEB_LOGIN_FAILED',
        entityType: 'USER',
        details: { reason: 'USER_NOT_FOUND', attemptedUsername: username },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || undefined,
      });
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await createAuditLog({
        action: 'WEB_LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        userId: user.id,
        details: { reason: 'INVALID_PASSWORD' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || undefined,
      });
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Simplified authentication - only username and password required
    const rbacRes = await query<{ roles: string[] | null; permissions: string[] | null }>(
      `SELECT
         COALESCE((
           SELECT array_agg(DISTINCT rv2.name)
           FROM user_roles ur
           JOIN roles_v2 rv2 ON rv2.id = ur.role_id
           WHERE ur.user_id = $1
         ), ARRAY[]::varchar[]) as roles,
         COALESCE((
           SELECT array_agg(DISTINCT p.code)
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = $1
         ), ARRAY[]::varchar[]) as permissions`,
      [user.id]
    );
    const rbacRoles = rbacRes.rows[0]?.roles || [];
    const rbacPermissionCodes = rbacRes.rows[0]?.permissions || [];
    const derivedRole = getPrimaryRoleNameFromRbac(rbacRoles) || null;
    const authProfile = {
      permissionCodes: rbacPermissionCodes,
    } as unknown as AuthenticatedRequest['user'];

    // Generate tokens
    const accessTokenPayload: JwtPayload = {
      userId: user.id,
      authMethod: 'PASSWORD', // Mark as password authentication
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      userId: user.id,
      authMethod: 'PASSWORD', // Mark as password authentication
    };

    const accessToken = jwt.sign(accessTokenPayload, config.jwtSecret, {
      expiresIn: '24h',
    });

    const refreshToken = jwt.sign(refreshTokenPayload, config.jwtRefreshSecret, {
      expiresIn: '7d',
    });

    // Store refresh token hash
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
      `INSERT INTO "refreshTokens" (token, "userId", "expiresAt", "createdAt", "ipAddress", "userAgent") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)`,
      [tokenHash, user.id, expiresAt, req.ip, req.get('User-Agent') || null]
    );

    // Update user's lastLogin timestamp
    await query(`UPDATE users SET "lastLogin" = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

    // Fetch role-based assignments for BACKEND_USER and FIELD_AGENT users
    let assignedClients: number[] = [];
    let assignedProducts: number[] = [];
    let assignedPincodes: number[] = [];
    let assignedAreas: number[] = [];

    if (isScopedOperationsUser(authProfile)) {
      // Fetch assigned clients
      const clientsRes = await query(
        'SELECT "clientId" FROM "userClientAssignments" WHERE "userId" = $1',
        [user.id]
      );
      assignedClients = clientsRes.rows.map(row => row.clientId);

      // Fetch assigned products
      const productsRes = await query(
        'SELECT "productId" FROM "userProductAssignments" WHERE "userId" = $1',
        [user.id]
      );
      assignedProducts = productsRes.rows.map(row => row.productId);
    } else if (isFieldExecutionActor(authProfile)) {
      // Fetch assigned pincodes
      const pincodesRes = await query(
        'SELECT "pincodeId" FROM "userPincodeAssignments" WHERE "userId" = $1 AND "isActive" = true',
        [user.id]
      );
      assignedPincodes = pincodesRes.rows.map(row => row.pincodeId);

      // Fetch assigned areas
      const areasRes = await query(
        'SELECT "areaId" FROM "userAreaAssignments" WHERE "userId" = $1 AND "isActive" = true',
        [user.id]
      );
      assignedAreas = areasRes.rows.map(row => row.areaId);
    }

    // Audit success
    await createAuditLog({
      action: 'WEB_LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.id,
      userId: user.id,
      details: { role: derivedRole },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    const response: LoginResponse = {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: (derivedRole || 'BACKEND_USER') as LoginResponse['data']['user']['role'],
          employeeId: user.employeeId,
          designation: user.designation,
          department: user.department,
          ...(user.profilePhotoUrl && { profilePhotoUrl: user.profilePhotoUrl }),
          // Include role-based assignments
          ...(isScopedOperationsUser(authProfile) && {
            assignedClients,
            assignedProducts,
          }),
          ...(isFieldExecutionActor(authProfile) && {
            assignedPincodes,
            assignedAreas,
          }),
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    };

    res.json(response);
  } catch (error) {
    throw error;
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // eslint-disable-next-line no-useless-catch
  try {
    if (!req.user) {
      throw createError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // Log logout
    await query(
      `INSERT INTO "auditLogs" ("userId", action, "entityType", "newValues", "ipAddress", "userAgent", "createdAt")
       VALUES ($1, 'LOGOUT', 'USER', $2, $3, $4, CURRENT_TIMESTAMP)`,
      [req.user.id, JSON.stringify({}), req.ip, req.get('User-Agent')]
    );

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    logger.info(`User ${req.user.id} logged out successfully`);
    res.json(response);
  } catch (error) {
    throw error;
  }
};

// Pre-login info to enable dynamic login form (public)
export const preloginInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body as { username?: string };
    if (!username) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
        error: { code: 'MISSING_USERNAME' },
      });
      return;
    }

    const userRes = await query(
      `SELECT u.id, u."roleId"
       FROM users u
       WHERE u.username = $1
       LIMIT 1`,
      [username]
    );
    const user = userRes.rows[0];

    if (!user) {
      // Unknown user: return neutral flags (frontend can show both fields)
      res.json({
        success: true,
        message: 'OK',
        data: { unknown: true, requiresDeviceId: false, requiresMacAddress: false },
      });
      return;
    }

    res.json({
      success: true,
      message: 'OK',
      data: {
        role: null,
        roleName: null,
        requiresDeviceId: false,
        requiresMacAddress: false,
      },
    });
  } catch (_error) {
    res
      .status(500)
      .json({ success: false, message: 'Internal error', error: { code: 'INTERNAL_ERROR' } });
  }
};

// Get current user information
export const getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
        error: { code: 'UNAUTHORIZED' },
      });
      return;
    }

    // Get user details with role and department information
    const userQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u."roleId",
        u."departmentId",
        u."employeeId",
        u.designation,
        u.department,
        u."profilePhotoUrl",
        u."isActive",
        u."lastLogin",
        u."createdAt",
        d.name as "departmentName"
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      WHERE u.id = $1
    `;

    const result = await query(userQuery, [req.user.id]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' },
      });
      return;
    }

    const userData = result.rows[0];
    let rbacRoles: string[] = [];
    let rbacPermissionCodes: string[] = [];
    const rbacRes = await query<{ roles: string[] | null; permissions: string[] | null }>(
      `SELECT
         COALESCE((
           SELECT array_agg(DISTINCT rv2.name)
           FROM user_roles ur
           JOIN roles_v2 rv2 ON rv2.id = ur.role_id
           WHERE ur.user_id = u.id
         ), ARRAY[]::varchar[]) as roles,
         COALESCE((
           SELECT array_agg(DISTINCT p.code)
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = u.id
         ), ARRAY[]::varchar[]) as permissions
       FROM users u
       WHERE u.id = $1`,
      [userData.id]
    );
    rbacRoles = rbacRes.rows[0]?.roles || [];
    rbacPermissionCodes = rbacRes.rows[0]?.permissions || [];
    const derivedRole = getPrimaryRoleNameFromRbac(rbacRoles) || null;
    const authProfile = {
      permissionCodes: rbacPermissionCodes,
    } as unknown as AuthenticatedRequest['user'];

    // Fetch role-based assignments for BACKEND_USER and FIELD_AGENT users
    let assignedClients: number[] = [];
    let assignedProducts: number[] = [];
    let assignedPincodes: number[] = [];
    let assignedAreas: number[] = [];

    if (isScopedOperationsUser(authProfile)) {
      // Fetch assigned clients
      const clientsRes = await query(
        'SELECT "clientId" FROM "userClientAssignments" WHERE "userId" = $1',
        [userData.id]
      );
      assignedClients = clientsRes.rows.map(row => row.clientId);

      // Fetch assigned products
      const productsRes = await query(
        'SELECT "productId" FROM "userProductAssignments" WHERE "userId" = $1',
        [userData.id]
      );
      assignedProducts = productsRes.rows.map(row => row.productId);
    } else if (isFieldExecutionActor(authProfile)) {
      // Fetch assigned pincodes
      const pincodesRes = await query(
        'SELECT "pincodeId" FROM "userPincodeAssignments" WHERE "userId" = $1 AND "isActive" = true',
        [userData.id]
      );
      assignedPincodes = pincodesRes.rows.map(row => row.pincodeId);

      // Fetch assigned areas
      const areasRes = await query(
        'SELECT "areaId" FROM "userAreaAssignments" WHERE "userId" = $1 AND "isActive" = true',
        [userData.id]
      );
      assignedAreas = areasRes.rows.map(row => row.areaId);
    }

    const response: ApiResponse = {
      success: true,
      message: 'User information retrieved successfully',
      data: {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        email: userData.email,
        role: derivedRole,
        roleId: userData.roleId,
        roleName: derivedRole,
        roles: rbacRoles,
        permissions: rbacPermissionCodes,
        departmentId: userData.departmentId,
        departmentName: userData.departmentName,
        employeeId: userData.employeeId,
        designation: userData.designation,
        department: userData.department, // Legacy field
        profilePhotoUrl: userData.profilePhotoUrl,
        isActive: userData.isActive,
        lastLogin: userData.lastLogin,
        createdAt: userData.createdAt,
        // Include role-based assignments
        ...(isScopedOperationsUser(authProfile) && {
          assignedClients,
          assignedProducts,
        }),
        ...(isFieldExecutionActor(authProfile) && {
          assignedPincodes,
          assignedAreas,
        }),
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting current user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        error: { code: 'MISSING_TOKEN' },
      });
      return;
    }

    // Verify token signature
    let decoded: RefreshTokenPayload;
    try {
      decoded = jwt.verify(token, config.jwtRefreshSecret) as RefreshTokenPayload;
    } catch (_err) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token signature',
        error: { code: 'INVALID_TOKEN' },
      });
      return;
    }

    // Hash incoming token to find in DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Check DB for valid, non-expired token
    const result = await query(
      `SELECT * FROM "refreshTokens" WHERE token = $1 AND "userId" = $2 AND "expiresAt" > CURRENT_TIMESTAMP`,
      [tokenHash, decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        error: { code: 'INVALID_TOKEN' },
      });
      return;
    }

    // Fetch user to ensure they still exist and get current role
    const userRes = await query(`SELECT * FROM users WHERE id = $1`, [decoded.userId]);
    const user = userRes.rows[0];

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' },
      });
      return;
    }

    // Generate NEW access token
    const accessTokenPayload: JwtPayload = {
      userId: user.id,
      authMethod: 'PASSWORD',
    };

    const accessToken = jwt.sign(accessTokenPayload, config.jwtSecret, {
      expiresIn: '24h',
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
