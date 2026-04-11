// Client-scope access control middleware.
//
// This file is a thin wrapper around the generic scopeAccess factory. It
// preserves the historical public API (validateClientAccess,
// validateCaseAccess, addClientFiltering, validateCaseCreationAccess,
// getAssignedClientIds) so no route or controller has to change.

import type { Response, NextFunction } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from './auth';
import { validateProductAccess } from './productAccess';
import { hasSystemScopeBypass, isScopedOperationsUser } from '@/security/rbacAccess';
import { resolveDataScope } from '@/security/dataScope';
import { createScopeAccess, chainMiddleware } from './scopeAccess';

interface RequestWithClientFilter extends AuthenticatedRequest {
  clientFilter?: number[];
}

const clientScope = createScopeAccess({
  dimension: 'client',
  assignmentTable: 'user_client_assignments',
  assignmentColumn: 'client_id',
  requestParamName: 'clientId',
  getCaseEntityId: row => row.clientId,
  errorCodePrefix: 'CLIENT',
  humanLabel: 'client',
});

export const getAssignedClientIds = clientScope.getAssignedIds;
export const validateClientAccess = clientScope.validateEntityAccess;
export const validateCaseAccess = clientScope.validateCaseEntityAccess;
/**
 * Invalidate the client-scope TTL cache for a user (or all users). Call
 * from admin handlers that mutate user_client_assignments so the change
 * takes effect immediately instead of waiting for the 30s TTL.
 */
export const invalidateClientScopeCache = clientScope.invalidate;

/**
 * Middleware to add client filtering to query parameters for scoped users.
 * Populates `req.clientFilter` with the hierarchy-aggregated client ids so
 * list handlers can build WHERE clauses without re-querying user scope.
 */
export const addClientFiltering = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    const user = req.user;

    logger.info('Client filtering middleware called', {
      userId,
      permissionCodes: user?.permissionCodes,
      originalQuery: req.query,
    });

    if (!userId || !user) {
      return next();
    }

    if (hasSystemScopeBypass(user)) {
      return next();
    }

    if (!isScopedOperationsUser(user)) {
      return next();
    }

    // Use resolveDataScope for hierarchy-aggregated ids (managers/TLs see
    // their subordinates' scope, scoped ops see their own).
    const scope = await resolveDataScope(req);
    const scopedClientIds = scope.assignedClientIds ?? [];
    (req as RequestWithClientFilter).clientFilter = scopedClientIds;

    logger.info('Client filtering middleware complete', {
      scopedClientIds,
    });
    return next();
  } catch (error) {
    logger.error('Error in client filtering middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during client filtering',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * Combined middleware for case creation: verifies both client AND product
 * access in one pass using the body-supplied clientId/productId. Built as
 * a chain of the two factory-produced `validateEntityAccess('body')`
 * middlewares so both dimensions share exactly one implementation and
 * return dimension-specific error codes (CLIENT_ACCESS_DENIED vs
 * PRODUCT_ACCESS_DENIED) without copy-pasted branches.
 */
export const validateCaseCreationAccess = chainMiddleware(
  validateClientAccess('body'),
  validateProductAccess('body')
);
