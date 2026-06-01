import type { Response } from 'express';
import ExcelJS from 'exceljs';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../config/database';
import { createAuditLog } from '../../utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';
import {
  TASK_EXPORT_ROW_LIMIT,
  TASK_SORT_MAP,
  buildVerificationTasksWhereClause,
} from './queryBuilder';

// Export verification tasks to Excel
export const exportTasksToExcel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build WHERE via shared helper (lockstep with /verification-tasks list).
    const where = await buildVerificationTasksWhereClause(req);
    const params = where.params;
    const whereClause =
      where.conditions.length > 0 ? `WHERE ${where.conditions.join(' AND ')}` : '';

    // Sort via shared SORT_MAP — operators expect xlsx ORDER to match the
    // on-screen list (filter-sweep audit invariant, kickoff §9).
    const safeSortColumn = TASK_SORT_MAP[sortBy as string] || 'vt.created_at';
    const safeSortOrder = (sortOrder as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 10k row cap via SQL LIMIT (kickoff §6; memory
    // project_csv_xlsx_audit_followup_2026_05_12 don't-regress #5).
    const limitParamIndex = params.length + 1;
    params.push(TASK_EXPORT_ROW_LIMIT);

    const result = await dbQuery(
      `
      SELECT
        vt.task_number,
        c.case_id as case_number,
        c.customer_name as customer_name,
        c.customer_phone as customer_phone,
        vt.task_title,
        vt.task_type,
        vtype.name as verification_type_name,
        cl.name as client_name,
        p.name as product_name,
        vt.address,
        (SELECT code FROM pincodes WHERE id = vt.pincode_id) as pincode,
        a.name as area_name,
        vt.status,
        vt.priority,
        u_assigned.name as assigned_to_name,
        u_assigned.employee_id as assigned_to_employee_id,
        u_created.name as assigned_by_name,
        rt.name as rate_type_name,
        vt.estimated_amount,
        vt.actual_amount,
        vt.trigger,
        vt.applicant_type,
        vt.created_at,
        vt.assigned_at,
        vt.started_at,
        vt.completed_at,
        CASE WHEN vt.completed_at IS NOT NULL AND vt.created_at IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (vt.completed_at - vt.created_at)) / 86400.0, 1)
          ELSE NULL END as tat_days
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
      LEFT JOIN users u_assigned ON vt.assigned_to = u_assigned.id
      LEFT JOIN users u_created ON vt.assigned_by = u_created.id
      LEFT JOIN rate_types rt ON vt.rate_type_id = rt.id
      LEFT JOIN areas a ON vt.area_id = a.id
      ${whereClause}
      ORDER BY ${safeSortColumn} ${safeSortOrder} NULLS LAST
      LIMIT $${limitParamIndex}
    `,
      params
    );

    const tasks = result.rows;

    // Audit PRE-stream (mirrors invoices/MIS/clients exports).
    await createAuditLog({
      userId: req.user?.id,
      action: 'TASK_EXPORTED',
      entityType: 'verification_task',
      details: { recordCount: tasks.length, filters: req.query },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRM System';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Tasks Export');

    worksheet.columns = [
      { header: 'Task #', key: 'taskNumber', width: 15 },
      { header: 'Case #', key: 'caseNumber', width: 12 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Customer Phone', key: 'customerPhone', width: 15 },
      { header: 'Task Title', key: 'taskTitle', width: 25 },
      { header: 'Task Type', key: 'taskType', width: 12 },
      { header: 'Verification Type', key: 'verificationTypeName', width: 22 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Product', key: 'productName', width: 20 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Pincode', key: 'pincode', width: 10 },
      { header: 'Area', key: 'areaName', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Assigned To', key: 'assignedToName', width: 20 },
      { header: 'Assigned To (Emp ID)', key: 'assignedToEmployeeId', width: 18 },
      { header: 'Assigned By', key: 'assignedByName', width: 20 },
      { header: 'Rate Type', key: 'rateTypeName', width: 18 },
      { header: 'Estimated Amount', key: 'estimatedAmount', width: 18 },
      { header: 'Actual Amount', key: 'actualAmount', width: 15 },
      { header: 'Trigger', key: 'trigger', width: 15 },
      { header: 'Applicant Type', key: 'applicantType', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Assigned At', key: 'assignedAt', width: 20 },
      { header: 'Started At', key: 'startedAt', width: 20 },
      { header: 'Completed At', key: 'completedAt', width: 20 },
      { header: 'TAT (Days)', key: 'tatDays', width: 12 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    tasks.forEach((task: Record<string, unknown>) => {
      // escapeFormulaRow on every user-controlled cell (CWE-1236);
      // numbers/booleans/Dates pass through unchanged.
      worksheet.addRow(
        escapeFormulaRow({
          taskNumber: task.taskNumber,
          caseNumber: task.caseNumber,
          customerName: task.customerName,
          customerPhone: task.customerPhone,
          taskTitle: task.taskTitle,
          taskType: task.taskType || 'NORMAL',
          verificationTypeName: task.verificationTypeName,
          clientName: task.clientName,
          productName: task.productName,
          address: task.address,
          pincode: task.pincode,
          areaName: task.areaName,
          status: task.status,
          priority: task.priority,
          assignedToName: task.assignedToName || 'Unassigned',
          assignedToEmployeeId: task.assignedToEmployeeId,
          assignedByName: task.assignedByName,
          rateTypeName: task.rateTypeName,
          estimatedAmount: task.estimatedAmount ? Number(task.estimatedAmount) : null,
          actualAmount: task.actualAmount ? Number(task.actualAmount) : null,
          trigger: task.trigger,
          applicantType: task.applicantType,
          createdAt: task.createdAt ? new Date(task.createdAt as string).toLocaleString() : '',
          assignedAt: task.assignedAt ? new Date(task.assignedAt as string).toLocaleString() : '',
          startedAt: task.startedAt ? new Date(task.startedAt as string).toLocaleString() : '',
          completedAt: task.completedAt
            ? new Date(task.completedAt as string).toLocaleString()
            : '',
          tatDays: task.tatDays ? Number(task.tatDays) : null,
        })
      );
    });

    worksheet.autoFilter = { from: 'A1', to: `AA${tasks.length + 1}` };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting tasks to Excel:', error);
    res.status(500).json({ success: false, message: 'Failed to export tasks' });
  }
};
