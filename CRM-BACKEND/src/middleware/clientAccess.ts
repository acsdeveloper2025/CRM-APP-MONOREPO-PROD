import { Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from './auth';
import { getAssignedProductIds } from './productAccess';

/**
 * Middleware to enforce client-level access restrictions for BACKEND_USER users
 * This middleware checks if BACKEND_USER users have access to the requested client
 * SUPER_ADMIN users bypass all restrictions
 */

// Helper function to get assigned client IDs for BACKEND_USER users
const getAssignedClientIds = async (userId: string, userRole: string): Promise<number[] | null> => {
  // Only apply client filtering for BACKEND_USER users
  if (userRole !== 'BACKEND_USER') {
    return null; // null means no filtering (access to all clients)
  }

  try {
    const result = await query(
      'SELECT "clientId" FROM "userClientAssignments" WHERE "userId" = $1',
      [userId]
    );
    
    return result.rows.map(row => row.clientId);
  } catch (error) {
    logger.error('Error fetching assigned client IDs:', error);
    throw error;
  }
};

/**
 * Middleware to validate client access for BACKEND_USER users
 * Checks if the user has access to the client specified in the request
 *
 * Usage:
 * - For routes with :clientId parameter: validateClientAccess()
 * - For routes with clientId in body: validateClientAccess('body')
 * - For routes with clientId in query: validateClientAccess('query')
 */
export const validateClientAccess = (source: 'params' | 'body' | 'query' = 'params') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Skip validation for non-authenticated requests (should not happen due to auth middleware)
      if (!userId || !userRole) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // SUPER_ADMIN users bypass all client restrictions
      if (userRole === 'SUPER_ADMIN') {
        return next();
      }

      // Only apply restrictions to BACKEND_USER users
      if (userRole !== 'BACKEND_USER') {
        return next();
      }

      // Get client ID from the specified source
      let clientId: number | undefined;
      
      switch (source) {
        case 'params':
          clientId = req.params.clientId ? parseInt(req.params.clientId) : undefined;
          break;
        case 'body':
          clientId = req.body.clientId ? parseInt(req.body.clientId) : undefined;
          break;
        case 'query':
          clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
          break;
      }

      // If no client ID is provided, let the request continue (other validation will handle it)
      if (!clientId || isNaN(clientId)) {
        return next();
      }

      // Get assigned client IDs for the BACKEND_USER user
      const assignedClientIds = await getAssignedClientIds(userId, userRole);

      if (assignedClientIds && assignedClientIds.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user has no assigned clients',
          error: { code: 'NO_CLIENT_ACCESS' },
        });
      }

      // Check if the user has access to the requested client
      if (assignedClientIds && !assignedClientIds.includes(clientId)) {
        logger.warn(`BACKEND_USER user ${userId} attempted to access unauthorized client ${clientId}`, {
          userId,
          userRole,
          requestedClientId: clientId,
          assignedClientIds,
          endpoint: req.originalUrl,
          method: req.method
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied - client not assigned to user',
          error: { code: 'CLIENT_ACCESS_DENIED' },
        });
      }

      // User has access, continue to the next middleware
      next();
    } catch (error) {
      logger.error('Error in client access validation middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during access validation',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  };
};

/**
 * Middleware to validate case access for BACKEND_USER users
 * This middleware checks if a BACKEND_USER user has access to a case by verifying
 * they have access to the client that owns the case
 */
