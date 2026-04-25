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

// Phase C1: process-local TTL cache for the user auth context.
//
// loadUserAuthContext() runs a large multi-join (user_roles →
// role_permissions → permissions + user_client_assignments +
// user_product_assignments + roles_v2) on every authenticated request.
// Capability profiles change rarely (only when an admin edits roles or
// assignments), so a short TTL is both safe and dramatically cheaper
// than rehydrating the full graph per request.
//
// Implementation notes:
//  - Cache is process-local. In a PM2 cluster each worker maintains
//    its own map; an admin mutation propagates in at most the TTL per
//    worker. A Redis-backed variant can be layered on later without
//    changing the cache shape.
//  - `invalidateAuthContextCache(userId?)` clears a single entry or
//    the whole cache. Admin handlers that mutate user_roles /
//    role_permissions / user_*_assignments can call this to flush
//    immediately instead of waiting for the TTL.
//  - The cached object is frozen so accidental mutation in a
//    middleware chain never leaks into the next request.
//  - Phase F4: hit/miss counters are exposed via getAuthContextCacheStats()
//    so the /health/deep endpoint can surface the hit rate.
// Lowered from 30_000 → 5_000 to shrink the stale-permission window across
// PM2 workers. Mutation handlers that change user roles/permissions still
// SHOULD call `invalidateAuthContextCache(userId)` directly (TODO: wire
// these calls in usersController + rbacController + territoryAssignmentsController);
// the lowered TTL is a defense-in-depth fallback.
const AUTH_CONTEXT_CACHE_TTL_MS = 5_000;
const authContextCache = new Map<string, { context: DbUserAuthContext; expiresAt: number }>();
let authContextCacheHits = 0;
let authContextCacheMisses = 0;

export function invalidateAuthContextCache(userId?: string): void {
  if (userId) {
    authContextCache.delete(userId);
  } else {
    authContextCache.clear();
  }
}

/**
 * Phase F4: snapshot of auth-context cache stats for /health/deep.
 * Process-local counters — in a PM2 cluster each worker reports its
 * own numbers, aggregated by whatever scrapes /health/deep.
 */
export interface AuthContextCacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export function getAuthContextCacheStats(): AuthContextCacheStats {
  const total = authContextCacheHits + authContextCacheMisses;
  return {
    size: authContextCache.size,
    hits: authContextCacheHits,
    misses: authContextCacheMisses,
    hitRate: total === 0 ? 0 : Number((authContextCacheHits / total).toFixed(4)),
  };
}

export interface AuthenticatedRequestUser {
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
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedRequestUser;
}

/**
 * Narrow an AuthenticatedRequest's optional `user` to a required
 * `AuthenticatedRequestUser`. Use this at the top of any handler that
 * is mounted behind `authenticateToken` — middleware guarantees the
 * field is set, but TypeScript's view of the interface keeps it
 * optional so non-authenticated routes can still share the type.
 *
 * Returns undefined and sends a 401 response when called from a
 * misconfigured route (defence in depth — should not be reachable in
 * production).
 */
export const requireAuthUser = (
  req: AuthenticatedRequest,
  res: Response
): AuthenticatedRequestUser | undefined => {
  if (req.user?.id) {
    return req.user;
  }
  res.status(401).json({
    success: false,
    message: 'Authentication required',
    error: { code: 'UNAUTHENTICATED' },
  });
  return undefined;
};

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
  // Fast path: return cached profile if still fresh.
  const now = Date.now();
  const cached = authContextCache.get(userId);
  if (cached && cached.expiresAt > now) {
    authContextCacheHits += 1;
    return cached.context;
  }
  authContextCacheMisses += 1;

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
        ), ARRAY[]::varchar[]) as "permission_codes",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT uca.client_id ORDER BY uca.client_id)
          FROM user_client_assignments uca
          WHERE uca.user_id = u.id
        ), ARRAY[]::int[]) as "assigned_client_ids",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT upa.product_id ORDER BY upa.product_id)
          FROM user_product_assignments upa
          WHERE upa.user_id = u.id
        ), ARRAY[]::int[]) as "assigned_product_ids",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT rv.name ORDER BY rv.name)
          FROM user_roles ur
          JOIN roles_v2 rv ON rv.id = ur.role_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::varchar[]) as roles,
        u.team_leader_id as "team_leader_id",
        u.manager_id as "manager_id"
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

  const context: DbUserAuthContext = Object.freeze({
    id: row.id,
    permissionCodes: Object.freeze(row.permissionCodes || []) as string[],
    assignedClientIds: Object.freeze(row.assignedClientIds || []) as number[],
    assignedProductIds: Object.freeze(row.assignedProductIds || []) as number[],
    roles: Object.freeze(row.roles || []) as string[],
    teamLeaderId: row.teamLeaderId ?? null,
    managerId: row.managerId ?? null,
  });
  authContextCache.set(userId, { context, expiresAt: now + AUTH_CONTEXT_CACHE_TTL_MS });
  return context;
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

const verifyTokenAndSetUser = async (
  token: string,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
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
    return;
  }

  try {
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
  } catch (error) {
    logger.error('Failed to load authenticated user context:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load user context',
      error: { code: 'AUTH_CONTEXT_LOAD_ERROR' },
    });
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

  verifyTokenAndSetUser(token, req, res, next).catch(error => {
    logger.error('Unhandled authenticateToken error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: { code: 'AUTH_ERROR' },
    });
  });
};

// Flexible authentication that supports both header and query parameter
export const authenticateTokenFlexible = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Try Authorization header only — query parameter tokens are disabled
  // (tokens in URLs leak via server logs, browser history, and Referer headers)
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

  verifyTokenAndSetUser(token, req, res, next).catch(error => {
    logger.error('Unhandled authenticateTokenFlexible error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: { code: 'AUTH_ERROR' },
    });
  });
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

// Enhanced auth middleware that loads user permissions.
// verifyTokenAndSetUser already populates the full capability profile, so this
// wrapper just forwards to authenticateToken for backwards compatibility.
export const auth = authenticateToken;

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
