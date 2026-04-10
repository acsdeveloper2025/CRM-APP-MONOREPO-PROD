// Disabled unsafe enum comparison rule for pincode access middleware as it compares user roles
import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from './auth';
import { hasSystemScopeBypass, isFieldExecutionActor } from '@/security/rbacAccess';

/**
 * Middleware to enforce pincode-level access restrictions for FIELD_AGENT users
 * This middleware checks if FIELD_AGENT users have access to the requested pincode
 * SUPER_ADMIN users bypass all restrictions
 */

// Helper function to get assigned pincode IDs for FIELD_AGENT users
const getAssignedPincodeIds = async (userId: string): Promise<number[]> => {
  try {
    const result = await query(
      'SELECT pincode_id FROM user_pincode_assignments WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    return result.rows.map(row => row.pincode_id);
  } catch (error) {
    logger.error('Error fetching assigned pincode IDs:', error);
    throw error;
  }
};

/**
 * Middleware to validate pincode access for FIELD_AGENT users
 * Checks if the user has access to the pincode specified in the request
 *
 * Usage:
 * - For routes with :pincodeId parameter: validatePincodeAccess()
 * - For routes with pincodeId in body: validatePincodeAccess('body')
 * - For routes with pincodeId in query: validatePincodeAccess('query')
 */
export const validatePincodeAccess = (source: 'params' | 'body' | 'query' = 'params') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      // Skip validation for non-authenticated requests (should not happen due to auth middleware)
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (hasSystemScopeBypass(req.user)) {
        return next();
      }

      if (!isFieldExecutionActor(req.user)) {
        return next();
      }

      // Get the pincode ID from the specified source
      let pincodeId: number | undefined;
      if (source === 'params') {
        const rawId = req.params.pincodeId;
        const idStr = Array.isArray(rawId) ? String(rawId[0] || '') : String(rawId || '');
        pincodeId = idStr ? parseInt(idStr) : undefined;
      } else if (source === 'body') {
        pincodeId = req.body.pincodeId ? parseInt(req.body.pincodeId) : undefined;
      } else if (source === 'query') {
        const rawId = req.query.pincodeId;
        const idStr = Array.isArray(rawId)
          ? String((rawId[0] as unknown as string) || '')
          : String((rawId as unknown as string) || '');
        pincodeId = idStr ? parseInt(idStr) : undefined;
      }

      // If no pincode ID is provided, let the request continue
      if (!pincodeId) {
        return next();
      }

      // Get assigned pincode IDs for the FIELD_AGENT user
      const assignedPincodeIds = await getAssignedPincodeIds(userId);

      // If user has no pincode assignments, deny access
      if (assignedPincodeIds?.length === 0) {
        logger.warn(
          `FIELD_AGENT user ${userId} attempted to access pincode ${pincodeId} with no pincode assignments`,
          {
            userId,
            executionActor: true,
            pincodeId,
            endpoint: req.originalUrl,
            method: req.method,
          }
        );

        return res.status(403).json({
          success: false,
          message: 'Access denied: No pincodes assigned to your account',
          error: { code: 'NO_PINCODE_ACCESS' },
        });
      }

      // Check if the user has access to the requested pincode
      if (assignedPincodeIds && !assignedPincodeIds.includes(pincodeId)) {
        logger.warn(
          `FIELD_AGENT user ${userId} attempted to access unauthorized pincode ${pincodeId}`,
          {
            userId,
            executionActor: true,
            pincodeId,
            assignedPincodeIds,
            endpoint: req.originalUrl,
            method: req.method,
          }
        );

        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have access to this pincode',
          error: { code: 'PINCODE_ACCESS_DENIED' },
        });
      }

      next();
    } catch (error) {
      logger.error('Error in pincode access validation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during pincode access validation',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  };
};

/**
 * Middleware to add pincode filtering to query parameters for FIELD_AGENT users
 * This middleware automatically adds pincode filtering to list endpoints
 */
export const addPincodeFiltering = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    // Skip for non-authenticated requests
    if (!userId) {
      return next();
    }

    if (hasSystemScopeBypass(req.user)) {
      return next();
    }

    if (!isFieldExecutionActor(req.user)) {
      return next();
    }

    // Get assigned pincode IDs for the FIELD_AGENT user
    const assignedPincodeIds = await getAssignedPincodeIds(userId);

    if (assignedPincodeIds?.length === 0) {
      // User has no pincode assignments, they should see no data
      req.query.pincodeIds = '[]';
    } else if (assignedPincodeIds) {
      // Add pincode filtering to the query
      req.query.pincodeIds = JSON.stringify(assignedPincodeIds);
    }

    next();
  } catch (error) {
    logger.error('Error in pincode filtering middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during pincode filtering',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Export helper function for use in other modules
export { getAssignedPincodeIds };
