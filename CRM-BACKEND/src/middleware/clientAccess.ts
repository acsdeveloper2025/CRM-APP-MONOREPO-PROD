// Client-scope access control middleware.
//
// This file is a thin wrapper around the generic scopeAccess factory. It
// preserves the historical public API (validateClientAccess,
// validateCaseAccess, addClientFiltering, validateCaseCreationAccess,
// getAssignedClientIds) so no route or controller has to change.

import type { Response, NextFunction } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from './auth';
import { getAssignedProductIds } from './productAccess';
import { hasSystemScopeBypass, isScopedOperationsUser } from '@/security/rbacAccess';
import { resolveDataScope } from '@/security/dataScope';
import { createScopeAccess } from './scopeAccess';

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
 * Combined middleware for case creation: verifies both client and product
 * access in one pass using the body-supplied clientId/productId.
 */
export const validateCaseCreationAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    const user = req.user;
    const { clientId, productId } = req.body as { clientId?: unknown; productId?: unknown };

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

    if (clientId == null || productId == null) {
      return next();
    }

    const clientIdNum =
      typeof clientId === 'number'
        ? clientId
        : typeof clientId === 'string'
          ? parseInt(clientId, 10)
          : Number.NaN;
    const productIdNum =
      typeof productId === 'number'
        ? productId
        : typeof productId === 'string'
          ? parseInt(productId, 10)
          : Number.NaN;

    if (!Number.isFinite(clientIdNum) || !Number.isFinite(productIdNum)) {
      return next();
    }

    const assignedClientIds = await getAssignedClientIds(userId);
    if (assignedClientIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No clients assigned to your account',
        error: { code: 'NO_CLIENT_ACCESS' },
      });
    }
    if (!assignedClientIds.includes(clientIdNum)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this client',
        error: { code: 'CLIENT_ACCESS_DENIED' },
      });
    }

    const assignedProductIds = await getAssignedProductIds(userId);
    if (assignedProductIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No products assigned to your account',
        error: { code: 'NO_PRODUCT_ACCESS' },
      });
    }
    if (!assignedProductIds.includes(productIdNum)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this product',
        error: { code: 'PRODUCT_ACCESS_DENIED' },
      });
    }

    return next();
  } catch (error) {
    logger.error('Error in case creation access validation:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during access validation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
