import type { Response } from 'express';
import { query, pool, wrapClient } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';
import ExcelJS from 'exceljs';

/**
 * KYC Document Verification Controller
 * Handles CRUD + verification workflow for KYC document tasks
 */

// List all KYC document types (for dropdowns)
export const listDocumentTypes = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, code, name, category, is_active, sort_order, COALESCE(custom_fields, '[]'::jsonb) as custom_fields
       FROM kyc_document_types
       WHERE is_active = true
       ORDER BY sort_order, name`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing KYC document types:', error);
    res.status(500).json({ success: false, message: 'Failed to list document types' });
  }
};

// List KYC tasks with filtering and pagination
export const listKYCTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      documentType,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
      caseId,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (status && status !== 'ALL') {
      conditions.push(`kdv.verification_status = $${paramIndex}`);
      params.push(status as string);
      paramIndex++;
    }

    if (documentType) {
      conditions.push(`kdv.document_type = $${paramIndex}`);
      params.push(documentType as string);
      paramIndex++;
    }

    if (caseId) {
      conditions.push(`kdv.case_id = $${paramIndex}`);
      params.push(caseId as string);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `(c.customer_name ILIKE $${paramIndex} OR kdv.document_number ILIKE $${paramIndex} OR kdv.document_holder_name ILIKE $${paramIndex})`
      );
      params.push(`%${search as string}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // API contract: sortBy is sent as camelCase by the frontend; we map it to
    // the snake_case DB column here.
    const allowedSortColumns: Record<string, string> = {
      createdAt: 'kdv.created_at',
      documentType: 'kdv.document_type',
      verificationStatus: 'kdv.verification_status',
      customerName: 'c.customer_name',
      caseNumber: 'c.case_id',
    };
    const sortCol = allowedSortColumns[sortBy as string] || 'kdv.created_at';
    const sortDir = (sortOrder as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM kyc_document_verifications kdv
       JOIN cases c ON c.id = kdv.case_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Data
    const dataResult = await query(
      `SELECT
        kdv.id,
        kdv.verification_task_id,
        kdv.case_id,
        kdv.document_type,
        kdv.document_number,
        kdv.document_holder_name,
        kdv.document_file_name,
        kdv.document_file_path,
        kdv.verification_status,
        kdv.remarks,
        kdv.rejection_reason,
        kdv.verified_at,
        kdv.assigned_to,
        kdv.created_at,
        kdv.updated_at,
        COALESCE(kdv.document_details, '{}'::jsonb) as document_details,
        kdv.description,
        c.case_id as case_number,
        c.customer_name as customer_name,
        c.customer_phone as customer_phone,
        c.status as case_status,
        vt.task_number,
        vt.status as task_status,
        u_verified.name as verified_by_name,
        u_assigned.name as assigned_to_name,
        u_created.name as assigned_by_name,
        kdt.name as document_type_name,
        kdt.category as document_category,
        COALESCE(kdt.custom_fields, '[]'::jsonb) as type_custom_fields
       FROM kyc_document_verifications kdv
       JOIN cases c ON c.id = kdv.case_id
       JOIN verification_tasks vt ON vt.id = kdv.verification_task_id
       LEFT JOIN users u_verified ON u_verified.id = kdv.verified_by
       LEFT JOIN users u_assigned ON u_assigned.id = kdv.assigned_to
       LEFT JOIN users u_created ON u_created.id = kdv.assigned_by
       LEFT JOIN kyc_document_types kdt ON kdt.code = kdv.document_type
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    // Stats
    const statsResult = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE verification_status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE verification_status = 'PASS') as passed,
        COUNT(*) FILTER (WHERE verification_status = 'FAIL') as failed,
        COUNT(*) FILTER (WHERE verification_status = 'REFER') as referred
       FROM kyc_document_verifications`
    );

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      statistics: statsResult.rows[0],
    });
  } catch (error) {
    logger.error('Error listing KYC tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to list KYC tasks' });
  }
};