export const validateCaseAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

    // Get the client ID for the case
    // Handle both numeric case IDs and UUID case IDs
    const isNumeric = /^\d+$/.test(caseId);
    const caseQuery = isNumeric
      ? 'SELECT "clientId" FROM cases WHERE "caseId" = $1'
      : 'SELECT "clientId" FROM cases WHERE id = $1';
    const queryParam = isNumeric ? parseInt(caseId) : caseId;

    const caseResult = await query(caseQuery, [queryParam]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const caseClientId = caseResult.rows[0].clientId;

    // Get assigned client IDs for the BACKEND_USER user
    const assignedClientIds = await getAssignedClientIds(userId, userRole);

    if (assignedClientIds && assignedClientIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - user has no assigned clients',
        error: { code: 'NO_CLIENT_ACCESS' },
      });
    }

    // Check if the user has access to the case's client
    if (assignedClientIds && !assignedClientIds.includes(caseClientId)) {
      logger.warn(`BACKEND_USER user ${userId} attempted to access case ${caseId} from unauthorized client ${caseClientId}`, {
        userId,
        userRole,
        caseId,
        caseClientId,
        assignedClientIds,
        endpoint: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied - case belongs to unassigned client',
        error: { code: 'CASE_ACCESS_DENIED' },
      });
    }

    // User has access, continue to the next middleware
    next();
  } catch (error) {
    logger.error('Error in case access validation middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during case access validation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * Middleware to add client filtering to query parameters for BACKEND_USER users
 * This middleware automatically adds client filtering to list endpoints
 */
export const addClientFiltering = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    logger.info('Client filtering middleware called', { userId, userRole, originalQuery: req.query });

    // Skip for non-authenticated requests
    if (!userId || !userRole) {
      logger.info('Skipping client filtering - no user or role');
      return next();
    }

    // SUPER_ADMIN users bypass all filtering
    if (userRole === 'SUPER_ADMIN') {
      logger.info('Skipping client filtering - SUPER_ADMIN user');
      return next();
    }

    // Only apply filtering to BACKEND_USER users
    if (userRole !== 'BACKEND_USER') {
      logger.info('Skipping client filtering - not BACKEND_USER', { userRole });
      return next();
    }

    // Get assigned client IDs for the BACKEND_USER user
    const assignedClientIds = await getAssignedClientIds(userId, userRole);
    logger.info('Retrieved assigned client IDs', { userId, assignedClientIds });

    if (assignedClientIds && assignedClientIds.length === 0) {
      // User has no client assignments, they should see no data
      (req as any).clientFilter = [];
      logger.info('Set clientFilter to empty array - no assignments');
    } else if (assignedClientIds) {
      // Add client filtering to the request
      (req as any).clientFilter = assignedClientIds;
      logger.info('Set clientFilter', {
        assignedClientIds,
        clientFilter: (req as any).clientFilter
      });
    }

    logger.info('Client filtering middleware complete', { finalQuery: req.query });
    next();
  } catch (error) {
    logger.error('Error in client filtering middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during client filtering',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * Combined middleware to validate both client and product access for case creation
 * This middleware checks if a BACKEND_USER user has access to both the client and product
 * specified in the case creation request
 */
export const validateCaseCreationAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { clientId, productId } = req.body;

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

    // If no clientId or productId is provided, let the request continue
    if (!clientId || !productId) {
      return next();
    }

    // Get assigned client IDs for the BACKEND_USER user
    const assignedClientIds = await getAssignedClientIds(userId, userRole);

    // Check client access
    if (assignedClientIds && assignedClientIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No clients assigned to your account',
        error: { code: 'NO_CLIENT_ACCESS' },
      });
    }

    if (assignedClientIds && !assignedClientIds.includes(parseInt(clientId))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this client',
        error: { code: 'CLIENT_ACCESS_DENIED' },
      });
    }

    // Get assigned product IDs for the BACKEND_USER user
    const assignedProductIds = await getAssignedProductIds(userId, userRole);

    // Check product access
    if (assignedProductIds && assignedProductIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No products assigned to your account',
        error: { code: 'NO_PRODUCT_ACCESS' },
      });
    }

    if (assignedProductIds && !assignedProductIds.includes(parseInt(productId))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this product',
        error: { code: 'PRODUCT_ACCESS_DENIED' },
      });
    }

    next();
  } catch (error) {
    logger.error('Error in case creation access validation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during access validation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Export helper function for use in other modules
export { getAssignedClientIds };
