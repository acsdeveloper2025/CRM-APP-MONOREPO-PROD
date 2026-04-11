// Product-scope access control middleware.
//
// Thin wrapper around the generic scopeAccess factory. Preserves the
// historical public API (validateProductAccess, validateCaseProductAccess,
// addProductFiltering, getAssignedProductIds) so no route or controller has
// to change.

import type { Response, NextFunction } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/types/auth';
import { hasSystemScopeBypass, isScopedOperationsUser } from '@/security/rbacAccess';
import { resolveDataScope } from '@/security/dataScope';
import { createScopeAccess } from './scopeAccess';

const productScope = createScopeAccess({
  dimension: 'product',
  assignmentTable: 'user_product_assignments',
  assignmentColumn: 'product_id',
  requestParamName: 'productId',
  getCaseEntityId: row => row.productId,
  errorCodePrefix: 'PRODUCT',
  humanLabel: 'product',
});

export const getAssignedProductIds = productScope.getAssignedIds;
export const validateProductAccess = productScope.validateEntityAccess;
export const validateCaseProductAccess = productScope.validateCaseEntityAccess;
/**
 * Invalidate the product-scope TTL cache for a user (or all users).
 * Call from admin handlers that mutate user_product_assignments so the
 * change takes effect immediately instead of waiting for the 30s TTL.
 */
export const invalidateProductScopeCache = productScope.invalidate;

/**
 * Middleware to add product filtering to query parameters for scoped users.
 * Populates `req.query.productIds` with a JSON array of hierarchy-aggregated
 * product ids so list handlers can build WHERE clauses.
 */
export const addProductFiltering = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    const user = req.user;

    if (!userId || !user) {
      return next();
    }

    if (hasSystemScopeBypass(user)) {
      return next();
    }

    if (!isScopedOperationsUser(user)) {
      return next();
    }

    const scope = await resolveDataScope(req);
    const scopedProductIds = scope.assignedProductIds ?? [];
    req.query.productIds = JSON.stringify(scopedProductIds);

    return next();
  } catch (error) {
    logger.error('Error in product filtering middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during product filtering',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
