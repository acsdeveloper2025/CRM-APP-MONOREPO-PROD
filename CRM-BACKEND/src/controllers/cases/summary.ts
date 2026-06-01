import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../config/database';
import { isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';

/**
 * Get case summary with verification tasks
 * GET /api/cases/:id/summary
 *
 * Extracted verbatim from casesController as part of the §7 decomposition.
 * Behaviour is pinned by caseSummary.integration.test.ts — including the
 * known quirks (camelCase-mapped `data.case`; taskSummary.cancelledTasks /
 * onHoldTasks read columns the SQL never selects -> null; no uuid validator
 * on the route so a non-uuid id surfaces as 500). Do NOT "fix" those here —
 * that is a separate, visible change.
 */
export const getCaseSummaryWithTasks = async (req: AuthenticatedRequest, res: Response) => {
  const rawCaseId = req.params.id;
  const caseId = Array.isArray(rawCaseId) ? String(rawCaseId[0]) : String(rawCaseId || '');

  try {
    // Get case information
    const caseResult = await dbQuery(
      `
      SELECT
        c.*,
        cl.name as client_name,
        p.name as product_name,
        u.name as created_by_name
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN users u ON c.created_by_backend_user = u.id
      WHERE c.id = $1
    `,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'CASE_NOT_FOUND' },
      });
    }

    const caseInfo = caseResult.rows[0];

    // P13.B — active scope intersection. When the user has locked scope to
    // a specific client/product, reject access to cases outside that scope
    // before the baseline assignment check.
    if (
      req.activeScope?.clientId != null &&
      req.activeScope.clientId !== Number(caseInfo.clientId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Case is outside your active scope',
        error: { code: 'CASE_NOT_IN_ACTIVE_SCOPE' },
      });
    }
    if (
      req.activeScope?.productId != null &&
      req.activeScope.productId !== Number(caseInfo.productId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Case product is outside your active scope',
        error: { code: 'CASE_NOT_IN_ACTIVE_SCOPE' },
      });
    }

    if (isScopedOperationsUser(req.user) && req.user?.id) {
      const scopedUserIds = await getScopedOperationalUserIds(req.user.id);
      if (scopedUserIds) {
        const scopeCheck = await dbQuery(
          `SELECT 1
           FROM cases c
           LEFT JOIN verification_tasks vt ON vt.case_id = c.id
           WHERE c.id = $1
             AND (
               c.created_by_backend_user = ANY($2::uuid[]) OR
               EXISTS (SELECT 1 FROM verification_tasks vt_scope WHERE vt_scope.case_id = c.id AND vt_scope.assigned_to = ANY($2::uuid[])) OR
               vt.assigned_to = ANY($2::uuid[])
             )
           LIMIT 1`,
          [caseId, scopedUserIds]
        );
        if (scopeCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied',
            error: { code: 'CASE_ACCESS_DENIED' },
          });
        }
      } else {
        const { getAssignedClientIds } = await import('@/middleware/clientAccess');
        const { getAssignedProductIds } = await import('@/middleware/productAccess');
        const [assignedClientIds, assignedProductIds] = await Promise.all([
          getAssignedClientIds(req.user.id),
          getAssignedProductIds(req.user.id),
        ]);

        if (
          !assignedClientIds ||
          !assignedProductIds ||
          assignedClientIds.length === 0 ||
          assignedProductIds.length === 0 ||
          !assignedClientIds.includes(Number(caseInfo.clientId)) ||
          !assignedProductIds.includes(Number(caseInfo.productId))
        ) {
          return res.status(403).json({
            success: false,
            message: 'Access denied',
            error: { code: 'CASE_ACCESS_DENIED' },
          });
        }
      }
    }

    // Get task summary
    const taskSummaryResult = await dbQuery(
      `
      SELECT
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END) as assigned_tasks,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'REVOKED' THEN 1 END) as revoked_tasks
      FROM verification_tasks
      WHERE case_id = $1
    `,
      [caseId]
    );

    const taskSummary = taskSummaryResult.rows[0];

    // Get financial summary
    const financialSummaryResult = await dbQuery(
      `
      SELECT
        COALESCE(SUM(estimated_amount), 0) as total_estimated_amount,
        COALESCE(SUM(actual_amount), 0) as total_actual_amount,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN actual_amount ELSE 0 END), 0) as completed_amount,
        COALESCE(SUM(CASE WHEN status != 'COMPLETED' AND status != 'REVOKED' THEN estimated_amount ELSE 0 END), 0) as pending_amount
      FROM verification_tasks
      WHERE case_id = $1
    `,
      [caseId]
    );

    const financialSummary = financialSummaryResult.rows[0];

    // Get commission summary
    const commissionSummaryResult = await dbQuery(
      `
      SELECT
        COALESCE(SUM(calculated_commission), 0) as total_commission,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN calculated_commission ELSE 0 END), 0) as paid_commission,
        COALESCE(SUM(CASE WHEN status IN ('PENDING','APPROVED','HOLD') THEN calculated_commission ELSE 0 END), 0) as pending_commission
      FROM commission_calculations
      WHERE case_id = $1
    `,
      [caseId]
    );

    const commissionSummary = commissionSummaryResult.rows[0];

    // Get recent activities
    const recentActivitiesResult = await dbQuery(
      `
      SELECT
        'TASK_CREATED' as type,
        vt.id as task_id,
        vt.task_title,
        u.name as user_name,
        vt.created_at as timestamp,
        NULL as details
      FROM verification_tasks vt
      LEFT JOIN users u ON vt.created_by = u.id
      WHERE vt.case_id = $1

      UNION ALL

      SELECT
        'TASK_ASSIGNED' as type,
        tah.verification_task_id as task_id,
        vt.task_title,
        u.name as user_name,
        tah.assigned_at as timestamp,
        json_build_object('assigned_to', u_assigned.name, 'reason', tah.assignment_reason) as details
      FROM task_assignment_history tah
      JOIN verification_tasks vt ON tah.verification_task_id = vt.id
      LEFT JOIN users u ON tah.assigned_by = u.id
      LEFT JOIN users u_assigned ON tah.assigned_to = u_assigned.id
      WHERE tah.case_id = $1

      UNION ALL

      SELECT
        'TASK_COMPLETED' as type,
        vt.id as task_id,
        vt.task_title,
        u.name as user_name,
        vt.completed_at as timestamp,
        json_build_object('outcome', vt.verification_outcome, 'amount', vt.actual_amount) as details
      FROM verification_tasks vt
      LEFT JOIN users u ON vt.assigned_to = u.id
      WHERE vt.case_id = $1 AND vt.status = 'COMPLETED'

      ORDER BY timestamp DESC
      LIMIT 50
    `,
      [caseId]
    );

    res.json({
      success: true,
      data: {
        case: {
          id: caseInfo.id,
          caseNumber: caseInfo.caseId,
          customerName: caseInfo.customerName,
          customerPhone: caseInfo.customerPhone,
          customerEmail: caseInfo.customerEmail,
          clientName: caseInfo.clientName,
          productName: caseInfo.productName,
          status: caseInfo.status,
          priority: caseInfo.priority,
          address: caseInfo.address,
          pincode: caseInfo.pincode,
          hasMultipleTasks: caseInfo.hasMultipleTasks,
          totalTasksCount: parseInt(caseInfo.totalTasksCount || '0'),
          completedTasksCount: parseInt(caseInfo.completedTasksCount || '0'),
          caseCompletionPercentage: parseFloat(caseInfo.caseCompletionPercentage || '0'),
          createdAt: caseInfo.createdAt,
          createdByName: caseInfo.createdByName,
        },
        taskSummary: {
          totalTasks: parseInt(taskSummary.totalTasks),
          pendingTasks: parseInt(taskSummary.pendingTasks),
          assignedTasks: parseInt(taskSummary.assignedTasks),
          inProgressTasks: parseInt(taskSummary.inProgressTasks),
          completedTasks: parseInt(taskSummary.completedTasks),
          cancelledTasks: parseInt(taskSummary.cancelledTasks),
          onHoldTasks: parseInt(taskSummary.onHoldTasks),
        },
        financialSummary: {
          totalEstimatedAmount: parseFloat(financialSummary.totalEstimatedAmount),
          totalActualAmount: parseFloat(financialSummary.totalActualAmount),
          completedAmount: parseFloat(financialSummary.completedAmount),
          pendingAmount: parseFloat(financialSummary.pendingAmount),
          totalCommission: parseFloat(commissionSummary.totalCommission),
          paidCommission: parseFloat(commissionSummary.paidCommission),
          pendingCommission: parseFloat(commissionSummary.pendingCommission),
        },
        recentActivities: recentActivitiesResult.rows,
      },
      message: 'Case summary retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting case summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get case summary',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
