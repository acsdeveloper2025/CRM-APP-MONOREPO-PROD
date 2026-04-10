// Disabled unsafe enum comparison rule for client access middleware as it compares user roles
import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from './auth';
import { getAssignedProductIds } from './productAccess';
import { hasSystemScopeBypass, isScopedOperationsUser } from '@/security/rbacAccess';
import { resolveDataScope } from '@/security/dataScope';

interface RequestWithClientFilter extends AuthenticatedRequest {
  clientFilter?: number[];
}

/**
 * Middleware to enforce client-level access restrictions for BACKEND_USER users
 * This middleware checks if BACKEND_USER users have access to the requested client
 * SUPER_ADMIN users bypass all restrictions
 */

// Helper function to get assigned client IDs for BACKEND_USER users
const getAssignedClientIds = async (userId: string): Promise<number[]> => {
  try {
    const result = await query('SELECT client_id FROM user_client_assignments WHERE user_id = $1', [
      userId,
    ]);

    return result.rows.map(row => row.client_id);
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
      const user = req.user;

      // Skip validation for non-authenticated requests (should not happen due to auth middleware)
      if (!userId || !user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // SUPER_ADMIN users bypass all client restrictions
      if (hasSystemScopeBypass(user)) {
        return next();
      }

      if (!isScopedOperationsUser(user)) {
        return next();
      }

      // Get client ID from the specified source
      let clientId: number | undefined;

      switch (source) {
        case 'params': {
          const rawId = req.params.clientId;
          const idStr = Array.isArray(rawId) ? String(rawId[0] || '') : String(rawId || '');
          clientId = idStr ? parseInt(idStr) : undefined;
          break;
        }
        case 'body':
          clientId = req.body.clientId ? parseInt(req.body.clientId) : undefined;
          break;
        case 'query': {
          const rawId = req.query.clientId;
          const idStr = Array.isArray(rawId)
            ? String((rawId[0] as unknown as string) || '')
            : String((rawId as unknown as string) || '');
          clientId = idStr ? parseInt(idStr) : undefined;
          break;
        }
      }

      // If no client ID is provided, let the request continue (other validation will handle it)
      if (!clientId || isNaN(clientId)) {
        return next();
      }

      // Get assigned client IDs for the BACKEND_USER user
      const assignedClientIds = await getAssignedClientIds(userId);

      if (assignedClientIds.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user has no assigned clients',
          error: { code: 'NO_CLIENT_ACCESS' },
        });
      }

      // Check if the user has access to the requested client
      if (!assignedClientIds.includes(clientId)) {
        logger.warn(
          `BACKEND_USER user ${userId} attempted to access unauthorized client ${clientId}`,
          {
            userId,
            permissionCodes: user.permissionCodes,
            requestedClientId: clientId,
            assignedClientIds,
            endpoint: req.originalUrl,
            method: req.method,
          }
        );

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
export const validateCaseAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const user = req.user;
    const rawCaseId = req.params.id || req.params.caseId || '';
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

    // Get the client ID for the case
    // Handle both numeric case IDs and UUID case IDs
    const isNumeric = /^\d+$/.test(caseId);
    const caseQuery = isNumeric
      ? 'SELECT client_id FROM cases WHERE case_id = $1'
      : 'SELECT client_id FROM cases WHERE id = $1';
    const queryParam = isNumeric ? parseInt(caseId) : caseId;

    const caseResult = await query(caseQuery, [queryParam]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const caseClientId = caseResult.rows[0].client_id;

    // Get assigned client IDs for the BACKEND_USER user
    const assignedClientIds = await getAssignedClientIds(userId);

    if (assignedClientIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - user has no assigned clients',
        error: { code: 'NO_CLIENT_ACCESS' },
      });
    }

    // Check if the user has access to the case's client
    if (!assignedClientIds.includes(caseClientId)) {
      logger.warn(
        `BACKEND_USER user ${userId} attempted to access case ${caseId} from unauthorized client ${caseClientId}`,
        {
          userId,
          permissionCodes: user.permissionCodes,
          caseId,
          caseClientId,
          assignedClientIds,
          endpoint: req.originalUrl,
          method: req.method,
        }
      );

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
export const addClientFiltering = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const user = req.user;

    logger.info('Client filtering middleware called', {
      userId,
      permissionCodes: user?.permissionCodes,
      originalQuery: req.query,
    });

    // Skip for non-authenticated requests
    if (!userId || !user) {
      logger.info('Skipping client filtering - no user or role');
      return next();
    }

    if (hasSystemScopeBypass(user)) {
      logger.info('Skipping client filtering - system scope bypass');
      return next();
    }

    if (!isScopedOperationsUser(user)) {
      logger.info('Skipping client filtering - user is not scoped ops profile');
      return next();
    }

    // Use resolveDataScope to get hierarchy-aggregated client IDs
    // For Manager/TL: returns union of own + subordinates' assigned clients
    // For BACKEND_USER: returns own assigned clients only
    const scope = await resolveDataScope(req);
    const scopedClientIds = scope.assignedClientIds ?? [];
    logger.info('Retrieved scoped client IDs', { userId, scopedClientIds });

    if (scopedClientIds.length === 0) {
      // User has no client assignments, they should see no data
      (req as RequestWithClientFilter).clientFilter = [];
      logger.info('Set clientFilter to empty array - no assignments');
    } else {
      // Add client filtering to the request
      (req as RequestWithClientFilter).clientFilter = scopedClientIds;
      logger.info('Set clientFilter', {
        scopedClientIds,
        clientFilter: (req as RequestWithClientFilter).clientFilter,
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
export const validateCaseCreationAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const user = req.user;
    const { clientId, productId } = req.body;

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

    // If no clientId or productId is provided, let the request continue
    if (!clientId || !productId) {
      return next();
    }

    // Get assigned client IDs for the BACKEND_USER user
    const assignedClientIds = await getAssignedClientIds(userId);

    // Check client access
    if (assignedClientIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No clients assigned to your account',
        error: { code: 'NO_CLIENT_ACCESS' },
      });
    }

    if (!assignedClientIds.includes(parseInt(clientId))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this client',
        error: { code: 'CLIENT_ACCESS_DENIED' },
      });
    }

    // Get assigned product IDs for the BACKEND_USER user
    const assignedProductIds = await getAssignedProductIds(userId);

    // Check product access
    if (assignedProductIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No products assigned to your account',
        error: { code: 'NO_PRODUCT_ACCESS' },
      });
    }

    if (!assignedProductIds.includes(parseInt(productId))) {
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
