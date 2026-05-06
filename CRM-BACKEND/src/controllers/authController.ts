import type { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '@/config/database';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { createError } from '@/middleware/errorHandler';
import { invalidateAuthContextCache, type AuthenticatedRequest } from '@/middleware/auth';
import { createAuditLog } from '@/utils/auditLogger';
import type { LoginRequest, LoginResponse, JwtPayload, RefreshTokenPayload } from '@/types/auth';
import type { ApiResponse } from '@/types/api';
import {
  getPrimaryRoleNameFromRbac,
  isFieldExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';

/**
 * Parse a duration string (e.g. '7d', '24h', '30m') to milliseconds.
 * Used to convert config JWT expiry strings into numeric values for DB storage.
 */
function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
  }
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Phase E5: HttpOnly refresh-token cookie helpers.
 *
 * The cookie is scoped to REFRESH_COOKIE_PATH so no other route ever
 * receives the token. Attributes:
 *   - httpOnly: JS can't read it (XSS-resistant)
 *   - secure:   only over HTTPS in production (dev keeps cleartext
 *               so localhost still works)
 *   - sameSite: 'strict' in prod to block cross-site CSRF; 'lax' in
 *               dev for the cross-origin Vite dev server
 *   - maxAge:   30 days, matching the jwtRefreshExpiresIn default
 */
const REFRESH_COOKIE_NAME = 'crm_refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth/refresh-token';

const setRefreshTokenCookie = (res: Response, token: string): void => {
  const isProd = config.nodeEnv === 'production';
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
  });
};

// Account lockout — 5 failed attempts per username in 15 minutes.
// Uses Redis for fast lookup + auto-expiry. Separate from IP-based
// rate limiting so an attacker can't bypass by switching IPs.
const LOGIN_LOCKOUT_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 minutes

