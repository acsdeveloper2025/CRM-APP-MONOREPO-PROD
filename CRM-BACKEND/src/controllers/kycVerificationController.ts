import type { Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query, pool, wrapClient } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';
import { storage, StorageKeys } from '@/services/storage';
import ExcelJS from 'exceljs';

/**
 * KYC Document Verification Controller
 * Handles CRUD + verification workflow for KYC document tasks
 */

// Phase 1.4 (2026-05-04, revised): document type list optionally filters
// by (clientId, productId) using TWO joins:
//   - INNER JOIN `client_product_documents` → only return doc types
//     assigned to this (client, product) pair
//   - LEFT  JOIN `document_type_rates`     → annotate each row with
//     `rate_amount` + `has_rate`. Doc types without a rate still come
//     through but with `has_rate=false` so the frontend can warn the
//     user (mirrors how the field-verification flow surfaces missing
//     service-zone-rule rates).
//
// Pipeline:
//   clients + products → client_products(id, client_id, product_id)
//                       ↓
//   client_product_documents(client_product_id, document_type_id, is_mandatory, display_order)
//                       ↓
//                document_types ←→ document_type_rates (LEFT JOIN, optional)
//
// Without clientId+productId, returns ALL active doc types (admin
// catalog use case unchanged).
export const listDocumentTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientIdRaw = req.query.clientId;
    const productIdRaw = req.query.productId;
    const clientIdParam =
      typeof clientIdRaw === 'string' && clientIdRaw.trim() !== '' ? Number(clientIdRaw) : null;
    const productIdParam =
      typeof productIdRaw === 'string' && productIdRaw.trim() !== '' ? Number(productIdRaw) : null;

    const filterByAssignment =
      clientIdParam !== null &&
      Number.isFinite(clientIdParam) &&
      productIdParam !== null &&
      Number.isFinite(productIdParam);

    if (filterByAssignment) {
      const result = await query(
        `SELECT
            dt.id,
            dt.code,
            dt.name,
            dt.category,
            dt.is_active,
            dt.sort_order,
            COALESCE(dt.custom_fields, '[]'::jsonb) as custom_fields,
            cpd.is_mandatory,
            cpd.display_order,
            dtr.amount as rate_amount,
            (dtr.id IS NOT NULL) as has_rate
         FROM document_types dt
         INNER JOIN client_product_documents cpd
           ON cpd.document_type_id = dt.id
          AND cpd.is_active = true
         INNER JOIN client_products cp
           ON cp.id = cpd.client_product_id
          AND cp.client_id = $1
          AND cp.product_id = $2
          AND cp.is_active = true
         LEFT JOIN document_type_rates dtr
           ON dtr.document_type_id = dt.id
          AND dtr.client_id = $1
          AND dtr.product_id = $2
          AND dtr.is_active = true
         WHERE dt.is_active = true
         ORDER BY cpd.display_order, dt.sort_order, dt.name`,
        [clientIdParam, productIdParam]
      );
      return res.json({ success: true, data: result.rows });
    }

    const result = await query(
      `SELECT id, code, name, category, is_active, sort_order, COALESCE(custom_fields, '[]'::jsonb) as custom_fields
       FROM document_types
       WHERE is_active = true
       ORDER BY sort_order, name`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing KYC document types:', error);
    return res.status(500).json({ success: false, message: 'Failed to list document types' });
  }
};

