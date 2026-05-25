// Disabled unbound-method rule for this file as it uses method references in routes
import express from 'express';
import {
  VerificationTasksController,
  exportTasksToExcel,
} from '../controllers/verificationTasksController';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth';
import { getAssignedClientIds, validateCaseAccess } from '@/middleware/clientAccess';
import { getAssignedProductIds, validateCaseProductAccess } from '@/middleware/productAccess';
import {
  validateTaskCreation,
  validateTaskUpdate,
  validateTaskAssignment,
} from '../middleware/taskValidation';
import {
  validateTaskRecordAccess,
  validateAssignmentTargetScope,
} from '../middleware/taskAuthorization';
import { pool, query as dbQuery, wrapClient } from '../config/db';
import { authorize } from '@/middleware/authorize';
import { isScopedOperationsUser } from '@/security/rbacAccess';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '@/middleware/enterpriseCache';
import { TaskCompletionValidator } from '@/services/taskCompletionValidator';
import { CaseStatusSyncService } from '@/services/caseStatusSyncService';
import { createAuditLog } from '@/utils/auditLogger';
import { logger } from '@/utils/logger';

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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
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
 * Export verification tasks to Excel
 * GET /api/verification-tasks/export
 * IMPORTANT: Must come before generic /verification-tasks/:taskId routes
 */
router.get(
  '/verification-tasks/export',
  authenticateToken,
  authorize('case.view'),
  exportTasksToExcel
);

/**
 * 5-card stats for /task-management/* list pages
 * GET /api/verification-tasks/stats
 * IMPORTANT: Must come before generic /verification-tasks/:taskId routes.
 * Cached via EnterpriseCacheConfigs.analytics (req.baseUrl + req.path
 * keyGen — collision-safe across resources per filter-sweep §9.7).
 */
