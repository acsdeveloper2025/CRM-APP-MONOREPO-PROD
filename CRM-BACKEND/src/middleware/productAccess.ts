import { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from './auth';

/**
 * Product Access Control Middleware
 * Provides access control for BACKEND_USER users to specific products
 */

// Helper function to get assigned product IDs for BACKEND_USER users
const getAssignedProductIds = async (userId: string, userRole: string): Promise<number[] | null> => {
  // Only apply product filtering for BACKEND_USER users
  if (userRole !== 'BACKEND_USER') {
    return null; // null means no filtering (access to all products)
  }

  try {
    const result = await query(
      'SELECT "productId" FROM "userProductAssignments" WHERE "userId" = $1',
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
      const userRole = req.user?.role;

      // Skip validation for non-authenticated requests
      if (!userId || !userRole) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // SUPER_ADMIN users bypass all restrictions
      if (userRole === 'SUPER_ADMIN') {
        return next();
      }

      // Only apply restrictions to BACKEND_USER users
      if (userRole !== 'BACKEND_USER') {
        return next();
      }

      // Get product ID from the specified source
      let productId: number;
      
      switch (source) {
        case 'params':
          productId = parseInt(req.params.productId || req.params.id);
          break;
        case 'body':
          productId = req.body.productId;
          break;
        case 'query':
          productId = parseInt(req.query.productId as string);
          break;
        default:
          productId = parseInt(req.params.productId || req.params.id);
      }

      // If no product ID is provided, let the request continue
      if (!productId || isNaN(productId)) {
        return next();
      }

      // Get assigned product IDs for the BACKEND_USER user
      const assignedProductIds = await getAssignedProductIds(userId, userRole);

      // If user has no product assignments, deny access
      if (assignedProductIds && assignedProductIds.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No products assigned to your account',
          error: { code: 'NO_PRODUCT_ACCESS' },
        });
      }

      // Check if user has access to the specific product
      if (assignedProductIds && !assignedProductIds.includes(productId)) {
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
export const validateCaseProductAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const caseId = req.params.id || req.params.caseId;

    // Skip validation for non-authenticated requests
    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHORIZED' },
      });
    }

    // SUPER_ADMIN users bypass all restrictions
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Only apply restrictions to BACKEND_USER users
    if (userRole !== 'BACKEND_USER') {
      return next();
    }

    // If no case ID is provided, let the request continue
    if (!caseId) {
      return next();
    }

    // Get the product ID for the case
    const caseResult = await query(
      'SELECT "productId" FROM cases WHERE id = $1',
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const productId = caseResult.rows[0].productId;

    // Get assigned product IDs for the BACKEND_USER user
    const assignedProductIds = await getAssignedProductIds(userId, userRole);

    // If user has no product assignments, deny access
    if (assignedProductIds && assignedProductIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No products assigned to your account',
        error: { code: 'NO_PRODUCT_ACCESS' },
      });
    }

    // Check if user has access to the product associated with the case
    if (assignedProductIds && !assignedProductIds.includes(productId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this case\'s product',
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
export const addProductFiltering = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Skip for non-authenticated requests
    if (!userId || !userRole) {
      return next();
    }

    // SUPER_ADMIN users bypass all filtering
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Only apply filtering to BACKEND_USER users
    if (userRole !== 'BACKEND_USER') {
      return next();
    }

    // Get assigned product IDs for the BACKEND_USER user
    const assignedProductIds = await getAssignedProductIds(userId, userRole);

    if (assignedProductIds && assignedProductIds.length === 0) {
      // User has no product assignments, they should see no data
      req.query.productIds = '[]';
    } else if (assignedProductIds) {
      // Add product filtering to the query
      req.query.productIds = JSON.stringify(assignedProductIds);
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