// Get single KYC task detail
export const getKYCTaskDetail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const result = await query(
      `SELECT
        kdv.*,
        c.case_id as case_number,
        c.customer_name as customer_name,
        c.customer_phone as customer_phone,
        c.status as case_status,
        vt.task_number,
        vt.status as task_status,
        vt.address,
        vt.pincode,
        u_verified.name as verified_by_name,
        u_assigned.name as assigned_to_name,
        kdt.name as document_type_name,
        kdt.category as document_category,
        COALESCE(kdt.custom_fields, '[]'::jsonb) as type_custom_fields
       FROM kyc_document_verifications kdv
       JOIN cases c ON c.id = kdv.case_id
       JOIN verification_tasks vt ON vt.id = kdv.verification_task_id
       LEFT JOIN users u_verified ON u_verified.id = kdv.verified_by
       LEFT JOIN users u_assigned ON u_assigned.id = kdv.assigned_to
       LEFT JOIN kyc_document_types kdt ON kdt.code = kdv.document_type
       WHERE kdv.id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error getting KYC task detail:', error);
    res.status(500).json({ success: false, message: 'Failed to get KYC task detail' });
  }
};

// Verify a KYC document (Pass/Fail/Refer)
export const verifyKYCDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status: verificationStatus, remarks, rejectionReason } = req.body;
    const userId = req.user?.id;

    if (!verificationStatus || !['PASS', 'FAIL', 'REFER'].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Valid verification status required (PASS, FAIL, REFER)',
      });
    }

    if (verificationStatus === 'FAIL' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required for FAIL status',
      });
    }

    const client = wrapClient(await pool.connect());
    try {
      await client.query('BEGIN');

      // Update KYC document verification
      const updateResult = await client.query(
        `UPDATE kyc_document_verifications
         SET verification_status = $1, remarks = $2, rejection_reason = $3,
             verified_by = $4, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, verification_task_id, case_id`,
        [verificationStatus, remarks || null, rejectionReason || null, userId, taskId]
      );

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'KYC task not found' });
      }

      const verificationTaskId = updateResult.rows[0].verificationTaskId as string;
      const caseId = updateResult.rows[0].caseId as string;

      // Check if ALL KYC docs for this task are verified
      const pendingDocs = await client.query(
        `SELECT COUNT(*) as pending FROM kyc_document_verifications
         WHERE verification_task_id = $1 AND verification_status = 'PENDING'`,
        [verificationTaskId]
      );

      // If all docs verified, mark the verification_task as COMPLETED
      if (parseInt(pendingDocs.rows[0].pending) === 0) {
        // Determine overall outcome based on individual document results
        const docResults = await client.query(
          `SELECT verification_status, COUNT(*) as cnt
           FROM kyc_document_verifications
           WHERE verification_task_id = $1
           GROUP BY verification_status`,
          [verificationTaskId]
        );

        const resultMap: Record<string, number> = {};
        docResults.rows.forEach((r: { verificationStatus: string; cnt: string }) => {
          resultMap[r.verificationStatus] = parseInt(r.cnt);
        });

        let overallOutcome = 'KYC_VERIFIED';
        if (resultMap['FAIL'] > 0) {
          overallOutcome = 'KYC_FAILED';
        }

        await client.query(
          `UPDATE verification_tasks
           SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
               verification_outcome = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [overallOutcome, verificationTaskId]
        );

        // Recalculate case status
        const allTasks = await client.query(
          `SELECT status FROM verification_tasks WHERE case_id = $1 AND status != 'REVOKED'`,
          [caseId]
        );
        const allCompleted = allTasks.rows.every(
          (t: { status: string }) => t.status === 'COMPLETED'
        );
        if (allCompleted && allTasks.rows.length > 0) {
          await client.query(
            `UPDATE cases SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [caseId]
          );
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Document marked as ${verificationStatus}`,
        data: { id: taskId, status: verificationStatus },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error verifying KYC document:', error);
    res.status(500).json({ success: false, message: 'Failed to verify document' });
  }
};

// Assign KYC task to verifier
export const assignKYCTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { assignedTo } = req.body;
    const userId = req.user?.id;

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'assignedTo is required' });
    }

    const result = await query(
      `UPDATE kyc_document_verifications
       SET assigned_to = $1, assigned_by = $2, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, verification_task_id`,
      [assignedTo, userId, taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    // Also update the parent verification_task assignment
    await query(
      `UPDATE verification_tasks
       SET assigned_to = $1, assigned_by = $2, assigned_at = CURRENT_TIMESTAMP,
           status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND (status = 'PENDING' OR assigned_to IS NULL)`,
      [assignedTo, userId, result.rows[0].verificationTaskId]
    );

    res.json({ success: true, message: 'KYC task assigned', data: { id: taskId } });
  } catch (error) {
    logger.error('Error assigning KYC task:', error);
    res.status(500).json({ success: false, message: 'Failed to assign KYC task' });
  }
};