router.get(
  '/verification-tasks/stats',
  authenticateToken,
  authorize('case.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  VerificationTasksController.getStats.bind(VerificationTasksController)
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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
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
  // NM-7 (2026-05-16): synchronous to match all sibling task-mutating
  // routes. Async invalidation had a race window where an immediate
  // re-fetch after PUT could hit stale cache before the setImmediate
  // callback fired.
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  validateTaskRecordAccess,
  validateTaskAssignment,
  // Scope-validate the assignedTo target after shape validation so
  // we only hit the DB when the body is well-formed. See
  // middleware/taskAuthorization.ts for rules (system-bypass pass,
  // self-assign pass, otherwise target must cover task's
  // client_id + product_id).
  validateAssignmentTargetScope,
  VerificationTasksController.assignTask.bind(VerificationTasksController)
);

router.post(
  '/verification-tasks/:taskId/revoke',
  authenticateToken,
  authorize('task.revoke'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  VerificationTasksController.revokeTask.bind(VerificationTasksController)
);

/**
 * Complete a verification task
 * POST /api/verification-tasks/:taskId/complete
 */
router.post(
  '/verification-tasks/:taskId/complete',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
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
  // NM-6: cache invalidation so case detail / dashboard reflect the
  // ASSIGNED → IN_PROGRESS flip immediately. Without this, the handler
  // calls updateTask internally which bypasses the PUT route's
  // middleware → case detail stayed stale until TTL.
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId } = req.params;

      // Defense-in-depth: only ASSIGNED → IN_PROGRESS is a valid transition
      // for /start. Without this guard, updateTask happily moves COMPLETED
      // or REVOKED tasks back to IN_PROGRESS.
      const current = await dbQuery<{ status: string }>(
        'SELECT status FROM verification_tasks WHERE id = $1',
        [taskId]
      );
      const currentStatus = current.rows[0]?.status;
      if (!currentStatus) {
        res.status(404).json({
          success: false,
          message: 'Task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
        return;
      }
      if (!TaskCompletionValidator.canTransition(currentStatus, 'IN_PROGRESS')) {
        res.status(409).json({
          success: false,
          message: `Cannot start task in status ${currentStatus}`,
          error: { code: 'INVALID_STATUS_TRANSITION' },
        });
        return;
      }

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

      // Unified task timeline. Aggregates events from FIVE sources so
      // the operator sees the complete workflow lifecycle (not just
      // assignment events):
      //   1. ASSIGNED rows from task_assignment_history (assignment +
      //      reassignment events)
      //   2. STARTED — synthesized from verification_tasks.started_at
      //      (ASSIGNED → IN_PROGRESS)
      //   3. COMPLETED — synthesized from verification_tasks.completed_at
      //      (IN_PROGRESS → COMPLETED). `extra` carries the
      //      verification_outcome (Positive/Negative/etc).
      //   4. REVOKED rows from task_revocations (PENDING/ASSIGNED/
      //      IN_PROGRESS → REVOKED). `extra` carries the revoke role.
      //   5. REVISIT_CREATED — for each child task with parent_task_id
      //      = this task (COMPLETED → revisit). `extra` carries the
      //      child task_number.
      //
      // Endpoint name kept as /assignment-history for back-compat (only
      // consumer is TaskDetailPage, updated in same commit to render
      // all event types via the new `eventType` field).
      const result = await dbQuery(
        `
        SELECT * FROM (
          SELECT
            tah.id::text AS id,
            'ASSIGNED' AS event_type,
            tah.assigned_at AS event_at,
            tah.assigned_to AS actor_user_id,
            u_to.name AS actor_name,
            tah.assigned_by AS triggered_by_user_id,
            u_by.name AS triggered_by_name,
            tah.task_status_before AS status_before,
            tah.task_status_after AS status_after,
            tah.assignment_reason AS reason,
            NULL::text AS extra
          FROM task_assignment_history tah
          LEFT JOIN users u_to ON tah.assigned_to = u_to.id
          LEFT JOIN users u_by ON tah.assigned_by = u_by.id
          WHERE tah.verification_task_id = $1

          UNION ALL

          SELECT
            vt.id::text || '_started' AS id,
            'STARTED' AS event_type,
            vt.started_at AS event_at,
            vt.assigned_to AS actor_user_id,
            u_a.name AS actor_name,
            NULL::uuid AS triggered_by_user_id,
            NULL::text AS triggered_by_name,
            'ASSIGNED' AS status_before,
            'IN_PROGRESS' AS status_after,
            NULL::text AS reason,
            NULL::text AS extra
          FROM verification_tasks vt
          LEFT JOIN users u_a ON vt.assigned_to = u_a.id
          WHERE vt.id = $1 AND vt.started_at IS NOT NULL

          UNION ALL

          SELECT
            vt.id::text || '_completed' AS id,
            'COMPLETED' AS event_type,
            vt.completed_at AS event_at,
            vt.assigned_to AS actor_user_id,
            u_a.name AS actor_name,
            NULL::uuid AS triggered_by_user_id,
            NULL::text AS triggered_by_name,
            'IN_PROGRESS' AS status_before,
            'COMPLETED' AS status_after,
            NULL::text AS reason,
            vt.verification_outcome AS extra
          FROM verification_tasks vt
          LEFT JOIN users u_a ON vt.assigned_to = u_a.id
          WHERE vt.id = $1 AND vt.completed_at IS NOT NULL

          UNION ALL

          SELECT
            'rev_' || tr.id::text AS id,
            'REVOKED' AS event_type,
            tr.revoked_at AS event_at,
            tr.revoked_from_user_id AS actor_user_id,
            u_from.name AS actor_name,
            tr.revoked_by_user_id AS triggered_by_user_id,
            u_by.name AS triggered_by_name,
            tr.previous_status AS status_before,
            'REVOKED' AS status_after,
            tr.revoke_reason AS reason,
            tr.revoked_by_role::text AS extra
          FROM task_revocations tr
          LEFT JOIN users u_from ON tr.revoked_from_user_id = u_from.id
          LEFT JOIN users u_by ON tr.revoked_by_user_id = u_by.id
          WHERE tr.task_id = $1

          UNION ALL

          SELECT
            child.id::text || '_revisit' AS id,
            'REVISIT_CREATED' AS event_type,
            child.created_at AS event_at,
            child.assigned_to AS actor_user_id,
            u_c.name AS actor_name,
            child.created_by AS triggered_by_user_id,
            u_creator.name AS triggered_by_name,
            'COMPLETED' AS status_before,
            child.status AS status_after,
            NULL::text AS reason,
            child.task_number::text AS extra
          FROM verification_tasks child
          LEFT JOIN users u_c ON child.assigned_to = u_c.id
          LEFT JOIN users u_creator ON child.created_by = u_creator.id
          WHERE child.parent_task_id = $1 AND child.task_type = 'REVISIT'
        ) events
        WHERE event_at IS NOT NULL
        ORDER BY event_at DESC
      `,
        [taskId]
      );

      res.json({
        success: true,
        data: result.rows,
        message: 'Task timeline retrieved successfully',
      });
    } catch (error) {
      logger.error('Failed to get task timeline', { error, taskId: req.params.taskId });
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

      const result = await dbQuery(
        `
        SELECT
          vt.*,
          vtype.name as verification_type_name,
          u_assigned.name as assigned_to_name,
          u_assigned.employee_id as assigned_to_employee_id,
          u_created.name as assigned_by_name,
          u_revoker.name as "revokedByName",
          vt.revocation_reason as "revokeReason",
          rt.name as rate_type_name,
          c.case_id as case_number,
          c.customer_name as customer_name,
          cc.status as commission_status,
          cc.calculated_commission,
          p.code as pincode,
          parent_vt.task_number as "parentTaskNumber",
          parent_vt.completed_at as "parentCompletedAt"
        FROM verification_tasks vt
        LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
        LEFT JOIN users u_assigned ON vt.assigned_to = u_assigned.id
        LEFT JOIN users u_created ON vt.assigned_by = u_created.id
        LEFT JOIN users u_revoker ON vt.revoked_by = u_revoker.id
        LEFT JOIN rate_types rt ON vt.rate_type_id = rt.id
        LEFT JOIN cases c ON vt.case_id = c.id
        LEFT JOIN commission_calculations cc ON vt.id = cc.verification_task_id
        LEFT JOIN pincodes p ON p.id = vt.pincode_id
        LEFT JOIN verification_tasks parent_vt ON parent_vt.id = vt.parent_task_id
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

// M-7: `/verification-tasks/:taskId/cancel` route deleted 2026-05-16.
// It was a back-door revoke that called updateTask with generic dynamic
// SQL, bypassing TaskRevocationService.recordRevocation entirely — no
// task_revocations audit row, no ADMIN_TASK_REVOKED audit log, no
// reason-required validation. FE and mobile only use the canonical
// /revoke route, so this endpoint was dead code that risked an
// audit-trail leak if hit via curl. The /revoke route at line 131 is
// the only supported revocation entry point.

/**
 * Bulk assign multiple tasks
 * POST /api/verification-tasks/bulk-assign
 */
router.post(
  '/verification-tasks/bulk-assign',
  authenticateToken,
  authorize('case.reassign'),
  // NC-3 (2026-05-16): invalidate cache so cases-list / dashboard /
  // case-detail / mobile-sync don't serve stale data for up to 5min
  // TTL after a bulk-assign. Same pattern as single-task /assign.
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskIds, assignedTo, assignmentReason } = req.body;
      const userId = req.user!.id;

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'taskIds array is required',
          error: { code: 'INVALID_INPUT' },
        });
        return;
      }

      if (!assignedTo) {
        res.status(400).json({
          success: false,
          message: 'assignedTo is required',
          error: { code: 'INVALID_INPUT' },
        });
        return;
      }

      if (isScopedOperationsUser(req.user) && req.user?.id) {
        let [assignedClientIds, assignedProductIds] = await Promise.all([
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

        // P14.M-4: narrow by req.activeScope using the same intersection
        // pattern as P13.A. The bulk-assign scope check otherwise treats
        // every assigned client/product as legal — a Demo-Mode-locked
        // user could bulk-assign tasks across the scope boundary.
        if (req.activeScope?.clientId != null) {
          assignedClientIds = assignedClientIds.includes(req.activeScope.clientId)
            ? [req.activeScope.clientId]
            : [-1];
        }
        if (req.activeScope?.productId != null) {
          assignedProductIds = assignedProductIds.includes(req.activeScope.productId)
            ? [req.activeScope.productId]
            : [-1];
        }

        const scopeCheck = await dbQuery(
          `SELECT COUNT(*)::int AS denied_count
           FROM verification_tasks vt
           JOIN cases c ON c.id = vt.case_id
           WHERE vt.id = ANY($1::uuid[])
             AND (
               c.client_id <> ALL($2::int[])
               OR c.product_id <> ALL($3::int[])
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

      const client = wrapClient(await pool.connect());

      try {
        await client.query('BEGIN');

        const updatedTasks = [];

        for (const taskId of taskIds) {
          // Update task assignment
          // Only reassign tasks in PENDING / ASSIGNED state. Prior CASE
          // statement also reset IN_PROGRESS → ASSIGNED, which silently
          // un-started a task an FE was actively working on. Terminal
          // statuses (COMPLETED / REVOKED) are excluded by the WHERE
          // clause and return zero rows for that taskId.
          const result = await client.query(
            `
            UPDATE verification_tasks
            SET
              assigned_to = $1,
              assigned_by = $2,
              assigned_at = NOW(),
              status = 'ASSIGNED',
              updated_at = NOW()
            WHERE id = $3
              AND status IN ('PENDING', 'ASSIGNED')
            RETURNING *
          `,
            [assignedTo, userId, taskId]
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
                // B3 fix: wrapClient at line 408 applies camelizeRow
                // in REPLACE mode, so case_id → caseId and the
                // snake_case key is deleted. Reading task.case_id
                // returned undefined → NOT NULL violation on
                // task_assignment_history.case_id → entire bulk-assign
                // transaction rolled back.
                task.caseId,
                assignedTo,
                userId,
                assignmentReason || 'Bulk assignment',
                task.status,
              ]
            );

            // NC-3: audit-log entry per task in the bulk (compliance trail —
            // who bulk-assigned what, for which case, under what reason).
            await createAuditLog({
              userId,
              action: 'BULK_ASSIGN_TASK',
              entityType: 'VERIFICATION_TASK',
              entityId: taskId,
              details: {
                taskNumber: task.taskNumber,
                caseId: task.caseId,
                assignedTo,
                assignmentReason: assignmentReason || 'Bulk assignment',
                bulkSize: taskIds.length,
              },
            });
          }
        }

        // NC-3: recalc cases.status per distinct case touched. Without
        // this, every affected case stays at its pre-bulk-assign status
        // until any single-task action elsewhere triggers recalc. Runs
        // INSIDE the tx with client arg per the locked rule
        // "caseStatusSyncService is the SINGLE authority on cases.status".
        const distinctCaseIds = Array.from(
          new Set(updatedTasks.map((t: { caseId?: string }) => t.caseId).filter(Boolean))
        );
        for (const caseId of distinctCaseIds) {
          await CaseStatusSyncService.recalculateCaseStatus(String(caseId), client);
        }

        await client.query('COMMIT');

        res.json({
          success: true,
          data: {
            updatedTasksCount: updatedTasks.length,
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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId: _taskId } = req.params;
      const {
        verificationOutcome,
        formData,
        attachments: _attachments,
        geoLocation: _geoLocation,
      } = req.body;

      await VerificationTasksController.completeTask(
        {
          ...req,
          body: {
            verificationOutcome,
            completionNotes: JSON.stringify(formData),
            actualAmount: req.body.actualAmount,
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
