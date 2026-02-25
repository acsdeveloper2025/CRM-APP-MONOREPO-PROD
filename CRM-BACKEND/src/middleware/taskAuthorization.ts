import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { ApiResponse } from '@/types/api';
import { logger } from '@/config/logger';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import {
  hasSystemScopeBypass,
  isFieldExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';

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
    const user = req.user;

    if (!userId || !user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHORIZED' },
      };
      res.status(401).json(response);
      return;
    }

    // Extract taskId from params, body, or nested params
    const rawTaskId = (req.params.taskId || req.params.id || req.body.taskId || '') as string;
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : String(rawTaskId || '');

    if (!taskId) {
      const response: ApiResponse = {
        success: false,
        message: 'Task ID is required',
        error: { code: 'INVALID_REQUEST' },
      };
      res.status(400).json(response);
      return;
    }

    if (hasSystemScopeBypass(user)) {
      next();
      return;
    }

    if (isScopedOperationsUser(user)) {
      const taskScopeResult = await query(
        `SELECT vt.id, c."clientId" as client_id, c."productId" as product_id
         FROM verification_tasks vt
         JOIN cases c ON c.id = vt.case_id
         WHERE vt.id = $1`,
        [taskId]
      );

      if (taskScopeResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
        return;
      }

      const [assignedClientIds, assignedProductIds] = await Promise.all([
        getAssignedClientIds(userId),
        getAssignedProductIds(userId),
      ]);

      const row = taskScopeResult.rows[0];
      if (
        assignedClientIds.length === 0 ||
        assignedProductIds.length === 0 ||
        !assignedClientIds.includes(Number(row.client_id)) ||
        !assignedProductIds.includes(Number(row.product_id))
      ) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          error: { code: 'TASK_SCOPE_ACCESS_DENIED' },
        });
        return;
      }

      next();
      return;
    }

    if (isFieldExecutionActor(user)) {
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
          permissionCodes: user.permissionCodes,
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

    logger.error('User profile could not be classified for task access check', {
      userId,
      permissionCodes: user.permissionCodes,
      taskId,
    });

    const response: ApiResponse = {
      success: false,
      message: 'Task access profile not recognized',
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

export const validateTaskRecordAccess = requireTaskAccess;
