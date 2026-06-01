import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query as dbQuery } from '../config/database';
import ExcelJS from 'exceljs';
import { QueryParams } from '../types/database';
import { isScopedOperationsUser } from '@/security/rbacAccess';
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

// GET /api/cases/stats (getCaseStats) lives in ./cases/getCaseStats.
export { getCaseStats } from './cases/getCaseStats';

// GET /api/cases/:id (getCaseById) lives in ./cases/getCaseById.
export { getCaseById } from './cases/getCaseById';

// POST /api/cases - Create new case (OLD - REMOVED)
// Replaced by unified createCase endpoint at the end of this file

// PUT /api/cases/:id (updateCase) lives in ./cases/updateCase.
export { updateCase } from './cases/updateCase';

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
