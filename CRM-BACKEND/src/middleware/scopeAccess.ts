// Generic scope-access middleware factory.
//
// `clientAccess.ts` and `productAccess.ts` used to contain near-identical
// copies of the same three patterns (get assigned ids, validate an entity by
// id, validate a case by looking up its entity id). This module collapses
// that into a single parameterized factory so the two dimensions share
// exactly one implementation and stay in lockstep on bug fixes.
//
// The factory is dimension-agnostic. Both clientAccess and productAccess
// build on it; future scoping dimensions (e.g. region, department) can reuse
// the same factory without copy-pasting.

import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from './auth';
import { hasSystemScopeBypass, isScopedOperationsUser } from '@/security/rbacAccess';
import { resolveCaseByIdentifier, type ResolvedCase } from '@/utils/caseLookup';

export type ScopeSource = 'params' | 'body' | 'query';

type Middleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<Response | void> | Response | void;

/**
 * Run multiple middlewares in sequence as if express had a built-in
 * "middleware chain → single middleware" adapter. Each middleware is
 * invoked with a local `next` that advances to the next one. If any
 * middleware sends a response (or rejects), the chain short-circuits.
 *
 * Used by the composite case-creation access check — each dimension's
 * `validateEntityAccess('body')` runs in order so a failure in one
 * surfaces as the appropriate dimension-specific error code.
 */
export function chainMiddleware(...middlewares: Middleware[]): Middleware {
  return async (req, res, next) => {
    let index = 0;
    const runNext = async (): Promise<Response | void> => {
      if (index >= middlewares.length) {
        return next();
      }
      const current = middlewares[index++];
      return current(req, res, runNext as NextFunction);
    };
    return runNext();
  };
}

export interface ScopeAccessConfig {
  /**
   * Short dimension name used in log messages and error codes
   * (e.g. "client", "product").
   */
  dimension: string;
  /**
   * SQL table storing the user → entity assignments
   * (e.g. `user_client_assignments`).
   */
  assignmentTable: string;
  /**
   * Snake_case FK column in that table pointing at the entity
   * (e.g. `client_id`, `product_id`).
   */
  assignmentColumn: string;
  /**
   * camelCase property name on `req.params`, `req.body`, and `req.query`
   * used by the route layer (e.g. `clientId`, `productId`).
   */
  requestParamName: string;
  /**
   * Function that extracts the entity id from a resolved `cases` row. Lets
   * clientAccess read `clientId` while productAccess reads `productId`.
   */
  getCaseEntityId: (row: ResolvedCase) => number | null;
  /**
   * Error code prefix used when access is denied (e.g. `CLIENT`, `PRODUCT`).
   * Response codes become `${prefix}_ACCESS_DENIED`,
   * `NO_${prefix}_ACCESS`, `CASE_${prefix}_ACCESS_DENIED`, etc.
   */
  errorCodePrefix: string;
  /**
   * Human-readable label for user-facing error messages
   * (e.g. `"client"`, `"product"`).
   */
  humanLabel: string;
}

export interface ScopeAccessHelpers {
  /** Load the set of entity ids assigned to a user. Throws on DB error. */
  getAssignedIds: (userId: string) => Promise<number[]>;
  /** Middleware factory that validates an entity id from params/body/query. */
  validateEntityAccess: (
    source?: ScopeSource
  ) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response | void>;
  /** Middleware that resolves a case and validates its entity id. */
  validateCaseEntityAccess: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => Promise<Response | void>;
  /**
   * Invalidate the process-local TTL cache for a specific user (or the
   * entire cache if no userId is provided). Call from admin mutation
   * paths after updating user_*_assignments to reflect changes without
   * waiting for the 30s TTL.
   */
  invalidate: (userId?: string) => void;
}

/**
 * Build the scope-access helpers for one dimension. The returned functions
 * are intended to be exported under dimension-specific names (e.g.
 * `validateClientAccess`, `validateCaseAccess`) from a thin wrapper module.
 */
