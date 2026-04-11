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
}

/**
 * Build the scope-access helpers for one dimension. The returned functions
 * are intended to be exported under dimension-specific names (e.g.
 * `validateClientAccess`, `validateCaseAccess`) from a thin wrapper module.
 */
export function createScopeAccess(config: ScopeAccessConfig): ScopeAccessHelpers {
  const getAssignedIds = async (userId: string): Promise<number[]> => {
    try {
      const result = await query<{ entityId: number }>(
        `SELECT ${config.assignmentColumn} AS "entity_id" FROM ${config.assignmentTable} WHERE user_id = $1`,
        [userId]
      );
      return result.rows.map(row => Number(row.entityId));
    } catch (error) {
      logger.error(`Error fetching assigned ${config.dimension} ids:`, error);
      throw error;
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
  };
}
