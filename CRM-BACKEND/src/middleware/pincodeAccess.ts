// Disabled unsafe enum comparison rule for pincode access middleware as it compares user roles
import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from './auth';

/**
 * Middleware to enforce pincode-level access restrictions for FIELD_AGENT users
 * This middleware checks if FIELD_AGENT users have access to the requested pincode
 * SUPER_ADMIN users bypass all restrictions
 */

// Helper function to get assigned pincode IDs for FIELD_AGENT users
const getAssignedPincodeIds = async (
  userId: string,
  userRole: string
): Promise<number[] | null> => {
  // Only apply pincode filtering for FIELD_AGENT users
  if (userRole !== 'FIELD_AGENT') {
    return null; // null means no filtering (access to all pincodes)
  }

  try {
    const result = await query(
      'SELECT "pincodeId" FROM "userPincodeAssignments" WHERE "userId" = $1 AND "isActive" = true',
      [userId]
    );

    return result.rows.map(row => row.pincodeId);
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
      const userRole = req.user?.role;

      // Skip validation for non-authenticated requests (should not happen due to auth middleware)
      if (!userId || !userRole) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // SUPER_ADMIN users bypass all pincode restrictions
      if ((userRole as string) === 'SUPER_ADMIN') {
        return next();
      }

      // Only apply restrictions to FIELD_AGENT users
      if ((userRole as string) !== 'FIELD_AGENT') {
        return next();
      }

      // Get the pincode ID from the specified source
      let pincodeId: number | undefined;
      if (source === 'params') {
        pincodeId = req.params.pincodeId ? parseInt(req.params.pincodeId) : undefined;
      } else if (source === 'body') {
        pincodeId = req.body.pincodeId ? parseInt(req.body.pincodeId) : undefined;
      } else if (source === 'query') {
        pincodeId = req.query.pincodeId ? parseInt(req.query.pincodeId as string) : undefined;
      }

      // If no pincode ID is provided, let the request continue
      if (!pincodeId) {
        return next();
      }

      // Get assigned pincode IDs for the FIELD_AGENT user
      const assignedPincodeIds = await getAssignedPincodeIds(userId, userRole);

      // If user has no pincode assignments, deny access
      if (assignedPincodeIds?.length === 0) {
        logger.warn(
          `FIELD_AGENT user ${userId} attempted to access pincode ${pincodeId} with no pincode assignments`,
          {
            userId,
            userRole,
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
            userRole,
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
    const userRole = req.user?.role;

    // Skip for non-authenticated requests
    if (!userId || !userRole) {
      return next();
    }

    // SUPER_ADMIN users bypass all filtering
    if ((userRole as string) === 'SUPER_ADMIN') {
      return next();
    }

    // Only apply filtering to FIELD_AGENT users
    if ((userRole as string) !== 'FIELD_AGENT') {
      return next();
    }

    // Get assigned pincode IDs for the FIELD_AGENT user
    const assignedPincodeIds = await getAssignedPincodeIds(userId, userRole);

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
