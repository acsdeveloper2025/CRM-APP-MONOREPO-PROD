import type { Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { loadUserAuthContext, type AuthenticatedRequest } from '@/middleware/auth';
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
 * - BACKEND_USER: Can access all tasks
 * - SUPER_ADMIN: Can access all tasks
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
    const userId = req.user!.id;
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
    let taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : String(rawTaskId || '');

    if (!taskId) {
      const response: ApiResponse = {
        success: false,
        message: 'Task ID is required',
        error: { code: 'INVALID_REQUEST' },
      };
      res.status(400).json(response);
      return;
    }

    // 2026-05-02: accept both UUID and "VT-xxx" task numbers in URL params.
    // Frontend now uses friendly task_number in URLs (matches case-management/:caseId
    // pattern). Resolve VT-xxx → UUID once here so every downstream WHERE vt.id = $1
    // query in this middleware + the routed handler works unchanged.
    if (/^VT-/i.test(taskId)) {
      const resolved = await query<{ id: string }>(
        'SELECT id FROM verification_tasks WHERE task_number = $1 LIMIT 1',
        [taskId]
      );
      if (resolved.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
        return;
      }
      taskId = resolved.rows[0].id;
      req.params.taskId = taskId;
      if (req.params.id !== undefined) {
        req.params.id = taskId;
      }
    }

    if (hasSystemScopeBypass(user)) {
      next();
      return;
    }

    if (isScopedOperationsUser(user)) {
      const taskScopeResult = await query(
        `SELECT vt.id, c.client_id as client_id, c.product_id as product_id
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
        !assignedClientIds.includes(Number(row.clientId)) ||
        !assignedProductIds.includes(Number(row.productId))
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

/**
 * Scope validation for POST /verification-tasks/:taskId/assign.
 *
 * `validateTaskRecordAccess` upstream already verifies the CALLER can
 * see the task. This middleware closes the complementary hole: the
 * body-supplied `assignedTo` target must also have scope that covers
 * the task's (client_id, product_id) pair.
 *
 * Without this check a scoped-ops user with `case.reassign` on their
 * own client scope could reassign a task to a field agent who has no
 * access to that client — creating an orphaned assignment the target
 * cannot open (because requireTaskAccess 403s them on read), and for
 * unscoped field agents it would surface a case outside the
 * business boundary the admin intended.
 *
 * Rules:
 * - Target must exist and be loadable via loadUserAuthContext.
 * - Target with system bypass (SUPER_ADMIN etc.) is always allowed —
 *   they can see everything by construction.
 * - Scoped target must have both the task's client_id in their
 *   assigned_client_ids AND the task's product_id in their
 *   assigned_product_ids. Empty assignment lists fail closed.
 * - Self-assign (assignedTo === caller) is always allowed; the
 *   caller has already passed validateTaskRecordAccess for the same
 *   (client_id, product_id) tuple.
 *
 * Runs after validateTaskRecordAccess in the middleware chain, so
 * we can trust req.params.taskId is a real task the caller can see.
 */
export const validateAssignmentTargetScope = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawTaskId = (req.params.taskId || req.params.id || req.body.taskId || '') as string;
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : String(rawTaskId || '');

    const rawAssignedTo = (req.body as Record<string, unknown> | undefined)?.assignedTo;
    const assignedTo = typeof rawAssignedTo === 'string' ? rawAssignedTo : '';

    if (!taskId || !assignedTo) {
      // Shape errors are the job of validateTaskAssignment upstream;
      // this middleware only runs once those pass.
      next();
      return;
    }

    // Self-assign shortcut — the caller is already scope-cleared for
    // this task by requireTaskAccess, so there's nothing new to check.
    if (req.user?.id === assignedTo) {
      next();
      return;
    }

    // Fetch the task's client + product so we know what the target
    // needs to cover.
    const taskScopeResult = await query<{ clientId: number; productId: number }>(
      `SELECT c.client_id, c.product_id
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

    const { clientId: taskClientId, productId: taskProductId } = taskScopeResult.rows[0];

    // Resolve the target user's scope. loadUserAuthContext caches
    // per-user with a short TTL so repeated reassigns do not thrash
    // the DB.
    const targetContext = await loadUserAuthContext(assignedTo);
    if (!targetContext) {
      res.status(400).json({
        success: false,
        message: 'assignedTo user not found',
        error: { code: 'ASSIGNEE_NOT_FOUND' },
      });
      return;
    }

    // System-bypass target (SUPER_ADMIN etc.) can see everything, so
    // the check is trivially satisfied.
    const targetUserShape = {
      id: targetContext.id,
      permissionCodes: [...targetContext.permissionCodes],
    } as AuthenticatedRequest['user'];
    if (hasSystemScopeBypass(targetUserShape)) {
      next();
      return;
    }

    const targetClientIds = targetContext.assignedClientIds ?? [];
    const targetProductIds = targetContext.assignedProductIds ?? [];

    const coversClient = targetClientIds.includes(Number(taskClientId));
    const coversProduct = targetProductIds.includes(Number(taskProductId));

    if (!coversClient || !coversProduct) {
      logger.warn('Assignment target scope mismatch', {
        callerId: req.user?.id,
        taskId,
        assignedTo,
        taskClientId,
        taskProductId,
        targetClientCount: targetClientIds.length,
        targetProductCount: targetProductIds.length,
        coversClient,
        coversProduct,
      });
      res.status(403).json({
        success: false,
        message: 'assignedTo user does not have access to this task scope',
        error: {
          code: 'ASSIGNEE_SCOPE_DENIED',
          details: {
            missing: [...(coversClient ? [] : ['client']), ...(coversProduct ? [] : ['product'])],
          },
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error in validateAssignmentTargetScope middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
