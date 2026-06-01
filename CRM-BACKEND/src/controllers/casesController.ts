import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query as dbQuery } from '../config/database';
import ExcelJS from 'exceljs';
import { QueryParams } from '../types/database';
import { CacheKeys, invalidateCachePatterns } from '../services/enterpriseCacheService';
import { isScopedOperationsUser } from '@/security/rbacAccess';
import { checkEditable, buildEditBlockedResponse } from '@/utils/editLockGuard';
import { createAuditLog } from '../utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

// Case-list WHERE-builder + sort/limit constants live in ./cases/queryBuilder.
// Re-exported nowhere — imported directly by the list/stats/export handlers below.
import {
  CASE_EXPORT_ROW_LIMIT,
  CASE_SORT_MAP,
  buildCasesBaseWhereClause,
} from './cases/queryBuilder';

// Mock data removed - using database operations only

// Multer upload config for case-creation attachments lives in ./cases/upload.
// Re-exported here so routes/cases.ts keeps importing it from this controller.
export { uploadForCaseCreation } from './cases/upload';

// The /create body-normalize middleware + express-validator chain live in
// ./cases/createValidation. Re-exported so routes/cases.ts keeps importing
// them from this controller.
export { normalizeCaseCreationBody, createCaseValidation } from './cases/createValidation';

// GET /api/cases (getCases) lives in ./cases/getCases.
export { getCases } from './cases/getCases';

/**
 * Canonical 5-card stats endpoint for /case-management/* pages.
 * GET /api/cases/stats
 *
 * Mirrors the getCases inline statistics shape but ignores the caller's
 * `status` filter (returns partition counters for ALL statuses scoped
 * by the user's other filters). Each FE list page picks 5 from this
 * shape (AllCases / InProgressCases / CompletedCases).
 */
