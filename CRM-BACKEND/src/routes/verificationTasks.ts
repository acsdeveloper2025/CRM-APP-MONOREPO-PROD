// Disabled unbound-method rule for this file as it uses method references in routes
import express from 'express';
import { VerificationTasksController } from '../controllers/verificationTasksController';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth';
import { getAssignedClientIds, validateCaseAccess } from '@/middleware/clientAccess';
import { getAssignedProductIds, validateCaseProductAccess } from '@/middleware/productAccess';
import {
  validateTaskCreation,
  validateTaskUpdate,
  validateTaskAssignment,
} from '../middleware/taskValidation';
import { validateTaskRecordAccess } from '../middleware/taskAuthorization';
import { pool } from '../config/db';
import { authorize } from '@/middleware/authorize';
import { isScopedOperationsUser } from '@/security/rbacAccess';

const router = express.Router();

// =====================================================
// VERIFICATION TASKS ROUTES
// =====================================================

/**
 * Get all verification tasks across all cases with filtering
 * GET /api/verification-tasks
 * Query params: page, limit, sortBy, sortOrder, status, priority, assignedTo,
 *               verificationTypeId, clientId, productId, search, dateFrom, dateTo
 */
router.get(
  '/verification-tasks',
  authenticateToken,
  authorize('case.view'),
  VerificationTasksController.getAllTasks.bind(VerificationTasksController)
);

/**
 * Create multiple verification tasks for a case
 * POST /api/cases/:caseId/verification-tasks
 */
router.post(
  '/cases/:caseId/verification-tasks',
  authenticateToken,
  authorize('case.assign'),
  validateCaseAccess,
  validateCaseProductAccess,
  validateTaskCreation,
  VerificationTasksController.createMultipleTasksForCase.bind(VerificationTasksController)
);

/**
 * Get all verification tasks for a case
 * GET /api/cases/:caseId/verification-tasks
 * Query params: status, assigned_to, verification_type_id
 */
router.get(
  '/cases/:caseId/verification-tasks',
  authenticateToken,
  authorize('case.view'),
  validateCaseAccess,
  validateCaseProductAccess,
  VerificationTasksController.getTasksForCase.bind(VerificationTasksController)
);

/**
 * Create a revisit task from an existing completed task
 * POST /api/verification-tasks/revisit/:taskId
 * IMPORTANT: Must come before generic /verification-tasks/:taskId routes
 */
router.post(
  '/verification-tasks/revisit/:taskId',
  authenticateToken,
  authorize('visit.revisit', { ownership: 'task' }),
  VerificationTasksController.revisitTask.bind(VerificationTasksController)
);

/**
 * Update a verification task
 * PUT /api/verification-tasks/:taskId
 */
router.put(
  '/verification-tasks/:taskId',
  authenticateToken,
  authorize('case.update'),
  validateTaskRecordAccess,
  validateTaskUpdate,
  VerificationTasksController.updateTask.bind(VerificationTasksController)
);

/**
 * Assign or reassign a verification task
 * POST /api/verification-tasks/:taskId/assign
 */
router.post(
  '/verification-tasks/:taskId/assign',
  authenticateToken,
  authorize('case.reassign'),
  validateTaskRecordAccess,
  validateTaskAssignment,
  VerificationTasksController.assignTask.bind(VerificationTasksController)
);

/**
 * Complete a verification task
 * POST /api/verification-tasks/:taskId/complete
 */
router.post(
  '/verification-tasks/:taskId/complete',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  VerificationTasksController.completeTask.bind(VerificationTasksController)
);

/**
 * Validate a verification task
 * GET /api/verification-tasks/:taskId/validate
 * Checks if a COMPLETED task has all required data
 */
router.get(
  '/verification-tasks/:taskId/validate',
  authenticateToken,
  authorize('case.view'),
  validateTaskRecordAccess,
  VerificationTasksController.validateTask.bind(VerificationTasksController)
);

/**
 * Start working on a verification task (for mobile)
 * POST /api/verification-tasks/:taskId/start
 */