export function createScopeAccess(config: ScopeAccessConfig): ScopeAccessHelpers {
  // Phase C2: process-local TTL cache for user → assigned entity ids.
  //
  // getAssignedIds() is hot — every scoped-ops request calls it at
  // least once, often multiple times (bulk endpoints can check 50+
  // cases in a single handler). The ids change only when an admin
  // touches user_*_assignments, so a short TTL is safe.
  //
  // Implementation notes:
  //  - Map lookup is O(1), cache hit is ~100ns vs ~1-5ms for the DB
  //    round trip. At 2000 concurrent users this replaces ~2000 qps
  //    with a handful per TTL window.
  //  - Cache is process-local, not Redis. That's intentional: scope
  //    changes are rare enough that a 30s drift per worker is fine,
  //    and avoiding Redis on every request simplifies the hot path.
  //  - clearScopeCacheForUser() is exposed at module scope below so
  //    admin mutation paths can invalidate immediately on assignment
  //    changes if desired.
  const assignedIdsCache = new Map<string, { ids: number[]; expiresAt: number }>();
  const CACHE_TTL_MS = 30_000;

  const getAssignedIds = async (userId: string): Promise<number[]> => {
    const now = Date.now();
    const cached = assignedIdsCache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.ids;
    }
    try {
      const result = await query<{ entityId: number }>(
        `SELECT ${config.assignmentColumn} AS "entity_id" FROM ${config.assignmentTable} WHERE user_id = $1`,
        [userId]
      );
      const ids = result.rows.map(row => Number(row.entityId));
      assignedIdsCache.set(userId, { ids, expiresAt: now + CACHE_TTL_MS });
      return ids;
    } catch (error) {
      logger.error(`Error fetching assigned ${config.dimension} ids:`, error);
      throw error;
    }
  };

  const invalidate = (userId?: string): void => {
    if (userId) {
      assignedIdsCache.delete(userId);
    } else {
      assignedIdsCache.clear();
    }
  };

  const extractIdFromSource = (
    req: AuthenticatedRequest,
    source: ScopeSource
  ): number | undefined => {
    const key = config.requestParamName;
    let raw: unknown;
    switch (source) {
      case 'params':
        raw = req.params[key];
        break;
      case 'body':
        raw = (req.body as Record<string, unknown> | undefined)?.[key];
        break;
      case 'query':
        raw = req.query[key];
        break;
    }
    if (raw == null) {
      return undefined;
    }
    const primitive = Array.isArray(raw) ? raw[0] : raw;
    if (primitive == null) {
      return undefined;
    }
    const str =
      typeof primitive === 'string'
        ? primitive
        : typeof primitive === 'number'
          ? String(primitive)
          : '';
    if (!str) {
      return undefined;
    }
    const parsed = parseInt(str, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const validateEntityAccess = (source: ScopeSource = 'params') => {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<Response | void> => {
      try {
        const userId = req.user?.id;
        const user = req.user;

        if (!userId || !user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: { code: 'UNAUTHORIZED' },
          });
        }

        if (hasSystemScopeBypass(user)) {
          return next();
        }

        if (!isScopedOperationsUser(user)) {
          return next();
        }

        const entityId = extractIdFromSource(req, source);
        if (entityId == null || Number.isNaN(entityId)) {
          // Nothing to validate — let downstream validators handle it.
          return next();
        }

        const assignedIds = await getAssignedIds(userId);
        if (assignedIds.length === 0) {
          return res.status(403).json({
            success: false,
            message: `Access denied - user has no assigned ${config.humanLabel}s`,
            error: { code: `NO_${config.errorCodePrefix}_ACCESS` },
          });
        }

        if (!assignedIds.includes(entityId)) {
          logger.warn(
            `Scoped user ${userId} attempted to access unauthorized ${config.humanLabel} ${entityId}`,
            {
              userId,
              permissionCodes: user.permissionCodes,
              [`requested${config.errorCodePrefix}Id`]: entityId,
              assignedIds,
              endpoint: req.originalUrl,
              method: req.method,
            }
          );
          return res.status(403).json({
            success: false,
            message: `Access denied - ${config.humanLabel} not assigned to user`,
            error: { code: `${config.errorCodePrefix}_ACCESS_DENIED` },
          });
        }

        return next();
      } catch (error) {
        logger.error(`Error in ${config.dimension} access validation middleware:`, error);
        return res.status(500).json({
          success: false,
          message: 'Internal server error during access validation',
          error: { code: 'INTERNAL_ERROR' },
        });
      }
    };
  };

  const validateCaseEntityAccess = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?.id;
      const user = req.user;
      const rawCaseId = req.params.id || req.params.caseId || '';
      const caseId = Array.isArray(rawCaseId)
        ? String(rawCaseId[0] || '')
        : String(rawCaseId || '');

      if (!userId || !user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (hasSystemScopeBypass(user)) {
        return next();
      }

      if (!isScopedOperationsUser(user)) {
        return next();
      }

      if (!caseId) {
        return next();
      }

      const resolvedCase = await resolveCaseByIdentifier(caseId);
      if (!resolvedCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      const caseEntityId = config.getCaseEntityId(resolvedCase);
      if (caseEntityId == null) {
        return res.status(403).json({
          success: false,
          message: `Access denied: This case has no ${config.humanLabel} association`,
          error: { code: `CASE_${config.errorCodePrefix}_UNASSIGNED` },
        });
      }

      const assignedIds = await getAssignedIds(userId);
      if (assignedIds.length === 0) {
        return res.status(403).json({
          success: false,
          message: `Access denied - user has no assigned ${config.humanLabel}s`,
          error: { code: `NO_${config.errorCodePrefix}_ACCESS` },
        });
      }

      if (!assignedIds.includes(caseEntityId)) {
        logger.warn(
          `Scoped user ${userId} attempted to access case ${caseId} from unauthorized ${config.humanLabel} ${caseEntityId}`,
          {
            userId,
            permissionCodes: user.permissionCodes,
            caseId,
            [`case${config.errorCodePrefix}Id`]: caseEntityId,
            assignedIds,
            endpoint: req.originalUrl,
            method: req.method,
          }
        );
        return res.status(403).json({
          success: false,
          message: `Access denied - case belongs to unassigned ${config.humanLabel}`,
          error: { code: `CASE_${config.errorCodePrefix}_ACCESS_DENIED` },
        });
      }

      return next();
    } catch (error) {
      logger.error(`Error in case ${config.dimension} access validation middleware:`, error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during case access validation',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  };

  return {
    getAssignedIds,
    validateEntityAccess,
    validateCaseEntityAccess,
    invalidate,
  };
}