// Upload document for KYC task
export const uploadKYCDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const filePath = `/uploads/kyc/${file.filename}`;
    const result = await query(
      `UPDATE kyc_document_verifications
       SET document_file_path = $1, document_file_name = $2,
           document_file_size = $3, document_mime_type = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id`,
      [filePath, file.originalname, file.size, file.mimetype, taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    res.json({ success: true, message: 'Document uploaded', data: { filePath } });
  } catch (error) {
    logger.error('Error uploading KYC document:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// Get KYC tasks for a specific case
export const getKYCTasksForCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    const result = await query(
      `SELECT
        kdv.id,
        kdv.document_type,
        kdv.document_number,
        kdv.document_holder_name,
        kdv.document_file_name,
        kdv.document_file_path,
        kdv.verification_status,
        kdv.remarks,
        kdv.rejection_reason,
        kdv.verified_at,
        kdv.created_at,
        COALESCE(kdv.document_details, '{}'::jsonb) as document_details,
        kdv.description,
        kdt.name as document_type_name,
        kdt.category as document_category,
        COALESCE(kdt.custom_fields, '[]'::jsonb) as type_custom_fields,
        u_verified.name as verified_by_name,
        u_assigned.name as assigned_to_name
       FROM kyc_document_verifications kdv
       LEFT JOIN kyc_document_types kdt ON kdt.code = kdv.document_type
       LEFT JOIN users u_verified ON u_verified.id = kdv.verified_by
       LEFT JOIN users u_assigned ON u_assigned.id = kdv.assigned_to
       WHERE kdv.case_id = $1
       ORDER BY kdt.sort_order, kdv.created_at`,
      [caseId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error getting KYC tasks for case:', error);
    res.status(500).json({ success: false, message: 'Failed to get KYC tasks' });
  }
};

// Export KYC data as Excel (one row per document per case)
export const exportKYCToExcel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, documentType, dateFrom, dateTo } = req.query;

    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (status && status !== 'ALL') {
      conditions.push(`kdv.verification_status = $${paramIndex}`);
      params.push(status as string);
      paramIndex++;
    }
    if (documentType) {
      conditions.push(`kdv.document_type = $${paramIndex}`);
      params.push(documentType as string);
      paramIndex++;
    }
    if (dateFrom) {
      conditions.push(`kdv.created_at >= $${paramIndex}`);
      params.push(dateFrom as string);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`kdv.created_at <= $${paramIndex}`);
      params.push(dateTo as string);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT
        c.case_id as "Case #",
        c.customer_name as "Customer Name",
        c.customer_phone as "Customer Phone",
        kdt.category as "Document Category",
        kdt.name as "Document Type",
        kdv.document_number as "Document Number",
        kdv.document_holder_name as "Document Holder",
        COALESCE(kdv.document_details, '{}'::jsonb) as "Custom Fields",
        kdv.description as "Description",
        kdv.verification_status as "Status",
        u_verified.name as "Verified By",
        kdv.remarks as "Remarks",
        kdv.rejection_reason as "Rejection Reason",
        TO_CHAR(kdv.verified_at, 'DD/MM/YYYY HH24:MI') as "Verified Date",
        TO_CHAR(kdv.created_at, 'DD/MM/YYYY HH24:MI') as "Created Date",
        u_assigned.name as "Assigned To"
       FROM kyc_document_verifications kdv
       JOIN cases c ON c.id = kdv.case_id
       LEFT JOIN kyc_document_types kdt ON kdt.code = kdv.document_type
       LEFT JOIN users u_verified ON u_verified.id = kdv.verified_by
       LEFT JOIN users u_assigned ON u_assigned.id = kdv.assigned_to
       ${whereClause}
       ORDER BY c.case_id, kdt.sort_order, kdv.created_at`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRM System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('KYC Verifications');

    // Headers
    const columns = [
      { header: 'Case #', key: 'Case #', width: 10 },
      { header: 'Customer Name', key: 'Customer Name', width: 25 },
      { header: 'Customer Phone', key: 'Customer Phone', width: 15 },
      { header: 'Document Category', key: 'Document Category', width: 15 },
      { header: 'Document Type', key: 'Document Type', width: 25 },
      { header: 'Document Number', key: 'Document Number', width: 20 },
      { header: 'Document Holder', key: 'Document Holder', width: 25 },
      { header: 'Custom Fields', key: 'Custom Fields', width: 40 },
      { header: 'Description', key: 'Description', width: 30 },
      { header: 'Status', key: 'Status', width: 12 },
      { header: 'Verified By', key: 'Verified By', width: 20 },
      { header: 'Remarks', key: 'Remarks', width: 30 },
      { header: 'Rejection Reason', key: 'Rejection Reason', width: 30 },
      { header: 'Verified Date', key: 'Verified Date', width: 18 },
      { header: 'Created Date', key: 'Created Date', width: 18 },
      { header: 'Assigned To', key: 'Assigned To', width: 20 },
    ];

    sheet.columns = columns;

    // Style headers
    sheet.getRow(1).font = { bold: true, size: 11 };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

    // Add data — flatten custom fields JSON to readable string
    result.rows.forEach((row: Record<string, unknown>) => {
      const customFields = row['Custom Fields'];
      if (customFields && typeof customFields === 'object') {
        row['Custom Fields'] = Object.entries(customFields as Record<string, string>)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
      }
      sheet.addRow(row);
    });

    // Auto-filter
    sheet.autoFilter = { from: 'A1', to: `P${result.rows.length + 1}` };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=kyc-verifications-${new Date().toISOString().split('T')[0]}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting KYC to Excel:', error);
    res.status(500).json({ success: false, message: 'Failed to export KYC data' });
  }
};