router.post(
  '/verification-tasks/:taskId/start',
  authenticateToken,
  authorize('visit.start', { ownership: 'task' }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId: _taskId } = req.params;
      const _userId = req.user?.id;

      // Update task status to IN_PROGRESS and set started_at
      await VerificationTasksController.updateTask(
        {
          ...req,
          body: { status: 'IN_PROGRESS', startedAt: new Date().toISOString() },
        } as AuthenticatedRequest,
        res
      );
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to start task',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
);

/**
 * Get task assignment history
 * GET /api/verification-tasks/:taskId/assignment-history
 */
router.get(
  '/verification-tasks/:taskId/assignment-history',
  authenticateToken,
  authorize('case.view'),
  validateTaskRecordAccess,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId } = req.params;

      const result = await pool.query(
        `
        SELECT 
          tah.*,
          u_to.name as assigned_to_name,
          u_by.name as assigned_by_name,
          u_from.name as assigned_from_name
        FROM task_assignment_history tah
        LEFT JOIN users u_to ON tah.assigned_to = u_to.id
        LEFT JOIN users u_by ON tah.assigned_by = u_by.id
        LEFT JOIN users u_from ON tah.assigned_from = u_from.id
        WHERE tah.verification_task_id = $1
        ORDER BY tah.assigned_at DESC
      `,
        [taskId]
      );

      res.json({
        success: true,
        data: result.rows,
        message: 'Assignment history retrieved successfully',
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get assignment history',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
);

/**
 * Get verification task by ID
 * GET /api/verification-tasks/:taskId
 */
router.get(
  '/verification-tasks/:taskId',
  authenticateToken,
  authorize('case.view'),
  validateTaskRecordAccess,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId } = req.params;

      const result = await pool.query(
        `
        SELECT 
          vt.*,
          vtype.name as verification_type_name,
          u_assigned.name as assigned_to_name,
          u_assigned."employeeId" as assigned_to_employee_id,
          u_created.name as assigned_by_name,
          rt.name as rate_type_name,
          c."caseId" as case_number,
          c."customerName" as customer_name,
          tcc.status as commission_status,
          tcc.calculated_commission
        FROM verification_tasks vt
        LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
        LEFT JOIN users u_assigned ON vt.assigned_to = u_assigned.id
        LEFT JOIN users u_created ON vt.assigned_by = u_created.id
        LEFT JOIN "rateTypes" rt ON vt.rate_type_id = rt.id
        LEFT JOIN cases c ON vt.case_id = c.id
        LEFT JOIN task_commission_calculations tcc ON vt.id = tcc.verification_task_id
        WHERE vt.id = $1
      `,
        [taskId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Verification task retrieved successfully',
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get verification task',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
);

/**
 * Cancel a verification task
 * POST /api/verification-tasks/:taskId/cancel
 */
router.post(
  '/verification-tasks/:taskId/cancel',
  authenticateToken,
  authorize('visit.revoke', { ownership: 'task' }),
  validateTaskRecordAccess,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId: _taskId } = req.params;
      const { cancellation_reason } = req.body;
      const userId = req.user?.id;

      await VerificationTasksController.updateTask(
        {
          ...req,
          body: {
            status: 'REVOKED',
            // eslint-disable-next-line camelcase
            revocationReason: cancellation_reason,
            revokedAt: new Date().toISOString(),
            revokedBy: userId,
          },
        } as AuthenticatedRequest,
        res
      );
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to cancel task',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
);

/**
 * Bulk assign multiple tasks
 * POST /api/verification-tasks/bulk-assign
 */
router.post(
  '/verification-tasks/bulk-assign',
  authenticateToken,
  authorize('case.reassign'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { task_ids: taskIds, assigned_to, assignment_reason } = req.body;
      const userId = req.user?.id;

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'task_ids array is required',
          error: { code: 'INVALID_INPUT' },
        });
        return;
      }

      // eslint-disable-next-line camelcase
      if (!assigned_to) {
        res.status(400).json({
          success: false,
          message: 'assigned_to is required',
          error: { code: 'INVALID_INPUT' },
        });
        return;
      }

      if (isScopedOperationsUser(req.user) && req.user?.id) {
        const [assignedClientIds, assignedProductIds] = await Promise.all([
          getAssignedClientIds(req.user.id),
          getAssignedProductIds(req.user.id),
        ]);

        if (
          !assignedClientIds ||
          !assignedProductIds ||
          assignedClientIds.length === 0 ||
          assignedProductIds.length === 0
        ) {
          res.status(403).json({
            success: false,
            message: 'Access denied',
            error: { code: 'TASK_SCOPE_ACCESS_DENIED' },
          });
          return;
        }

        const scopeCheck = await pool.query(
          `SELECT COUNT(*)::int AS denied_count
           FROM verification_tasks vt
           JOIN cases c ON c.id = vt.case_id
           WHERE vt.id = ANY($1::uuid[])
             AND (
               c."clientId" <> ALL($2::int[])
               OR c."productId" <> ALL($3::int[])
             )`,
          [taskIds, assignedClientIds, assignedProductIds]
        );

        if (Number(scopeCheck.rows[0]?.denied_count || 0) > 0) {
          res.status(403).json({
            success: false,
            message: 'One or more tasks are outside your assigned client/product scope',
            error: { code: 'TASK_SCOPE_ACCESS_DENIED' },
          });
          return;
        }
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const updatedTasks = [];

        for (const taskId of taskIds) {
          // Update task assignment
          const result = await client.query(
            `
            UPDATE verification_tasks 
            SET 
              assigned_to = $1,
              assigned_by = $2,
              assigned_at = NOW(),
              status = CASE 
                WHEN status = 'PENDING' THEN 'ASSIGNED'
                WHEN status = 'COMPLETED' OR status = 'REVOKED' THEN status
                ELSE 'ASSIGNED'
              END,
              updated_at = NOW()
            WHERE id = $3
            RETURNING *
          `,
            // eslint-disable-next-line camelcase
            [assigned_to, userId, taskId]
          );

          if (result.rows.length > 0) {
            const task = result.rows[0];
            updatedTasks.push(task);

            // Create assignment history
            await client.query(
              `
              INSERT INTO task_assignment_history (
                verification_task_id, case_id, assigned_to, assigned_by,
                assignment_reason, task_status_after
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `,
              [
                taskId,
                task.case_id,
                // eslint-disable-next-line camelcase
                assigned_to,
                userId,
                // eslint-disable-next-line camelcase
                assignment_reason || 'Bulk assignment',
                task.status,
              ]
            );
          }
        }

        await client.query('COMMIT');

        res.json({
          success: true,
          data: {
            updated_tasks: updatedTasks.length,
            tasks: updatedTasks,
          },
          message: `${updatedTasks.length} tasks assigned successfully`,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to bulk assign tasks',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
);

// =====================================================
// MOBILE API ROUTES
// =====================================================

/**
 * Get tasks assigned to current user (for mobile app)
 * GET /api/mobile/my-verification-tasks
 */
router.get(
  '/mobile/my-verification-tasks',
  authenticateToken,
  authorize('visit.start'),
  VerificationTasksController.getMyTasks.bind(VerificationTasksController)
);

/**
 * Submit verification for a task (mobile)
 * POST /api/mobile/verification-tasks/:taskId/submit
 */
router.post(
  '/mobile/verification-tasks/:taskId/submit',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId: _taskId } = req.params;
      const {
        verification_outcome,
        form_data,
        attachments: _attachments,
        // eslint-disable-next-line camelcase
        geo_location: _geo_location,
      } = req.body;

      // This would integrate with the existing form submission system
      // For now, we'll just complete the task
      await VerificationTasksController.completeTask(
        {
          ...req,
          body: {
            verification_outcome,
            completion_notes: JSON.stringify(form_data),
            actual_amount: req.body.actual_amount,
          },
        } as AuthenticatedRequest,
        res
      );
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to submit verification',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
);

export default router;
