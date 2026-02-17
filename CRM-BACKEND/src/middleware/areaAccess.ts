// Disabled unsafe enum comparison rule for area access middleware as it compares user roles
import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from './auth';

/**
 * Middleware to enforce area-level access restrictions for FIELD_AGENT users
 * This middleware checks if FIELD_AGENT users have access to the requested area
 * SUPER_ADMIN users bypass all restrictions
 */

// Helper function to get assigned area IDs for FIELD_AGENT users
const getAssignedAreaIds = async (userId: string, userRole: string): Promise<number[] | null> => {
  // Only apply area filtering for FIELD_AGENT users
  if (userRole !== 'FIELD_AGENT') {
    return null; // null means no filtering (access to all areas)
  }

  try {
    const result = await query(
      'SELECT "areaId" FROM "userAreaAssignments" WHERE "userId" = $1 AND "isActive" = true',
      [userId]
    );

    return result.rows.map(row => row.areaId);
  } catch (error) {
    logger.error('Error fetching assigned area IDs:', error);
    throw error;
  }
};

/**
 * Middleware to validate area access for FIELD_AGENT users
 * Checks if the user has access to the area specified in the request
 *
 * Usage:
 * - For routes with :areaId parameter: validateAreaAccess()
 * - For routes with areaId in body: validateAreaAccess('body')
 * - For routes with areaId in query: validateAreaAccess('query')
 */
export const validateAreaAccess = (source: 'params' | 'body' | 'query' = 'params') => {
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

      // SUPER_ADMIN users bypass all area restrictions
      if ((userRole as string) === 'SUPER_ADMIN') {
        return next();
      }

      // Only apply restrictions to FIELD_AGENT users
      if ((userRole as string) !== 'FIELD_AGENT') {
        return next();
      }

      // Get the area ID from the specified source
      let areaId: number | undefined;
      if (source === 'params') {
        const rawId = req.params.areaId as unknown as string;
        areaId = rawId ? parseInt(Array.isArray(rawId) ? (rawId[0] as string) : rawId) : undefined;
      } else if (source === 'body') {
        areaId = req.body.areaId ? parseInt(req.body.areaId) : undefined;
      } else if (source === 'query') {
        const rawId = req.query.areaId;
        areaId = rawId
          ? parseInt(Array.isArray(rawId) ? (rawId[0] as string) : (rawId as string))
          : undefined;
      }

      // If no area ID is provided, let the request continue
      if (!areaId) {
        return next();
      }

      // Get assigned area IDs for the FIELD_AGENT user
      const assignedAreaIds = await getAssignedAreaIds(userId, userRole);

      // If user has no area assignments, deny access
      if (assignedAreaIds?.length === 0) {
        logger.warn(
          `FIELD_AGENT user ${userId} attempted to access area ${areaId} with no area assignments`,
          {
            userId,
            userRole,
            areaId,
            endpoint: req.originalUrl,
            method: req.method,
          }
        );

        return res.status(403).json({
          success: false,
          message: 'Access denied: No areas assigned to your account',
          error: { code: 'NO_AREA_ACCESS' },
        });
      }

      // Check if the user has access to the requested area
      if (assignedAreaIds && !assignedAreaIds.includes(areaId)) {
        logger.warn(`FIELD_AGENT user ${userId} attempted to access unauthorized area ${areaId}`, {
          userId,
          userRole,
          areaId,
          assignedAreaIds,
          endpoint: req.originalUrl,
          method: req.method,
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have access to this area',
          error: { code: 'AREA_ACCESS_DENIED' },
        });
      }

      next();
    } catch (error) {
      logger.error('Error in area access validation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during area access validation',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  };
};

/**
 * Middleware to add area filtering to query parameters for FIELD_AGENT users
 * This middleware automatically adds area filtering to list endpoints
 */
export const addAreaFiltering = async (
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

    // Get assigned area IDs for the FIELD_AGENT user
    const assignedAreaIds = await getAssignedAreaIds(userId, userRole);

    if (assignedAreaIds?.length === 0) {
      // User has no area assignments, they should see no data
      req.query.areaIds = '[]';
    } else if (assignedAreaIds) {
      // Add area filtering to the query
      req.query.areaIds = JSON.stringify(assignedAreaIds);
    }

    next();
  } catch (error) {
    logger.error('Error in area filtering middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during area filtering',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Export helper function for use in other modules
export { getAssignedAreaIds };