const checkAccountLockout = async (
  username: string
): Promise<{ locked: boolean; attempts: number; retryAfterSeconds: number }> => {
  try {
    const { redisClient: redis } = await import('@/config/redis');
    if (!redis) {
      return { locked: false, attempts: 0, retryAfterSeconds: 0 };
    }
    const key = `login_lockout:${username.toLowerCase()}`;
    const raw = await redis.get(key);
    const attempts = parseInt(String(raw || '0'), 10);
    if (attempts >= LOGIN_LOCKOUT_MAX_ATTEMPTS) {
      const ttlRaw = await redis.ttl(key);
      const ttl = Number(ttlRaw);
      return {
        locked: true,
        attempts,
        retryAfterSeconds: ttl > 0 ? ttl : LOGIN_LOCKOUT_WINDOW_SECONDS,
      };
    }
    return { locked: false, attempts, retryAfterSeconds: 0 };
  } catch {
    // Redis down — fail open (don't block login)
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
};

const recordFailedLogin = async (username: string): Promise<void> => {
  try {
    const { redisClient: redis } = await import('@/config/redis');
    if (!redis) {
      return;
    }
    const key = `login_lockout:${username.toLowerCase()}`;
    const newCount = await redis.incr(key);
    if (newCount === 1) {
      await redis.expire(key, LOGIN_LOCKOUT_WINDOW_SECONDS);
    }
  } catch {
    // Redis down — silently skip
  }
};

const clearLoginLockout = async (username: string): Promise<void> => {
  try {
    const { redisClient: redis } = await import('@/config/redis');
    if (!redis) {
      return;
    }
    await redis.del(`login_lockout:${username.toLowerCase()}`);
  } catch {
    // Redis down — silently skip
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  // eslint-disable-next-line no-useless-catch
  try {
    const { username, password }: LoginRequest = req.body;

    // Account lockout check — per-username, not per-IP
    const lockout = await checkAccountLockout(username || '');
    if (lockout.locked) {
      logger.warn('Login blocked — account locked', {
        username,
        attempts: lockout.attempts,
        retryAfterSeconds: lockout.retryAfterSeconds,
        ip: req.ip,
      });
      res.status(429).json({
        success: false,
        message: `Account temporarily locked after ${LOGIN_LOCKOUT_MAX_ATTEMPTS} failed attempts. Try again in ${Math.ceil(lockout.retryAfterSeconds / 60)} minutes.`,
        error: {
          code: 'ACCOUNT_LOCKED',
          retryAfterSeconds: lockout.retryAfterSeconds,
        },
      });
      return;
    }

    // Find user by username
    const userRes = await query(
      `SELECT u.id, u.name, u.username, u.email, u.password_hash, u.employee_id, d.name as designation, dept.name as department, u.profile_photo_url, u.token_version
       FROM users u
       LEFT JOIN designations d ON d.id = u.designation_id
       LEFT JOIN departments dept ON dept.id = u.department_id
       WHERE u.username = $1`,
      [username]
    );
    const user = userRes.rows[0];

    if (!user) {
      await recordFailedLogin(username || '');
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
      await recordFailedLogin(username);
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

    // Login succeeded — clear lockout counter
    await clearLoginLockout(username);

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

    // Generate tokens. F-B3.4: embed tokenVersion so any future bump
    // (password change / logout-all) invalidates this token.
    const accessTokenPayload: JwtPayload = {
      userId: user.id,
      authMethod: 'PASSWORD', // Mark as password authentication
      tokenVersion: user.tokenVersion,
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      userId: user.id,
      authMethod: 'PASSWORD', // Mark as password authentication
      tokenVersion: user.tokenVersion,
      jti: crypto.randomUUID(),
    };

    const accessToken = jwt.sign(accessTokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as string & jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(refreshTokenPayload, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpiresIn as string & jwt.SignOptions['expiresIn'],
    });

    // Store refresh token hash — parse config duration for DB expiry
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + parseDurationMs(config.jwtRefreshExpiresIn));

    await query(
      `INSERT INTO refresh_tokens (token, user_id, expires_at, created_at, ip_address, user_agent) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)`,
      [tokenHash, user.id, expiresAt, req.ip, req.get('User-Agent') || null]
    );

    // Update user's lastLogin timestamp
    await query(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

    // Fetch role-based assignments for BACKEND_USER and FIELD_AGENT users
    let assignedClients: number[] = [];
    let assignedProducts: number[] = [];
    let assignedPincodes: number[] = [];
    let assignedAreas: number[] = [];

    if (isScopedOperationsUser(authProfile)) {
      // Fetch assigned clients
      const clientsRes = await query(
        'SELECT client_id FROM user_client_assignments WHERE user_id = $1',
        [user.id]
      );
      assignedClients = clientsRes.rows.map(row => row.clientId);

      // Fetch assigned products
      const productsRes = await query(
        'SELECT product_id FROM user_product_assignments WHERE user_id = $1',
        [user.id]
      );
      assignedProducts = productsRes.rows.map(row => row.productId);
    } else if (isFieldExecutionActor(authProfile)) {
      // Fetch assigned pincodes
      const pincodesRes = await query(
        'SELECT pincode_id FROM user_pincode_assignments WHERE user_id = $1 AND is_active = true',
        [user.id]
      );
      assignedPincodes = pincodesRes.rows.map(row => row.pincodeId);

      // Fetch assigned areas
      const areasRes = await query(
        'SELECT area_id FROM user_area_assignments WHERE user_id = $1 AND is_active = true',
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
          role: (derivedRole || 'BACKEND_USER') as NonNullable<
            LoginResponse['data']
          >['user']['role'],
          employeeId: user.employeeId,
          designation: user.designation,
          department: user.department,
          ...(user.profilePhotoUrl && { profilePhotoUrl: user.profilePhotoUrl }),
          // 2026-05-06: ship rbac perms + roles in the login response so the
          // FE has them before /auth/me refresh fires. Closes a race where
          // permission-gated UI (e.g. KYC dashboard cards) was hidden because
          // the post-login /auth/me refresh hadn't populated state yet.
          permissions: rbacPermissionCodes,
          roles: rbacRoles,
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

    // Phase E5: dual-write the refresh token to an HttpOnly cookie
    // in addition to the JSON body. The frontend can migrate to
    // cookie-only at its own pace; the mobile client keeps reading
    // from the body (cookies don't work the same on RN). Cookie
    // attributes:
    //   - httpOnly: JS can't read it (XSS-resistant)
    //   - secure: only over HTTPS in prod (dev keeps cleartext so
    //     localhost still works)
    //   - sameSite: 'strict' in prod to block cross-site CSRF;
    //     'lax' in dev for cross-origin Vite dev server
    //   - path: '/api/auth/refresh-token' so the cookie is only
    //     ever sent to the one endpoint that needs it
    //   - maxAge: matches refresh token TTL
    setRefreshTokenCookie(res, refreshToken);
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
      `INSERT INTO audit_logs (user_id, action, entity_type, new_values, ip_address, user_agent, created_at)
       VALUES ($1, 'LOGOUT', 'USER', $2, $3, $4, CURRENT_TIMESTAMP)`,
      [req.user.id, JSON.stringify({}), req.ip, req.get('User-Agent')]
    );

    // Invalidate ALL refresh tokens for this user — match mobile logout behavior.
    // Without this, an attacker holding a leaked refresh token could continue
    // exchanging it for new access tokens after the user "logged out".
    // 2026-04-28 F1.7.2: soft-delete via revoked_at to preserve forensic trail.
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'logout'
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [req.user.id]
    );

    // F-B3.4: bump tokenVersion so any in-flight access tokens are
    // rejected by verifyTokenAndSetUser on their next request.
    await query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [req.user.id]);
    invalidateAuthContextCache(req.user.id);

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    // Phase E5: also clear the HttpOnly refresh cookie so the
    // browser stops sending it on subsequent requests. Cookie path
    // must match the one used at set time.
    clearRefreshTokenCookie(res);

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
      `SELECT u.id
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
        u.department_id,
        u.employee_id,
        desig.name as designation,
        d.name as department,
        u.profile_photo_url,
        u.is_active,
        u.last_login,
        u.created_at,
        d.name as "department_name"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN designations desig ON desig.id = u.designation_id
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
    const rbacRes = await query<{
      roleId: string | null;
      roles: string[] | null;
      permissions: string[] | null;
    }>(
      `SELECT
         (
           SELECT ur.role_id
           FROM user_roles ur
           JOIN roles_v2 rv2 ON rv2.id = ur.role_id
           WHERE ur.user_id = u.id
           ORDER BY rv2.name
           LIMIT 1
         ) as "role_id",
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
    const primaryRoleId = rbacRes.rows[0]?.roleId || null;
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
        'SELECT client_id FROM user_client_assignments WHERE user_id = $1',
        [userData.id]
      );
      assignedClients = clientsRes.rows.map(row => row.clientId);

      // Fetch assigned products
      const productsRes = await query(
        'SELECT product_id FROM user_product_assignments WHERE user_id = $1',
        [userData.id]
      );
      assignedProducts = productsRes.rows.map(row => row.productId);
    } else if (isFieldExecutionActor(authProfile)) {
      // Fetch assigned pincodes
      const pincodesRes = await query(
        'SELECT pincode_id FROM user_pincode_assignments WHERE user_id = $1 AND is_active = true',
        [userData.id]
      );
      assignedPincodes = pincodesRes.rows.map(row => row.pincodeId);

      // Fetch assigned areas
      const areasRes = await query(
        'SELECT area_id FROM user_area_assignments WHERE user_id = $1 AND is_active = true',
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
        roleId: primaryRoleId,
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
    // Phase E5: accept the refresh token from EITHER the HttpOnly
    // cookie (web) OR the JSON body (mobile / legacy web clients).
    // The cookie is preferred when both are present.
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const cookieToken = cookies?.[REFRESH_COOKIE_NAME];
    const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const token = cookieToken || bodyToken;

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

    // Check DB for valid, non-expired, non-revoked token.
    // 2026-04-28 F1.7.2: revoked tokens are kept for forensics but must
    // not be honored for refresh.
    const result = await query(
      `SELECT id, token, user_id, expires_at, created_at FROM refresh_tokens
       WHERE token = $1 AND user_id = $2
         AND expires_at > CURRENT_TIMESTAMP
         AND revoked_at IS NULL`,
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
    const userRes = await query(
      `SELECT u.id, u.name, u.username, u.email, u.employee_id, d.name as designation, dept.name as department, u.profile_photo_url, u.is_active, u.token_version
       FROM users u
       LEFT JOIN designations d ON d.id = u.designation_id
       LEFT JOIN departments dept ON dept.id = u.department_id
       WHERE u.id = $1`,
      [decoded.userId]
    );
    const user = userRes.rows[0];

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' },
      });
      return;
    }

    // F-B3.4: reject the refresh attempt if the refresh token's
    // tokenVersion is stale (password changed or user was logged out
    // of all devices since this token was issued).
    if (decoded.tokenVersion !== user.tokenVersion) {
      res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked',
        error: { code: 'TOKEN_REVOKED' },
      });
      return;
    }

    // Generate NEW access token
    const accessTokenPayload: JwtPayload = {
      userId: user.id,
      authMethod: 'PASSWORD',
      tokenVersion: user.tokenVersion,
    };

    const accessToken = jwt.sign(accessTokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as string & jwt.SignOptions['expiresIn'],
    });

    // F-B3.1: rotate the refresh token (mirrors mobileAuthController).
    // Without rotation a stolen RT was good for 30 days with no
    // detection trail. With rotation: each successful refresh
    // invalidates the previous token, so a replay attempt fails on
    // the second use.
    const refreshTokenPayload: RefreshTokenPayload = {
      userId: user.id,
      tokenVersion: user.tokenVersion,
      jti: crypto.randomUUID(),
    };
    const newRefreshToken = jwt.sign(refreshTokenPayload, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpiresIn as string & jwt.SignOptions['expiresIn'],
    });
    const newRefreshHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExpiresAt = new Date(Date.now() + parseDurationMs(config.jwtRefreshExpiresIn));

    await withTransaction(async client => {
      // Soft-delete the rotated token (keeps forensic trail per F1.7.2).
      await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'rotated'
         WHERE token = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [tokenHash, decoded.userId]
      );
      await client.query(
        `INSERT INTO refresh_tokens (token, user_id, expires_at, created_at, ip_address, user_agent)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)`,
        [newRefreshHash, user.id, newExpiresAt, req.ip, req.get('User-Agent') || null]
      );
    });

    // Phase E5 + F-B3.1: re-issue cookie with the NEW token value so
    // the next refresh sees the rotated token, not the previous one.
    if (cookieToken) {
      setRefreshTokenCookie(res, newRefreshToken);
    }

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        // Body-path clients (mobile / legacy web) need the new refresh
        // token to replace their stored copy. Cookie-path clients
        // ignore this field — the HttpOnly cookie has the new value.
        refreshToken: newRefreshToken,
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
