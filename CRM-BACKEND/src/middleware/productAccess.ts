// Disabled unsafe enum comparison rule for product access middleware as it compares user roles
import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/types/auth';
import { hasSystemScopeBypass, isScopedOperationsUser } from '@/security/rbacAccess';
import { resolveDataScope } from '@/security/dataScope';

/**
 * Product Access Control Middleware
 * Provides access control for BACKEND_USER users to specific products
 */

// Helper function to get assigned product IDs for BACKEND_USER users
const getAssignedProductIds = async (userId: string): Promise<number[]> => {
  try {
    const result = await query(
      'SELECT product_id FROM user_product_assignments WHERE user_id = $1',
      [userId]
    );

    return result.rows.map(row => row.productId);
  } catch (error) {
    logger.error('Error fetching assigned product IDs:', error);
    throw error;
  }
};

/**
 * Middleware to validate product access for BACKEND_USER users
 * Checks if the user has access to the product specified in the request
 *
 * Usage:
 * - For routes with :productId parameter: validateProductAccess()
 * - For routes with productId in body: validateProductAccess('body')
 * - For routes with productId in query: validateProductAccess('query')
 */
export const validateProductAccess = (source: 'params' | 'body' | 'query' = 'params') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const user = req.user;

      // Skip validation for non-authenticated requests
      if (!userId || !user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // SUPER_ADMIN users bypass all restrictions
      if (hasSystemScopeBypass(user)) {
        return next();
      }

      if (!isScopedOperationsUser(user)) {
        return next();
      }

      // Get product ID from the specified source
      let productId: number;
      switch (source) {
        case 'params': {
          const rawId = req.params.productId || req.params.id;
          const idStr = Array.isArray(rawId) ? String(rawId[0] || '') : String(rawId || '');
          productId = parseInt(idStr || '0');
          break;
        }
        case 'body':
          productId = Number(req.body.productId);
          break;
        case 'query': {
          const rawId = req.query.productId;
          const idStr = Array.isArray(rawId)
            ? String((rawId[0] as unknown as string) || '')
            : String((rawId as unknown as string) || '0');
          productId = parseInt(idStr);
          break;
        }
        default: {
          const rawId = req.params.productId || req.params.id;
          const idStr = Array.isArray(rawId) ? String(rawId[0] || '') : String(rawId || '');
          productId = parseInt(String(idStr || '0'));
        }
      }

      // If no product ID is provided, let the request continue
      if (!productId || isNaN(productId)) {
        return next();
      }

      // Get assigned product IDs for the BACKEND_USER user
      const assignedProductIds = await getAssignedProductIds(userId);

      // If user has no product assignments, deny access
      if (assignedProductIds.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No products assigned to your account',
          error: { code: 'NO_PRODUCT_ACCESS' },
        });
      }

      // Check if user has access to the specific product
      if (!assignedProductIds.includes(productId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have access to this product',
          error: { code: 'PRODUCT_ACCESS_DENIED' },
        });
      }

      next();
    } catch (error) {
      logger.error('Error in product access validation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during product access validation',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  };
};

/**
 * Middleware to validate case access for BACKEND_USER users based on product
 * This middleware checks if a BACKEND_USER user has access to a case by verifying
 * they have access to the product associated with the case
 */
export const validateCaseProductAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const user = req.user;
    // Check both :id and :caseId parameters
    const rawCaseId = req.params.id || req.params.caseId;
    const caseId = Array.isArray(rawCaseId) ? String(rawCaseId[0] || '') : String(rawCaseId || '');

    // Skip validation for non-authenticated requests
    if (!userId || !user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHORIZED' },
      });
    }

    // SUPER_ADMIN users bypass all restrictions
    if (hasSystemScopeBypass(user)) {
      return next();
    }

    if (!isScopedOperationsUser(user)) {
      return next();
    }

    // If no case ID is provided, let the request continue
    if (!caseId) {
      return next();
    }

    // Get the product ID for the case
    const caseResult = await query('SELECT product_id FROM cases WHERE id = $1', [caseId]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const productId = caseResult.rows[0].product_id;

    // Get assigned product IDs for the BACKEND_USER user
    const assignedProductIds = await getAssignedProductIds(userId);

    // If user has no product assignments, deny access
    if (assignedProductIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No products assigned to your account',
        error: { code: 'NO_PRODUCT_ACCESS' },
      });
    }

    // Check if user has access to the product associated with the case
    if (!assignedProductIds.includes(productId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You do not have access to this case's product",
        error: { code: 'CASE_PRODUCT_ACCESS_DENIED' },
      });
    }

    next();
  } catch (error) {
    logger.error('Error in case product access validation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during case product access validation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * Middleware to add product filtering to query parameters for BACKEND_USER users
 * This middleware automatically adds product filtering to list endpoints
 */
export const addProductFiltering = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const user = req.user;

    // Skip for non-authenticated requests
    if (!userId || !user) {
      return next();
    }

    // SUPER_ADMIN users bypass all filtering
    if (hasSystemScopeBypass(user)) {
      return next();
    }

    if (!isScopedOperationsUser(user)) {
      return next();
    }

    // Use resolveDataScope to get hierarchy-aggregated product IDs
    // For Manager/TL: returns union of own + subordinates' assigned products
    // For BACKEND_USER: returns own assigned products only
    const scope = await resolveDataScope(req);
    const scopedProductIds = scope.assignedProductIds ?? [];

    if (scopedProductIds.length === 0) {
      // User has no product assignments, they should see no data
      req.query.productIds = '[]';
    } else {
      // Add product filtering to the query
      req.query.productIds = JSON.stringify(scopedProductIds);
    }

    next();
  } catch (error) {
    logger.error('Error in product filtering middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during product filtering',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Export helper function for use in other modules
export { getAssignedProductIds };