export const getCaseStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const where = await buildCasesBaseWhereClause(req);
    const whereClause =
      where.baseConditions.length > 0 ? `WHERE ${where.baseConditions.join(' AND ')}` : '';

    const result = await dbQuery(
      `
      SELECT
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'PENDING') as pending,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ASSIGNED') as assigned,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'IN_PROGRESS') as "inProgress",
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLETED') as completed,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'REVOKED') as revoked,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status IN ('PENDING','ASSIGNED','IN_PROGRESS')
        ) as open,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.priority IN ('HIGH', 'URGENT')
        ) as "highPriority",
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status NOT IN ('COMPLETED','REVOKED')
          AND c.created_at < NOW() - INTERVAL '3 days'
        ) as "longRunning",
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status NOT IN ('COMPLETED','REVOKED','CANCELLED')
          AND c.created_at < NOW() - INTERVAL '48 hours'
        ) as overdue,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status = 'COMPLETED' AND c.completed_at >= CURRENT_DATE
        ) as "completedToday",
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status = 'COMPLETED'
          AND c.completed_at >= date_trunc('week', CURRENT_DATE)
        ) as "completedThisWeek",
        -- Field agents vs KYC verifiers are SEPARATE roles — track both.
        -- Truthful-sweep 2026-05-26: user flagged that agent counts were
        -- including KYC verifiers. task_type_enum is {NORMAL, REVISIT,
        -- KYC} — field tasks are NORMAL or REVISIT.
        COUNT(DISTINCT vt.assigned_to) FILTER (
          WHERE c.status = 'IN_PROGRESS' AND vt.assigned_to IS NOT NULL
            AND vt.task_type <> 'KYC'
        ) as "activeAgentsInProgress",
        COUNT(DISTINCT vt.assigned_to) FILTER (
          WHERE vt.assigned_to IS NOT NULL AND vt.task_type <> 'KYC'
        ) as "activeAgentsAny",
        COUNT(DISTINCT vt.assigned_to) FILTER (
          WHERE vt.assigned_to IS NOT NULL AND vt.task_type = 'KYC'
        ) as "activeKycVerifiers",
        AVG(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400) FILTER (
          WHERE c.status IN ('PENDING','ASSIGNED')
        ) as "avgPendingDays",
        AVG(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400) FILTER (
          WHERE c.status = 'IN_PROGRESS'
        ) as "avgInProgressDays",
        AVG(EXTRACT(EPOCH FROM (c.completed_at - c.created_at)) / 86400) FILTER (
          WHERE c.status = 'COMPLETED'
        ) as "avgTATDays"
      FROM cases c
      LEFT JOIN verification_tasks vt ON c.id = vt.case_id
      ${whereClause}
    `,
      where.baseParams
    );

    const row = result.rows[0] || {};
    const num = (key: string): number => parseInt(row[key] || '0', 10);
    const flt = (key: string): number => parseFloat(row[key] || '0');

    res.json({
      success: true,
      data: {
        total: num('total'),
        pending: num('pending'),
        assigned: num('assigned'),
        inProgress: num('inProgress'),
        completed: num('completed'),
        revoked: num('revoked'),
        open: num('open'),
        highPriority: num('highPriority'),
        longRunning: num('longRunning'),
        overdue: num('overdue'),
        completedToday: num('completedToday'),
        completedThisWeek: num('completedThisWeek'),
        activeAgentsInProgress: num('activeAgentsInProgress'),
        activeAgentsAny: num('activeAgentsAny'),
        activeKycVerifiers: num('activeKycVerifiers'),
        avgPendingDays: flt('avgPendingDays'),
        avgInProgressDays: flt('avgInProgressDays'),
        avgTATDays: flt('avgTATDays'),
      },
      message: 'Case stats retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting case stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get case stats',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/cases/:id (getCaseById) lives in ./cases/getCaseById.
export { getCaseById } from './cases/getCaseById';

// POST /api/cases - Create new case (OLD - REMOVED)
// Replaced by unified createCase endpoint at the end of this file

// PUT /api/cases/:id - Update case
export const updateCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');
    // Cases are bound to their client/product at creation. Re-tenanting
    // an existing case has no legitimate business flow and was a
    // cross-tenant data-integrity exploit (audit P23 commit, 2026-05-15:
    // a multi-client BACKEND_USER could PUT body={clientId:<other_assigned>}
    // with no active scope and silently move a case between her assigned
    // banks). The FE edit form pre-fills clientId/productId and re-sends
    // them only because the same component renders both create and edit;
    // they're noise on PUT. Strip them here so even a malicious or
    // mis-built client cannot mutate the tenancy of an existing case.
    const {
      customerName,
      customerPhone,
      customerCallingCode,
      verificationTypeId,
      pincode,
      priority,
      trigger,
      applicantType,
      backendContactNumber,
      assignedToId, // Task-level field
      rateTypeId, // Task-level field
      address, // Task-level field
      taskId, // ✅ Specific task ID to update
    } = req.body;

    logger.info('🔍 updateCase called', {
      caseId: id,
      taskId,
      userId: req.user?.id,
      receivedFields: {
        assignedToId,
        rateTypeId,
        address,
        customerName,
      },
    });

    // IN_PROGRESS edit-lock — see project_in_progress_edit_lock_audit_2026_05_24.md.
    // Pre-fix, case-level fields (customerName, customerPhone, pincode,
    // priority, trigger, applicantType, backendContactNumber, verificationTypeId)
    // mutated freely while the case was being verified — operators could
    // change the customer name mid-verification, breaking the audit trail
    // and causing field-agent confusion. The legacy work-order lock at
    // line ~1382 only covered task-level fields (rateTypeId/address) so
    // direct API callers bypassed it for everything else.
    const statusRow = await dbQuery<{ status: string }>(`SELECT status FROM cases WHERE id = $1`, [
      id,
    ]);
    if (statusRow.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    const caseEditCheck = checkEditable(statusRow.rows[0].status);
    // Reassignment of a task (assignedToId only, no other field) is an
    // exception — it stays allowed because the reassignment flow operates
    // on REVOKED → ASSIGNED transitions and is the only legitimate way to
    // re-route a stuck verification. All other mutations are blocked.
    const isAssignmentOnly =
      assignedToId !== undefined &&
      customerName === undefined &&
      customerPhone === undefined &&
      customerCallingCode === undefined &&
      verificationTypeId === undefined &&
      pincode === undefined &&
      priority === undefined &&
      trigger === undefined &&
      applicantType === undefined &&
      backendContactNumber === undefined &&
      rateTypeId === undefined &&
      address === undefined;
    if (!caseEditCheck.editable && !isAssignmentOnly) {
      logger.warn('⚠️ Rejected Case update — IN_PROGRESS/terminal status', {
        caseId: id,
        currentStatus: statusRow.rows[0].status,
        userId: req.user?.id,
      });
      return res.status(409).json(buildEditBlockedResponse('Case', caseEditCheck));
    }

    // Build dynamic update query for cases table
    const updateFields: string[] = [];
    const values: QueryParams = [];
    let paramIndex = 1;

    if (customerName !== undefined) {
      updateFields.push(`customer_name = $${paramIndex}`);
      values.push(customerName);
      paramIndex++;
    }
    if (customerPhone !== undefined) {
      updateFields.push(`customer_phone = $${paramIndex}`);
      values.push(customerPhone);
      paramIndex++;
    }
    if (customerCallingCode !== undefined) {
      updateFields.push(`customer_calling_code = $${paramIndex}`);
      values.push(customerCallingCode);
      paramIndex++;
    }
    // (clientId / productId intentionally NOT applied — see strip note above.)
    if (verificationTypeId !== undefined) {
      updateFields.push(`verification_type_id = $${paramIndex}`);
      values.push(verificationTypeId);
      paramIndex++;
    }
    // `pincode` is intentionally NOT applied on the cases table — the
    // column doesn't exist there (it lives on verification_tasks as
    // pincode_id FK). Pre-fix the controller unconditionally appended
    // `pincode = $N` if the field was present in the body, which 500'd
    // every Edit-from-task save once the FE form populated `pincode`
    // from the loaded task data. The body is destructured for the
    // task-level pipeline only (NOT applied here on cases).
    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;
    }
    if (trigger !== undefined) {
      updateFields.push(`trigger = $${paramIndex}`);
      values.push(trigger);
      paramIndex++;
    }
    if (applicantType !== undefined) {
      updateFields.push(`applicant_type = $${paramIndex}`);
      values.push(applicantType);
      paramIndex++;
    }
    if (backendContactNumber !== undefined) {
      updateFields.push(`backend_contact_number = $${paramIndex}`);
      values.push(backendContactNumber);
      paramIndex++;
    }

    if (updateFields.length === 0 && !assignedToId && !rateTypeId && !address) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
        error: { code: 'NO_UPDATE_FIELDS' },
      });
    }

    // Update cases table if there are case-level fields
    if (updateFields.length > 0) {
      // Always update the updatedAt timestamp
      updateFields.push(`updated_at = NOW()`);

      // Add case ID as the last parameter (UUID, not numeric caseId)
      values.push(id);

      const updateQuery = `
        UPDATE cases
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      logger.info('📝 Executing cases table update', {
        query: updateQuery,
        values: values.map((v, i) => `$${i + 1} = ${JSON.stringify(v)}`),
      });

      const result = await dbQuery(updateQuery, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'NOT_FOUND' },
        });
      }
    }

    // Update verification task if task-level fields are provided
    if (assignedToId !== undefined || rateTypeId !== undefined || address !== undefined) {
      // Work Order Protection for Case-driven updates
      // If we are updating address or rateTypeId, we MUST check if the target task is locked
      if (rateTypeId !== undefined || address !== undefined) {
        const targetTaskId = taskId; // Should be provided, but might check caseId if not

        let lockCheckQuery = '';
        let lockCheckParams: (string | number)[] = [];

        if (targetTaskId) {
          lockCheckQuery = 'SELECT status, started_at FROM verification_tasks WHERE id = $1';
          lockCheckParams = [targetTaskId];
        } else {
          // If no taskId, we check ALL tasks for this case (risky, but safe default)
          lockCheckQuery = 'SELECT status, started_at FROM verification_tasks WHERE case_id = $1';
          lockCheckParams = [id]; // id is likely UUID here based on previous code, but let's be careful.
          // Actually updateCase uses `id` from params which is sometimes caseId (int) or uuid.
          // The helper above `actualCaseId` logic isn't here, updateCase relies on what it gets.
          // However, line 884 uses `id` directly.
          // Wait, casesController updateCase usually takes UUID or handles it.
          // Looking at line 879: `values.push(id)`.
        }

        const lockCheckResult = await dbQuery(lockCheckQuery, lockCheckParams);

        const hasLockedTask = lockCheckResult.rows.some(
          t =>
            t.status === 'IN_PROGRESS' ||
            t.status === 'COMPLETED' ||
            t.status === 'REVOKED' ||
            t.startedAt !== null
        );

        if (hasLockedTask) {
          logger.warn('⚠️ Rejected Case update due to locked operational fields', {
            caseId: id,
            taskId,
            userId: req.user?.id,
            attemptedFields: { rateTypeId, address },
          });

          return res.status(409).json({
            success: false,
            message: 'Verification already started. Task data cannot be modified.',
            error: { code: 'TASK_LOCKED' },
          });
        }
      }

      logger.info('🎯 Updating verification task', {
        caseId: id,
        taskId,
        assignedToId,
        rateTypeId,
        address,
      });

      const taskUpdateFields: string[] = [];
      const taskValues: QueryParams = [];
      let taskParamIndex = 1;

      if (assignedToId !== undefined) {
        taskUpdateFields.push(`assigned_to = $${taskParamIndex}`);
        taskValues.push(assignedToId || null);
        taskParamIndex++;

        // If assigning, update status and timestamps
        if (assignedToId) {
          taskUpdateFields.push(`status = $${taskParamIndex}`);
          taskValues.push('ASSIGNED');
          taskParamIndex++;

          taskUpdateFields.push(`assigned_at = NOW()`);
          taskUpdateFields.push(`assigned_by = $${taskParamIndex}`);
          taskValues.push(req.user?.id);
          taskParamIndex++;
        }
      }

      if (rateTypeId !== undefined) {
        taskUpdateFields.push(`rate_type_id = $${taskParamIndex}`);
        taskValues.push(rateTypeId ? parseInt(rateTypeId) : null);
        taskParamIndex++;
      }

      if (address !== undefined) {
        taskUpdateFields.push(`address = $${taskParamIndex}`);
        taskValues.push(address);
        taskParamIndex++;
      }

      if (taskUpdateFields.length > 0) {
        taskUpdateFields.push(`updated_at = NOW()`);

        // ✅ CRITICAL FIX: Use taskId if provided, otherwise fall back to caseId
        // This ensures we update the specific task being edited, not all tasks for the case
        const whereClause = taskId ? `id = $${taskParamIndex}` : `case_id = $${taskParamIndex}`;

        taskValues.push(taskId || id);

        const taskUpdateQuery = `
          UPDATE verification_tasks
          SET ${taskUpdateFields.join(', ')}
          WHERE ${whereClause}
          RETURNING *
        `;

        logger.info('📝 Executing verification_tasks table update', {
          query: taskUpdateQuery,
          values: taskValues.map((v, i) => `$${i + 1} = ${JSON.stringify(v)}`),
          whereClause,
          taskId,
        });

        const taskResult = await dbQuery(taskUpdateQuery, taskValues);

        logger.info('✅ Verification task update result', {
          rowsAffected: taskResult.rowCount,
          updatedTask: taskResult.rows[0]
            ? {
                id: taskResult.rows[0].id,
                status: taskResult.rows[0].status,
                assignedTo: taskResult.rows[0].assignedTo,
                rateTypeId: taskResult.rows[0].rateTypeId,
              }
            : null,
        });
      }
    }

    logger.info('✅ Case and task updated successfully', {
      userId: req.user?.id,
      caseId: id,
      taskId,
      updatedCaseFields: updateFields.filter(field => !field.includes('updatedAt')),
      updatedTaskFields: { assignedToId, rateTypeId, address },
    });

    // Invalidate stale cache entries for this case
    void invalidateCachePatterns(CacheKeys.invalidateCase(id));

    // T0-7 (audit 2026-05-17): DPDP §11 audit trail on case PII update.
    void createAuditLog({
      action: 'CASE_UPDATED',
      entityType: 'CASE',
      entityId: String(id),
      userId: req.user?.id,
      details: {
        taskId: taskId || null,
        updatedCaseFields: updateFields.filter(field => !field.includes('updatedAt')),
        updatedTaskFields: { assignedToId, rateTypeId, address: address ? 'changed' : null },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    res.json({
      success: true,
      data: { id },
      message: 'Case updated successfully',
    });
  } catch (error) {
    logger.error('❌ Error updating case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// 2026-04-28 PE2.b cleanup: deleted dead caseAssignment chain (6 handlers,
// services/caseAssignmentService.ts, jobs/caseAssignmentProcessor.ts,
// config/queue.ts). Case-level assignment is no longer a valid concept —
// assignment lives on verification_tasks. The 5 unmounted handlers had no
// route; getFieldAgentWorkload was routed at /analytics/field-agent-workload
// but had zero frontend consumers AND its backing view `field_agent_workload`
// did not exist in the DB (500 on call).

// Export cases to Excel
export const exportCases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      status,
      search,
      clientId,
      productId,
      exportType = 'all', // 'all', 'pending', 'in-progress', 'completed'
      sortBy,
      sortOrder,
    } = req.query;

    const userId = req.user!.id;
    const isScopedOps = isScopedOperationsUser(req.user);

    // Build the query via shared helper (lockstep with /cases list + /cases/stats).
    const where = await buildCasesBaseWhereClause(req);
    const whereConditions = where.baseConditions;
    const queryParams: QueryParams = where.baseParams;
    let paramIndex = where.baseParamIndex;

    // Export-only filters: exportType (legacy tab selector) + optional status.
    if (exportType && exportType !== 'all') {
      if (exportType === 'pending') {
        whereConditions.push(`c.status IN ('PENDING', 'IN_PROGRESS')`);
      } else if (exportType === 'in-progress') {
        whereConditions.push(`c.status = 'IN_PROGRESS'`);
      } else if (exportType === 'completed') {
        whereConditions.push(`c.status = 'COMPLETED'`);
      }
    }
    if (status && status !== 'all') {
      whereConditions.push(`c.status = $${paramIndex}`);
      queryParams.push(status as string);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Sort via shared CASE_SORT_MAP — operators expect xlsx ORDER to
    // match the on-screen list (filter-sweep §6 audit invariant).
    const safeSortColumn = CASE_SORT_MAP[sortBy as string] || 'c.case_id';
    const safeSortOrder = (sortOrder as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 10k row cap via SQL LIMIT (kickoff §6; CWE-class don't-regress).
    const limitParamIndex = paramIndex;
    queryParams.push(CASE_EXPORT_ROW_LIMIT);

    // Query to get cases data
    const query = `
      SELECT
        c.case_id as case_id,
        c.customer_name as customer_name,
        c.customer_phone as customer_phone,
        (SELECT address FROM verification_tasks WHERE case_id = c.id LIMIT 1) as address,
        -- F5.1.x: cases.pincode dropped; derive from first task
        (SELECT p2.code FROM verification_tasks vt2 JOIN pincodes p2 ON p2.id = vt2.pincode_id WHERE vt2.case_id = c.id AND vt2.pincode_id IS NOT NULL LIMIT 1) AS pincode,
        cl.name as client_name,
        p.name as product_name,
        vt.name as verification_type_name,
        c.status,
        c.priority,
        assigned_user.name as assigned_to_name,
        bu.name as created_by_backend_user_name,
        c.verification_outcome as verification_outcome,
        c.created_at as created_at,
        c.updated_at as updated_at,
        c.completed_at as completed_at,
        CASE
          WHEN c.status = 'PENDING' OR c.status = 'IN_PROGRESS' THEN
            EXTRACT(EPOCH FROM (NOW() - c.created_at))
          ELSE NULL
        END as pending_duration_seconds,
        (SELECT COUNT(*) FROM verification_tasks vtc WHERE vtc.case_id = c.id) as total_tasks,
        (SELECT COUNT(*) FROM verification_tasks vtc WHERE vtc.case_id = c.id AND vtc.status = 'COMPLETED') as completed_tasks,
        (SELECT COUNT(*) FROM verification_tasks vtc WHERE vtc.case_id = c.id AND vtc.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')) as pending_tasks
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vt ON c.verification_type_id = vt.id
      LEFT JOIN LATERAL (
        SELECT u.name, u.employee_id
        FROM verification_tasks vte
        LEFT JOIN users u ON vte.assigned_to = u.id
        WHERE vte.case_id = c.id AND vte.assigned_to IS NOT NULL
        ORDER BY vte.created_at DESC
        LIMIT 1
      ) assigned_user ON true
      LEFT JOIN users bu ON c.created_by_backend_user = bu.id
      ${whereClause}
      ORDER BY ${safeSortColumn} ${safeSortOrder} NULLS LAST
      LIMIT $${limitParamIndex}
    `;

    const result = await dbQuery(query, queryParams);
    const cases = result.rows;

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRM System';
    workbook.created = new Date();

    // Create worksheet
    const worksheet = workbook.addWorksheet(
      `Cases Export - ${typeof exportType === 'string' || typeof exportType === 'number' ? String(exportType) : 'All'}`
    );

    // Area + Rate Type columns previously appeared here but were always
    // blank — area/rate live on verification_tasks, not cases. Removed
    // until a per-task export is wired.
    const baseColumns = [
      { header: 'Case ID', key: 'caseId', width: 12 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Customer Phone', key: 'customerPhone', width: 15 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Product', key: 'productName', width: 20 },
      { header: 'Verification Type', key: 'verificationTypeName', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Assigned To', key: 'assignedToName', width: 20 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Pincode', key: 'pincode', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
      { header: 'Total Tasks', key: 'totalTasks', width: 12 },
      { header: 'Completed Tasks', key: 'completedTasks', width: 15 },
      { header: 'Pending Tasks', key: 'pendingTasks', width: 14 },
    ];

    // Add specific columns based on export type
    if (exportType === 'completed') {
      baseColumns.push(
        { header: 'Completed At', key: 'completedAt', width: 20 },
        { header: 'Verification Outcome', key: 'verificationOutcome', width: 20 },
        { header: 'Assigned By Backend User', key: 'createdByBackendUserName', width: 25 }
      );
    } else if (exportType === 'pending' || exportType === 'in-progress') {
      baseColumns.push(
        { header: 'Pending Duration (Hours)', key: 'pendingDurationHours', width: 20 },
        { header: 'Assigned By Backend User', key: 'createdByBackendUserName', width: 25 }
      );
    } else {
      // For 'all' cases, include all columns
      baseColumns.push(
        { header: 'Completed At', key: 'completedAt', width: 20 },
        { header: 'Verification Outcome', key: 'verificationOutcome', width: 20 },
        { header: 'Pending Duration (Hours)', key: 'pendingDurationHours', width: 20 },
        { header: 'Assigned By Backend User', key: 'createdByBackendUserName', width: 25 }
      );
    }

    worksheet.columns = baseColumns;

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' },
    };

    // Add data rows
    // Add data rows
    cases.forEach((caseItem: Record<string, unknown>) => {
      const rowData: Record<string, unknown> = {
        caseId: caseItem.caseId,
        customerName: caseItem.customerName,
        customerPhone: caseItem.customerPhone,
        clientName: caseItem.clientName,
        productName: caseItem.productName,
        verificationTypeName: caseItem.verificationTypeName,
        status: caseItem.status,
        priority: caseItem.priority,
        assignedToName: caseItem.assignedToName || 'Unassigned',
        address: caseItem.address,
        pincode: caseItem.pincode,
        createdAt: caseItem.createdAt
          ? new Date(caseItem.createdAt as string).toLocaleString()
          : '',
        updatedAt: caseItem.updatedAt
          ? new Date(caseItem.updatedAt as string).toLocaleString()
          : '',
        completedAt: caseItem.completedAt
          ? new Date(caseItem.completedAt as string).toLocaleString()
          : '',
        verificationOutcome: caseItem.verificationOutcome || '',
        createdByBackendUserName: caseItem.createdByBackendUserName || 'Unknown',
        pendingDurationHours: caseItem.pendingDurationSeconds
          ? Math.round(((caseItem.pendingDurationSeconds as number) / 3600) * 100) / 100
          : '',
        totalTasks: Number(caseItem.totalTasks) || 0,
        completedTasks: Number(caseItem.completedTasks) || 0,
        pendingTasks: Number(caseItem.pendingTasks) || 0,
      };

      // escapeFormulaRow on every user-controlled cell (CWE-1236);
      // numbers/booleans/Dates pass through unchanged.
      worksheet.addRow(escapeFormulaRow(rowData));
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength =
            cell.value && (typeof cell.value === 'string' || typeof cell.value === 'number')
              ? cell.value.toString().length
              : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength;
      }
    });

    // Generate filename with tab name and timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

    // Map export type to readable tab name
    const tabNameMap: { [key: string]: string } = {
      all: 'All_Cases',
      pending: 'Pending_Cases',
      'in-progress': 'In_Progress_Cases',
      completed: 'Completed_Cases',
    };

    const tabName = tabNameMap[exportType as string] || 'All_Cases';
    const filename = `${tabName}_Export_${dateStr}_${timeStr}.xlsx`;

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // T0-7 (audit 2026-05-17): DPDP §11 audit trail on bulk PII export.
    // Logged BEFORE response stream starts so the audit row exists even
    // if the network write fails partway. rowCount is what matched the
    // filters; the operator may have got a partial download but the
    // intent + filter set is recorded.
    void createAuditLog({
      action: 'CASE_EXPORTED',
      entityType: 'CASE',
      entityId: undefined,
      userId,
      details: {
        rowCount: cases.length,
        filename,
        exportType: typeof exportType === 'string' ? exportType : 'all',
        filters: {
          status: typeof status === 'string' ? status : null,
          search: typeof search === 'string' ? search : null,
          clientId: typeof clientId === 'string' ? clientId : null,
          productId: typeof productId === 'string' ? productId : null,
        },
        scoped: isScopedOps,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    logger.info(`Cases exported successfully: ${filename}, ${cases.length} records`);
  } catch (error) {
    logger.error('Error exporting cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export cases',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

// =====================================================
// ENHANCED MULTI-VERIFICATION CASE CREATION
// =====================================================

/**
 * Create case with multiple verification tasks (OLD - REMOVED)
 * Replaced by unified createCase endpoint below
 */

// getCaseSummaryWithTasks (GET /api/cases/:id/summary) lives in ./cases/summary.
// Re-exported so routes/cases.ts keeps importing it from this controller.
export { getCaseSummaryWithTasks } from './cases/summary';

// ============================================================================
// UNIFIED CASE CREATION ENDPOINT - PRODUCTION READY
// ============================================================================

// POST /api/cases/config-validation (validateCaseConfiguration) lives in
// ./cases/configValidation. Re-exported so routes/cases.ts is untouched.
export { validateCaseConfiguration } from './cases/configValidation';

// POST /api/cases/create (createCase) — the unified case-creation handler —
// lives in ./cases/createCase. Re-exported so routes/cases.ts keeps importing
// it from this controller. The DatabaseError interface it used moved there too.
export { createCase } from './cases/createCase';
