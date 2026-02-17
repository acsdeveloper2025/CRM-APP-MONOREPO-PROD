import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { Role } from '@/types/auth';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { ApiResponse } from '@/types/api';
import { logger } from '@/config/logger';

/**
 * Middleware to validate that the authenticated user has access to a verification task.
 *
 * Authorization Rules:
 * - FIELD_AGENT: Can only access tasks assigned to them (assigned_to = user.id)
 * - BACKEND_USER, MANAGER: Can access all tasks
 * - ADMIN, SUPER_ADMIN: Can access all tasks
 *
 * Returns:
 * - 404 if task not found
 * - 403 if user not authorized to access the task
 */
export const requireTaskAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHORIZED' },
      };
      res.status(401).json(response);
      return;
    }

    // Extract taskId from params, body, or nested params
    const taskId = req.params.taskId || req.params.id || req.body.taskId;

    if (!taskId) {
      const response: ApiResponse = {
        success: false,
        message: 'Task ID is required',
        error: { code: 'INVALID_REQUEST' },
      };
      res.status(400).json(response);
      return;
    }

    // ADMIN and SUPER_ADMIN bypass ownership checks
    if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN) {
      next();
      return;
    }

    // BACKEND_USER and MANAGER have full access to all tasks
    if (userRole === Role.BACKEND_USER || userRole === Role.MANAGER) {
      next();
      return;
    }

    // FIELD_AGENT: Must validate ownership
    if (userRole === Role.FIELD_AGENT) {
      const taskResult = await query(
        'SELECT id, assigned_to, status, task_number FROM verification_tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        };
        res.status(404).json(response);
        return;
      }

      const task = taskResult.rows[0];

      // Check if task is assigned to this user
      if (task.assigned_to !== userId) {
        // Log unauthorized access attempt
        logger.warn('Unauthorized task access attempt', {
          userId,
          userRole,
          taskId,
          assignedTo: task.assigned_to,
          taskNumber: task.task_number,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        const response: ApiResponse = {
          success: false,
          message: 'You are not authorized to access this verification task',
          error: {
            code: 'ACCESS_DENIED',
            details: {
              reason: 'Task is not assigned to you',
            },
          },
        };
        res.status(403).json(response);
        return;
      }

      // Task is assigned to user - allow access
      next();
      return;
    }

    // Unknown role - deny access
    logger.error('Unknown user role in task access check', {
      userId,
      userRole,
      taskId,
    });

    const response: ApiResponse = {
      success: false,
      message: 'Invalid user role',
      error: { code: 'FORBIDDEN' },
    };
    res.status(403).json(response);
  } catch (error) {
    logger.error('Error in requireTaskAccess middleware:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
    };
    res.status(500).json(response);
  }
};