// List KYC tasks with filtering and pagination
export const listKYCTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      statusNot,
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

    // Exclude a status (e.g. ?statusNot=PENDING for completed KYC page)
    if (statusNot) {
      conditions.push(`kdv.verification_status != $${paramIndex}`);
      params.push(statusNot as string);
      paramIndex++;
    }

    if (documentType) {
      // F8.2.2: API still receives the code string; resolve to FK id at filter time
      conditions.push(
        `kdv.document_type_id = (SELECT id FROM document_types WHERE code = $${paramIndex} AND is_active = true LIMIT 1)`
      );
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
      documentType: 'kdt.code',
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
        kdt.code AS document_type,
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
       LEFT JOIN document_types kdt ON kdt.id = kdv.document_type_id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    // Stats
    const statsResult = await query(
      // Workflow buckets read verification_status; outcome buckets read final_status.
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE verification_status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE verification_status = 'IN_PROGRESS') as in_progress,
        COUNT(*) FILTER (WHERE verification_status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE final_status = 'Positive') as positive,
        COUNT(*) FILTER (WHERE final_status = 'Negative') as negative,
        COUNT(*) FILTER (WHERE final_status = 'Refer') as referred,
        COUNT(*) FILTER (WHERE final_status = 'Fraud') as fraud
       FROM kyc_document_verifications WHERE deleted_at IS NULL`
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
        (SELECT code FROM pincodes WHERE id = vt.pincode_id) as pincode,
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
       LEFT JOIN document_types kdt ON kdt.id = kdv.document_type_id
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

// Verify a KYC document. The reviewer's outcome is the field-verification
// final_status enum (Positive | Negative | Refer | Fraud). On a decision the
// row's workflow `verification_status` advances to 'COMPLETED' and the
// outcome lands in `final_status` (mirror of verification_reports.final_status).
export const verifyKYCDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    // Accept `finalStatus` (canonical) and fall back to legacy `status` for
    // older callers — the legacy values PASS/FAIL/REFER are mapped onto the
    // canonical enum so existing clients don't 400 mid-deploy.
    const rawFinalStatus: string =
      (req.body?.finalStatus as string) || (req.body?.status as string) || '';
    const legacyMap: Record<string, string> = {
      PASS: 'Positive',
      FAIL: 'Negative',
      REFER: 'Refer',
    };
    const finalStatus = legacyMap[rawFinalStatus] || rawFinalStatus;
    const { remarks, rejectionReason } = req.body;
    const userId = req.user!.id;

    const allowed = ['Positive', 'Negative', 'Refer', 'Fraud'];
    if (!finalStatus || !allowed.includes(finalStatus)) {
      return res.status(400).json({
        success: false,
        message: `Valid finalStatus required (${allowed.join(', ')})`,
      });
    }

    if ((finalStatus === 'Negative' || finalStatus === 'Fraud') && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: `Rejection reason is required for ${finalStatus} outcome`,
      });
    }

    const client = wrapClient(await pool.connect());
    try {
      await client.query('BEGIN');

      // Workflow advances to COMPLETED; outcome lands in final_status.
      const updateResult = await client.query(
        `UPDATE kyc_document_verifications
         SET verification_status = 'COMPLETED', final_status = $1,
             remarks = $2, rejection_reason = $3,
             verified_by = $4, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, verification_task_id, case_id`,
        [finalStatus, remarks || null, rejectionReason || null, userId, taskId]
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

      // If all docs decided, mark the verification_task as COMPLETED. Overall
      // outcome rolls up from the per-doc final_status enum: any Negative
      // poisons the task to KYC_FAILED, any Fraud → KYC_FRAUD; any Refer →
      // KYC_REFER; otherwise KYC_VERIFIED.
      if (parseInt(pendingDocs.rows[0].pending) === 0) {
        const docResults = await client.query(
          `SELECT final_status, COUNT(*) as cnt
           FROM kyc_document_verifications
           WHERE verification_task_id = $1 AND deleted_at IS NULL
           GROUP BY final_status`,
          [verificationTaskId]
        );

        const resultMap: Record<string, number> = {};
        docResults.rows.forEach((r: { finalStatus: string | null; cnt: string }) => {
          if (r.finalStatus) {
            resultMap[r.finalStatus] = parseInt(r.cnt);
          }
        });

        let overallOutcome = 'KYC_VERIFIED';
        if ((resultMap['Fraud'] || 0) > 0) {
          overallOutcome = 'KYC_FRAUD';
        } else if ((resultMap['Negative'] || 0) > 0) {
          overallOutcome = 'KYC_FAILED';
        } else if ((resultMap['Refer'] || 0) > 0) {
          overallOutcome = 'KYC_REFER';
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
        message: `Document marked as ${finalStatus}`,
        data: { id: taskId, finalStatus, verificationStatus: 'COMPLETED' },
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
    const userId = req.user!.id;

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
// F8.2.3: writes through StorageService + populates document_storage_key alongside
// the legacy document_file_path. Reads still use document_file_path until the
// production S3 cutover, when document_file_path is dropped.
export const uploadKYCDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    // Look up the KYC row to derive case_id + a stable doc-type code for the storage key.
    const lookup = await query<{ id: string; caseId: string; docCode: string | null }>(
      `SELECT kdv.id,
              kdv.case_id AS "caseId",
              dt.code AS "docCode"
         FROM kyc_document_verifications kdv
         LEFT JOIN document_types dt ON dt.id = kdv.document_type_id
        WHERE kdv.id = $1
        LIMIT 1`,
      [taskId]
    );
    if (lookup.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }
    const kycRow = lookup.rows[0];
    const ext = path.extname(file.originalname || file.filename || '').replace(/^\./, '') || 'bin';
    const storageKey = StorageKeys.kycDocument(
      kycRow.caseId,
      kycRow.id,
      kycRow.docCode || 'DOC',
      ext
    );

    // Multer wrote bytes to disk at file.path. Stream them to storage.put so the
    // S3 backend (when active) gets the bytes too. For the LocalFs backend this
    // is effectively a copy under uploads/<storageKey>; the legacy file at file.path
    // stays so existing reads (file_path) keep working during the dual-write window.
    // F8.2.5 closure: also compute server-side SHA-256 for evidence integrity.
    const buffer = await fs.readFile(file.path);
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
    await storage.put(storageKey, buffer, file.mimetype);

    const filePath = `/uploads/kyc/${file.filename}`;
    const result = await query(
      `UPDATE kyc_document_verifications
       SET document_file_path = $1, document_file_name = $2,
           document_file_size = $3, document_mime_type = $4,
           document_storage_key = $5, sha256_hash = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id`,
      [filePath, file.originalname, file.size, file.mimetype, storageKey, sha256Hash, taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    res.json({ success: true, message: 'Document uploaded', data: { filePath, storageKey } });
  } catch (error) {
    logger.error('Error uploading KYC document:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// Get KYC tasks for a specific case
export const getKYCTasksForCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawCaseId = String(req.params.caseId || '');

    // The frontend navigates to /case-management/:caseId where caseId may be
    // the integer case_id (e.g. "32") or the UUID id. The
    // kyc_document_verifications.case_id column is UUID, so we must
    // resolve integer → UUID first. Same pattern as getCaseById.
    const isNumeric = /^\d+$/.test(rawCaseId);
    let resolvedCaseUuid = rawCaseId;

    if (isNumeric) {
      const caseResult = await query<{ id: string }>(
        'SELECT id FROM cases WHERE case_id = $1 LIMIT 1',
        [parseInt(rawCaseId, 10)]
      );
      if (caseResult.rows.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }
      resolvedCaseUuid = caseResult.rows[0].id;
    }

    const result = await query(
      `SELECT
        kdv.id,
        kdt.code AS document_type,
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
       LEFT JOIN document_types kdt ON kdt.id = kdv.document_type_id
       LEFT JOIN users u_verified ON u_verified.id = kdv.verified_by
       LEFT JOIN users u_assigned ON u_assigned.id = kdv.assigned_to
       WHERE kdv.case_id = $1
       ORDER BY kdt.sort_order, kdv.created_at`,
      [resolvedCaseUuid]
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
      // F8.2.2: API still receives the code string; resolve to FK id at filter time
      conditions.push(
        `kdv.document_type_id = (SELECT id FROM document_types WHERE code = $${paramIndex} AND is_active = true LIMIT 1)`
      );
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
       LEFT JOIN document_types kdt ON kdt.id = kdv.document_type_id
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
