import type { Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query, pool, wrapClient } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';
import { storage, StorageKeys } from '@/services/storage';
import { TaskCompletionFinalizer } from '@/services/taskCompletionFinalizer';
import { CaseStatusSyncService } from '@/services/caseStatusSyncService';
import ExcelJS from 'exceljs';
import { escapeFormulaRow } from '@/utils/formulaGuard';
import {
  hasSystemScopeBypass,
  isFieldExecutionActor,
  isKycExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import { enforceBackendUserCaseScope } from '@/controllers/attachmentsController';
import { createAuditLog } from '@/utils/auditLogger';
import { checkEditable, buildEditBlockedResponse } from '@/utils/editLockGuard';
import { TaskRevocationService } from '@/services/taskRevocationService';

// =====================================================
// Module-scope export + sort constants (filter-sweep 2026-05-23)
// =====================================================
//
// Single source of WHERE-truth for list + export + stats. Mirrors the
// canonical pattern locked in invoicesController / verificationTasksController /
// casesController. Any new filter goes in `buildKycTasksBaseWhereClause`
// ONCE and all 3 endpoints inherit it (closes the export-vs-list drift
// class).
const KYC_EXPORT_ROW_LIMIT = 10000;
const KYC_TASKS_SORT_MAP: Record<string, string> = {
  createdAt: 'kdv.created_at',
  documentType: 'kdt.code',
  verificationStatus: 'kdv.verification_status',
  customerName: 'c.customer_name',
  caseNumber: 'c.case_id',
  verifiedAt: 'kdv.verified_at',
  assignedAt: 'kdv.assigned_at',
};

type KycBaseWhereResult = {
  baseConditions: string[];
  baseParams: QueryParams;
  baseParamIndex: number;
};

/**
 * Build BASE WHERE clause for KYC tasks — scope + soft-delete only.
 * Caller (list / export / stats) appends user filters (status / statusNot /
 * documentType / caseId / search / dateFrom / dateTo) as needed; stats
 * intentionally omits them so partition counters reflect the full
 * in-scope KYC pool.
 *
 * Preserves all three-tier scope branches (P13.F / P15.M-7):
 *   - SUPER_ADMIN bypass
 *   - field-execution actors (assigned_to = self)
 *   - scoped-ops (hierarchy / assigned client+product) + activeScope overlay
 * + NEW-CRIT-1 soft-delete filter unconditionally.
 */
async function buildKycTasksBaseWhereClause(
  req: AuthenticatedRequest
): Promise<KycBaseWhereResult> {
  const baseConditions: string[] = [];
  const baseParams: QueryParams = [];
  let baseParamIndex = 1;

  const isAdmin = hasSystemScopeBypass(req.user);
  const isExecutionActor = isFieldExecutionActor(req.user);
  const isKycActor = isKycExecutionActor(req.user);
  const isScopedOps = isScopedOperationsUser(req.user);

  if (req.user?.id && !isAdmin) {
    const userId = req.user.id;
    // F9.3 (2026-05-26): KYC execution actors (kyc.verify holders without
    // supervisory perms) scope to assigned_to=self — same branch as field
    // execution actors. Without this, KYC_VERIFIER role sees 0 tasks even
    // when explicitly assigned. Checked BEFORE isScopedOps because
    // KYC_VERIFIER also has case.view (which classifies as isScopedOps
    // and would otherwise fall to a client/product branch with 0 hits).
    if (isExecutionActor || isKycActor) {
      baseConditions.push(
        `(kdv.assigned_to = $${baseParamIndex} OR vt.assigned_to = $${baseParamIndex})`
      );
      baseParams.push(userId);
      baseParamIndex++;
    } else if (isScopedOps) {
      const hierarchyUserIds = await getScopedOperationalUserIds(userId);
      if (hierarchyUserIds) {
        if (hierarchyUserIds.length === 0) {
          baseConditions.push('FALSE');
        } else {
          baseConditions.push(
            `(c.created_by_backend_user = ANY($${baseParamIndex}::uuid[]) OR vt.assigned_to = ANY($${baseParamIndex}::uuid[]))`
          );
          baseParams.push(hierarchyUserIds);
          baseParamIndex++;
        }
      } else {
        let effectiveClientIds = await getAssignedClientIds(userId);
        let effectiveProductIds = await getAssignedProductIds(userId);
        if (req.activeScope?.clientId != null && effectiveClientIds) {
          effectiveClientIds = effectiveClientIds.includes(req.activeScope.clientId)
            ? [req.activeScope.clientId]
            : [-1];
        }
        if (req.activeScope?.productId != null && effectiveProductIds) {
          effectiveProductIds = effectiveProductIds.includes(req.activeScope.productId)
            ? [req.activeScope.productId]
            : [-1];
        }
        if (!effectiveClientIds || effectiveClientIds.length === 0) {
          baseConditions.push('FALSE');
        } else {
          baseConditions.push(`c.client_id = ANY($${baseParamIndex}::int[])`);
          baseParams.push(effectiveClientIds);
          baseParamIndex++;
        }
        if (!effectiveProductIds || effectiveProductIds.length === 0) {
          baseConditions.push('FALSE');
        } else {
          baseConditions.push(`c.product_id = ANY($${baseParamIndex}::int[])`);
          baseParams.push(effectiveProductIds);
          baseParamIndex++;
        }
      }
      // Active scope still applies on top of the hierarchy branch.
      if (req.activeScope?.clientId != null) {
        baseConditions.push(`c.client_id = $${baseParamIndex}`);
        baseParams.push(req.activeScope.clientId);
        baseParamIndex++;
      }
      if (req.activeScope?.productId != null) {
        baseConditions.push(`c.product_id = $${baseParamIndex}`);
        baseParams.push(req.activeScope.productId);
        baseParamIndex++;
      }
    }
  }

  // NEW-CRIT-1 (AUDIT 2026-05-17): soft-delete filter unconditional
  // across list + export + stats — DPDP erasure intent.
  baseConditions.push('kdv.deleted_at IS NULL');

  return { baseConditions, baseParams, baseParamIndex };
}

/**
 * P15.M-6: row-level scope helper used by every KYC handler that
 * resolves a `kyc_document_verifications.id` (route param :taskId on
 * the KYC routes). Resolves the parent case id, then delegates to the
 * shared `enforceBackendUserCaseScope` helper from attachmentsController
 * — which itself enforces:
 *   1. scoped-ops users only see cases in their assigned client/product
 *   2. cases must be within `req.activeScope` if a lock is set
 *   3. hierarchy / creator-based ownership rules
 * Returns 404 (don't leak row existence) when either the kdv row is
 * missing or the caller cannot access the parent case. Handlers should
 * call this at the very top before any DB work.
 */
const requireKycRowAccess = async (
  req: AuthenticatedRequest,
  kdvId: string
): Promise<{ ok: true; caseId: string } | { ok: false }> => {
  const userId = req.user?.id;
  if (!userId || !kdvId) {
    return { ok: false };
  }
  // F9.3 (2026-05-26): also fetch assigned_to so KYC execution actors
  // (kyc.verify holders without supervisory perms) can access tasks
  // explicitly assigned to them even when enforceBackendUserCaseScope
  // would otherwise reject (e.g. they have no client/product mappings).
  const lookup = await query<{ caseId: string; assignedTo: string | null }>(
    // NEW-CRIT-1 (AUDIT 2026-05-17): soft-deleted KYC docs must not surface in
    // permission lookups — DPDP erasure intent. Returns NOT_FOUND.
    `SELECT case_id, assigned_to FROM kyc_document_verifications WHERE id = $1 AND deleted_at IS NULL`,
    [kdvId]
  );
  if (lookup.rows.length === 0) {
    return { ok: false };
  }
  const caseId = lookup.rows[0].caseId;
  const assignedTo = lookup.rows[0].assignedTo;
  // KYC execution actor self-assigned shortcut — bypasses case-scope check.
  if (isKycExecutionActor(req.user) && assignedTo === userId) {
    return { ok: true, caseId };
  }
  const allowed = await enforceBackendUserCaseScope(userId, req.user, caseId, req.activeScope);
  if (!allowed) {
    return { ok: false };
  }
  return { ok: true, caseId };
};

/**
 * KYC Document Verification Controller
 * Handles CRUD + verification workflow for KYC document tasks
 */

// Phase 1.4 (2026-05-04, revised): document type list optionally filters
// by (clientId, productId) using TWO joins:
//   - INNER JOIN `client_product_documents` → only return doc types
//     assigned to this (client, product) pair
//   - LEFT  JOIN `kyc_rates`     → annotate each row with
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
//                document_types ←→ kyc_rates (LEFT JOIN, optional)
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
         LEFT JOIN kyc_rates dtr
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
      sortBy = 'createdAt',
      sortOrder = 'desc',
      caseId,
      dateFrom,
      dateTo,
      recheckedOnly,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    // BASE WHERE via shared helper (scope + soft-delete; used by stats too).
    const baseWhere = await buildKycTasksBaseWhereClause(req);
    const conditions = [...baseWhere.baseConditions];
    const params = [...baseWhere.baseParams];
    let paramIndex = baseWhere.baseParamIndex;

    // USER FILTERS (NOT applied to stats — see getKYCTaskStats below).
    if (status && status !== 'ALL') {
      conditions.push(`kdv.verification_status = $${paramIndex}`);
      params.push(status as string);
      paramIndex++;
    }
    if (statusNot) {
      conditions.push(`kdv.verification_status != $${paramIndex}`);
      params.push(statusNot as string);
      paramIndex++;
    }
    if (documentType) {
      conditions.push(
        `kdv.document_type_id = (SELECT id FROM document_types WHERE code = $${paramIndex} AND is_active = true LIMIT 1)`
      );
      params.push(documentType as string);
      paramIndex++;
    }
    // F9.1 (2026-05-26): "Recheck KYC" page filter — show only rows that
    // have been rechecked at least once (recheck_count > 0). Rows may be in
    // any current state since recheck resets back to PENDING.
    if (recheckedOnly === 'true' || recheckedOnly === '1') {
      conditions.push(`kdv.recheck_count > 0`);
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
    if (dateFrom) {
      conditions.push(`kdv.created_at >= $${paramIndex}`);
      params.push(dateFrom as string);
      paramIndex++;
    }
    if (dateTo) {
      // Canonical inclusive-end-of-day semantic (mirrors invoices/MIS/tasks/cases).
      conditions.push(`kdv.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
      params.push(dateTo as string);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Sort via shared module-scope KYC_TASKS_SORT_MAP.
    const sortCol = KYC_TASKS_SORT_MAP[sortBy as string] || 'kdv.created_at';
    const sortDir = (sortOrder as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Count — JOIN vt added so scope conditions that reference
    // vt.assigned_to resolve correctly.
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM kyc_document_verifications kdv
       JOIN cases c ON c.id = kdv.case_id
       JOIN verification_tasks vt ON vt.id = kdv.verification_task_id
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

    // Inline statistics block REMOVED 2026-05-23 (post-filter-sweep cleanup).
    // All FE consumers migrated to GET /api/kyc/tasks/stats during the KYC
    // sub-sweep (commit afce2107). The inline stats query was a wasted SQL
    // round-trip per list fetch — KYCDashboardPage no longer reads
    // `taskData.statistics`. The dedicated /kyc/tasks/stats endpoint
    // (getKYCTaskStats) is the single source for KYC aggregates and stays
    // cached via analytics keyGen.

    res.json({
      success: true,
      data: {
        data: dataResult.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('Error listing KYC tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to list KYC tasks' });
  }
};

// Get single KYC task detail
/**
 * Canonical 5-card stats endpoint for /kyc-verification/* dashboard pages.
 * GET /api/kyc/tasks/stats
 *
 * Returns aggregates over the scope-narrowed KYC pool (ignores route-
 * specific status/statusNot/documentType/search filters — partition
 * counters reflect the FULL in-scope KYC tasks so cards stay meaningful
 * regardless of which route the user is on).
 */
export const getKYCTaskStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const baseWhere = await buildKycTasksBaseWhereClause(req);
    const whereClause =
      baseWhere.baseConditions.length > 0 ? `WHERE ${baseWhere.baseConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE kdv.verification_status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE kdv.verification_status = 'ASSIGNED') as assigned,
        COUNT(*) FILTER (WHERE kdv.verification_status = 'IN_PROGRESS') as "inProgress",
        COUNT(*) FILTER (WHERE kdv.verification_status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE kdv.verification_status = 'REVOKED') as revoked,
        COUNT(*) FILTER (WHERE kdv.verification_status IN ('PENDING','ASSIGNED','IN_PROGRESS')) as open,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Positive') as positive,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Negative') as negative,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Refer') as referred,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Fraud') as fraud,
        COUNT(*) FILTER (
          WHERE kdv.verification_status = 'COMPLETED' AND kdv.verified_at >= CURRENT_DATE
        ) as "completedToday",
        COUNT(*) FILTER (
          WHERE kdv.verification_status = 'COMPLETED'
          AND kdv.verified_at >= date_trunc('week', CURRENT_DATE)
        ) as "completedThisWeek",
        COUNT(*) FILTER (
          WHERE kdv.verification_status NOT IN ('COMPLETED','REVOKED')
          AND kdv.created_at < NOW() - INTERVAL '3 days'
        ) as "agingOver3Days",
        AVG(EXTRACT(EPOCH FROM (kdv.verified_at - kdv.created_at)) / 3600.0) FILTER (
          WHERE kdv.verification_status = 'COMPLETED' AND kdv.verified_at IS NOT NULL
        ) as "avgVerifyHours",
        -- Distinct KYC verifiers actively assigned. Truthful-sweep
        -- 2026-05-26 added so analytics can show field agent + KYC
        -- verifier headcounts side by side.
        COUNT(DISTINCT vt.assigned_to) FILTER (WHERE vt.assigned_to IS NOT NULL)
          as "activeKycVerifiers"
       FROM kyc_document_verifications kdv
       JOIN cases c ON c.id = kdv.case_id
       JOIN verification_tasks vt ON vt.id = kdv.verification_task_id
       ${whereClause}`,
      baseWhere.baseParams
    );

    const row = result.rows[0] || {};
    const num = (key: string): number => parseInt(row[key] || '0', 10);
    const flt = (key: string): number => parseFloat(row[key] || '0');

    const completed = num('completed');
    const positive = num('positive');
    const positiveRate = completed > 0 ? Math.round((positive / completed) * 100) : 0;

    res.json({
      success: true,
      data: {
        total: num('total'),
        pending: num('pending'),
        assigned: num('assigned'),
        inProgress: num('inProgress'),
        completed,
        revoked: num('revoked'),
        open: num('open'),
        positive,
        negative: num('negative'),
        referred: num('referred'),
        fraud: num('fraud'),
        positiveRate,
        completedToday: num('completedToday'),
        completedThisWeek: num('completedThisWeek'),
        agingOver3Days: num('agingOver3Days'),
        avgVerifyHours: flt('avgVerifyHours'),
        activeKycVerifiers: num('activeKycVerifiers'),
      },
      message: 'KYC task stats retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting KYC task stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get KYC task stats',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getKYCTaskDetail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = String(req.params.taskId || '');

    // P15.M-6 — row-level scope check. Without this, any user with
    // kyc.view permission could read any KYC row globally by guessing
    // the kdv id (P13.F closed list/stats only, not row-level).
    const access = await requireKycRowAccess(req, taskId);
    if (!access.ok) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

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
    const taskId = String(req.params.taskId || '');
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

    // P15.M-6 — row-level scope check before any DB mutation.
    const access = await requireKycRowAccess(req, taskId);
    if (!access.ok) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    const client = wrapClient(await pool.connect());
    try {
      await client.query('BEGIN');

      // F9.1 (2026-05-26): require IN_PROGRESS — verifier must call /start
      // first. Mirrors field-task workflow (PENDING → IN_PROGRESS → COMPLETED).
      // Without this guard, a direct API call could (a) skip the start step
      // entirely or (b) overwrite a recorded final_status on a COMPLETED
      // row, breaking the audit trail. IN_PROGRESS is the only valid state
      // for verify.
      const statusCheck = await client.query<{ verificationStatus: string }>(
        `SELECT verification_status FROM kyc_document_verifications
         WHERE id = $1 AND deleted_at IS NULL`,
        [taskId]
      );
      if (statusCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'KYC task not found' });
      }
      const currentStatus = statusCheck.rows[0].verificationStatus;
      if (currentStatus !== 'IN_PROGRESS') {
        await client.query('ROLLBACK');
        const editCheck = checkEditable(currentStatus);
        // For COMPLETED/REVOKED return canonical EDIT_BLOCKED so FE shows
        // the standard "cannot edit" copy. For PENDING/ASSIGNED (still
        // editable but not a valid verify-source state) return
        // INVALID_STATE_TRANSITION — FE should call /start first.
        if (!editCheck.editable) {
          return res.status(409).json(buildEditBlockedResponse('KYC document', editCheck));
        }
        return res.status(409).json({
          success: false,
          message: `KYC document must be in IN_PROGRESS state to verify; current state is ${currentStatus}. Call /start first.`,
          error: { code: 'INVALID_STATE_TRANSITION', currentStatus },
        });
      }

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
        // NEW-CRIT-1 (AUDIT 2026-05-17): soft-deleted must not count toward pending.
        `SELECT COUNT(*) as pending FROM kyc_document_verifications
         WHERE verification_task_id = $1 AND verification_status = 'PENDING' AND deleted_at IS NULL`,
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

        // Snapshot financial state via shared finalizer (frozen actual_amount
        // for KYC tasks pulls from estimated_amount populated at case-create
        // from kyc_rates). Keeps KYC + field completion symmetric.
        await TaskCompletionFinalizer.snapshotFinancials(client, verificationTaskId);

        // Delegate to canonical 5-rule formula in CaseStatusSyncService.
        // Prior inline derivation only handled the all-COMPLETED case and
        // mis-resolved mixed states (e.g. 1×COMPLETED + 1×PENDING from a
        // newly-added Revisit task → wrongly stayed COMPLETED).
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);
      }

      await client.query('COMMIT');

      // Post-commit financial hooks (commission auto-calc no-ops for KYC since
      // rate_type_id is NULL — kept for symmetry + future KYC commission rules).
      await TaskCompletionFinalizer.triggerPostCompletionHooks(verificationTaskId);

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
    const taskId = String(req.params.taskId || '');
    const { assignedTo } = req.body;
    const userId = req.user!.id;

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'assignedTo is required' });
    }

    // P15.M-6 — row-level scope check before reassignment.
    const access = await requireKycRowAccess(req, taskId);
    if (!access.ok) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    // F9.1 + F9.3 (2026-05-26): also flip child verification_status. Two
    // valid transitions on assign:
    //   PENDING → ASSIGNED  (first-time route to verifier)
    //   REVOKED → ASSIGNED  (post-revoke reassign — clears revoke metadata
    //                        so the new verifier sees a clean task)
    // Don't touch IN_PROGRESS (verifier in-flight) or COMPLETED (terminal).
    const result = await query(
      `UPDATE kyc_document_verifications
       SET assigned_to = $1, assigned_by = $2, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
           verification_status = CASE
             WHEN verification_status IN ('PENDING','REVOKED') THEN 'ASSIGNED'
             ELSE verification_status
           END,
           revoked_at = CASE WHEN verification_status = 'REVOKED' THEN NULL ELSE revoked_at END,
           revoked_by = CASE WHEN verification_status = 'REVOKED' THEN NULL ELSE revoked_by END,
           revocation_reason = CASE WHEN verification_status = 'REVOKED' THEN NULL ELSE revocation_reason END,
           revoke_reason_id = CASE WHEN verification_status = 'REVOKED' THEN NULL ELSE revoke_reason_id END
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

// F9.1 (2026-05-26): KYC state-transition endpoints (start / revoke / recheck).
// Mirrors verification_tasks workflow. Per-document state lives on
// kyc_document_verifications.verification_status. CHECK constraint allows
// PENDING / ASSIGNED / IN_PROGRESS / COMPLETED / REVOKED.

// Valid KYC transitions — narrower than field task because verify is the only
// terminal-decision path (no separate complete step). COMPLETED → PENDING is
// allowed via /recheck so operators can re-open a verified doc when an error
// is caught post-decision.
const KYC_VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'IN_PROGRESS', 'REVOKED'],
  ASSIGNED: ['IN_PROGRESS', 'REVOKED'],
  IN_PROGRESS: ['COMPLETED', 'REVOKED'],
  COMPLETED: ['PENDING'], // via /recheck
  REVOKED: ['PENDING'], // via /recheck
};

const canKycTransition = (from: string, to: string): boolean =>
  (KYC_VALID_TRANSITIONS[from] || []).includes(to);

// POST /api/kyc/tasks/:taskId/start
// PENDING/ASSIGNED → IN_PROGRESS. Sets started_at + started_by.
export const startKYCTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = String(req.params.taskId || '');
    const userId = req.user!.id;

    const access = await requireKycRowAccess(req, taskId);
    if (!access.ok) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    const client = wrapClient(await pool.connect());
    try {
      await client.query('BEGIN');

      const statusCheck = await client.query<{ verificationStatus: string }>(
        `SELECT verification_status FROM kyc_document_verifications
         WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [taskId]
      );
      if (statusCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'KYC task not found' });
      }
      const currentStatus = statusCheck.rows[0].verificationStatus;
      if (!canKycTransition(currentStatus, 'IN_PROGRESS')) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Cannot start KYC document from status ${currentStatus}.`,
          error: { code: 'INVALID_STATE_TRANSITION', currentStatus },
        });
      }

      const updateResult = await client.query(
        `UPDATE kyc_document_verifications
         SET verification_status = 'IN_PROGRESS',
             started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
             started_by = COALESCE(started_by, $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING verification_task_id`,
        [userId, taskId]
      );

      // F9.1 (2026-05-26): mirror state onto parent verification_tasks.
      // Trigger task_status_transitions only allows PENDING→ASSIGNED→IN_PROGRESS,
      // so push the parent through both hops here (only effective when it's
      // still in the earlier state). Without this, the eventual ASSIGNED→COMPLETED
      // jump on verify is rejected by enforce_verification_task_status_transition.
      const parentTaskId = updateResult.rows[0].verificationTaskId as string;
      await client.query(
        `UPDATE verification_tasks SET status='ASSIGNED', updated_at=CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'PENDING'`,
        [parentTaskId]
      );
      await client.query(
        `UPDATE verification_tasks SET status='IN_PROGRESS', started_at=COALESCE(started_at, CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'ASSIGNED'`,
        [parentTaskId]
      );

      // F9.1 Gap A: roll up case status so the parent case reflects the new
      // task state (PENDING/ASSIGNED → IN_PROGRESS may flip the case to
      // IN_PROGRESS too). Same in-transaction pattern as verifyKYCDocument.
      await CaseStatusSyncService.recalculateCaseStatus(access.caseId, client);

      await client.query('COMMIT');

      await createAuditLog({
        userId,
        action: 'KYC_STARTED',
        entityType: 'KYC',
        entityId: taskId,
        details: { previousStatus: currentStatus },
      });

      res.json({
        success: true,
        message: 'KYC document started',
        data: { id: taskId, status: 'IN_PROGRESS' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error starting KYC document:', error);
    res.status(500).json({ success: false, message: 'Failed to start KYC document' });
  }
};

// POST /api/kyc/tasks/:taskId/revoke
// PENDING/ASSIGNED/IN_PROGRESS → REVOKED. Writes kyc_revocations row.
// Requires revokeReason. Clears assigned_to.
export const revokeKYCTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = String(req.params.taskId || '');
    const userId = req.user!.id;
    const reason = String(req.body.revokeReason || req.body.reason || '').trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Revocation reason is required',
        error: { code: 'REASON_REQUIRED' },
      });
    }

    const access = await requireKycRowAccess(req, taskId);
    if (!access.ok) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    const revokeReasonId = await TaskRevocationService.resolveReasonId(reason);
    const revokedByRole = TaskRevocationService.deriveRevokedByRole(req.user);

    const client = wrapClient(await pool.connect());
    try {
      await client.query('BEGIN');

      const lookup = await client.query<{ verificationStatus: string; assignedTo: string | null }>(
        `SELECT verification_status, assigned_to FROM kyc_document_verifications
         WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [taskId]
      );
      if (lookup.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'KYC task not found' });
      }
      const currentStatus = lookup.rows[0].verificationStatus;
      const previousAssignee = lookup.rows[0].assignedTo;

      if (!canKycTransition(currentStatus, 'REVOKED')) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Cannot revoke a KYC document in status ${currentStatus}.`,
          error: { code: 'INVALID_STATE_TRANSITION', currentStatus },
        });
      }

      await client.query(
        `UPDATE kyc_document_verifications
         SET verification_status = 'REVOKED',
             revoked_at = CURRENT_TIMESTAMP,
             revoked_by = $1,
             revocation_reason = $2,
             revoke_reason_id = $3,
             assigned_to = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [userId, reason, revokeReasonId, taskId]
      );

      await client.query(
        `INSERT INTO kyc_revocations (
           kyc_id, revoked_by_user_id, revoked_by_role, revoked_from_user_id,
           revoke_reason, revoke_reason_id, previous_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [taskId, userId, revokedByRole, previousAssignee, reason, revokeReasonId, currentStatus]
      );

      // F9.1 Gap A: roll up case status. A revoked task may push the case to
      // REVOKED (if all siblings revoked) or leave it IN_PROGRESS / PENDING.
      await CaseStatusSyncService.recalculateCaseStatus(access.caseId, client);

      await client.query('COMMIT');

      await createAuditLog({
        userId,
        action: 'KYC_REVOKED',
        entityType: 'KYC',
        entityId: taskId,
        details: { previousStatus: currentStatus, reason, revokeReasonId },
      });

      res.json({
        success: true,
        message: 'KYC document revoked',
        data: { id: taskId, status: 'REVOKED' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error revoking KYC document:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke KYC document' });
  }
};

// POST /api/kyc/tasks/:taskId/recheck
// REVOKED → PENDING. Increments recheck_count. Clears revoke_* fields and
// assigned_to (a fresh verifier must pick it up).
export const recheckKYCTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = String(req.params.taskId || '');
    const userId = req.user!.id;

    const access = await requireKycRowAccess(req, taskId);
    if (!access.ok) {
      return res.status(404).json({ success: false, message: 'KYC task not found' });
    }

    const client = wrapClient(await pool.connect());
    try {
      await client.query('BEGIN');

      const lookup = await client.query<{ verificationStatus: string; recheckCount: number }>(
        `SELECT verification_status, recheck_count FROM kyc_document_verifications
         WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [taskId]
      );
      if (lookup.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'KYC task not found' });
      }
      const currentStatus = lookup.rows[0].verificationStatus;
      if (!canKycTransition(currentStatus, 'PENDING')) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Cannot recheck a KYC document in status ${currentStatus}. Recheck requires REVOKED or COMPLETED.`,
          error: { code: 'INVALID_STATE_TRANSITION', currentStatus },
        });
      }

      const recheckResult = await client.query<{ verificationTaskId: string }>(
        `UPDATE kyc_document_verifications
         SET verification_status = 'PENDING',
             recheck_count = recheck_count + 1,
             revoked_at = NULL,
             revoked_by = NULL,
             revocation_reason = NULL,
             revoke_reason_id = NULL,
             started_at = NULL,
             started_by = NULL,
             assigned_to = NULL,
             assigned_by = NULL,
             assigned_at = NULL,
             verified_at = NULL,
             verified_by = NULL,
             final_status = NULL,
             remarks = NULL,
             rejection_reason = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING verification_task_id`,
        [taskId]
      );

      // F9.1 (2026-05-26): if parent verification_task is COMPLETED (Flow C —
      // rechecking a finalized KYC), push parent back to ASSIGNED so the next
      // start can transition ASSIGNED → IN_PROGRESS. Trigger allows
      // COMPLETED → ASSIGNED (seeded in task_status_transitions). For the
      // REVOKED-side flow (Flow B), parent is already IN_PROGRESS — leave it.
      const parentTaskId = recheckResult.rows[0].verificationTaskId;
      await client.query(
        `UPDATE verification_tasks
         SET status = 'ASSIGNED', completed_at = NULL, verification_outcome = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'COMPLETED'`,
        [parentTaskId]
      );

      // F9.1 Gap A: roll up case status. Rechecking a COMPLETED row re-opens
      // the case (COMPLETED → ASSIGNED). Rechecking a REVOKED row when other
      // siblings are active reverts case to ASSIGNED/IN_PROGRESS.
      await CaseStatusSyncService.recalculateCaseStatus(access.caseId, client);

      await client.query('COMMIT');

      await createAuditLog({
        userId,
        action: 'KYC_RECHECKED',
        entityType: 'KYC',
        entityId: taskId,
        details: { previousStatus: currentStatus, recheckCount: lookup.rows[0].recheckCount + 1 },
      });

      res.json({
        success: true,
        message: 'KYC document rechecked',
        data: { id: taskId, status: 'PENDING' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error rechecking KYC document:', error);
    res.status(500).json({ success: false, message: 'Failed to recheck KYC document' });
  }
};

// Upload document for KYC task
// F8.2.3: writes through StorageService + populates document_storage_key alongside
// the legacy document_file_path. Reads still use document_file_path until the
// production S3 cutover, when document_file_path is dropped.
export const uploadKYCDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = String(req.params.taskId || '');
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    // Look up the KYC row to derive case_id + a stable doc-type code for the storage key.
    // 2026-05-05 (bug 50): the case-creation response returns kycTasks[].id =
    // verification_tasks.id (the parent task record), but historically this
    // controller only matched kdv.id. The case-create fan-out POSTed the
    // verification_tasks.id and 404'd here. Accept either ID — the
    // (verification_task_id, case_id) pair is unique for KYC tasks anyway.
    const lookup = await query<{ id: string; caseId: string; docCode: string | null }>(
      // NEW-CRIT-1 (AUDIT 2026-05-17): hide soft-deleted from doc-code lookup.
      `SELECT kdv.id,
              kdv.case_id AS "caseId",
              dt.code AS "docCode"
         FROM kyc_document_verifications kdv
         LEFT JOIN document_types dt ON dt.id = kdv.document_type_id
        WHERE (kdv.id = $1 OR kdv.verification_task_id = $1)
          AND kdv.deleted_at IS NULL
        LIMIT 1`,
      [taskId]
    );

    // P15.M-6 — scope check before file upload. The lookup above
    // already covers row existence; we still need to verify the
    // resolved case is in the user's scope (assigned + activeScope)
    // before writing a 20MB file to disk under another tenant.
    if (lookup.rows.length > 0) {
      const allowed = await enforceBackendUserCaseScope(
        req.user?.id,
        req.user,
        lookup.rows[0].caseId,
        req.activeScope
      );
      if (!allowed) {
        return res.status(404).json({ success: false, message: 'KYC task not found' });
      }
    }
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
    // Use the resolved kdv.id from the lookup (above), not the URL param,
    // because the URL param may have been a verification_task_id.
    const resolvedKdvId = kycRow.id;
    const result = await query(
      `UPDATE kyc_document_verifications
       SET document_file_path = $1, document_file_name = $2,
           document_file_size = $3, document_mime_type = $4,
           document_storage_key = $5, sha256_hash = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id`,
      [filePath, file.originalname, file.size, file.mimetype, storageKey, sha256Hash, resolvedKdvId]
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
       -- NEW-CRIT-1 (AUDIT 2026-05-17): hide soft-deleted from case-doc list.
       WHERE kdv.case_id = $1 AND kdv.deleted_at IS NULL
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
    const { status, statusNot, documentType, search, dateFrom, dateTo, sortBy, sortOrder } =
      req.query;

    // BASE WHERE via shared helper (lockstep with /kyc/tasks list + /kyc/tasks/stats).
    const baseWhere = await buildKycTasksBaseWhereClause(req);
    const conditions = [...baseWhere.baseConditions];
    const params: QueryParams = [...baseWhere.baseParams];
    let paramIndex = baseWhere.baseParamIndex;

    if (status && status !== 'ALL') {
      conditions.push(`kdv.verification_status = $${paramIndex}`);
      params.push(status as string);
      paramIndex++;
    }
    if (statusNot) {
      conditions.push(`kdv.verification_status != $${paramIndex}`);
      params.push(statusNot as string);
      paramIndex++;
    }
    if (documentType) {
      conditions.push(
        `kdv.document_type_id = (SELECT id FROM document_types WHERE code = $${paramIndex} AND is_active = true LIMIT 1)`
      );
      params.push(documentType as string);
      paramIndex++;
    }
    if (search) {
      conditions.push(
        `(c.customer_name ILIKE $${paramIndex} OR kdv.document_number ILIKE $${paramIndex} OR kdv.document_holder_name ILIKE $${paramIndex})`
      );
      params.push(`%${search as string}%`);
      paramIndex++;
    }
    if (dateFrom) {
      conditions.push(`kdv.created_at >= $${paramIndex}`);
      params.push(dateFrom as string);
      paramIndex++;
    }
    if (dateTo) {
      // Canonical inclusive-end-of-day semantic.
      conditions.push(`kdv.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
      params.push(dateTo as string);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Sort via shared KYC_TASKS_SORT_MAP — operators expect xlsx ORDER to
    // match the on-screen list (filter-sweep §6 audit invariant).
    const sortCol = KYC_TASKS_SORT_MAP[sortBy as string] || 'kdv.created_at';
    const sortDir = (sortOrder as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 10k row cap via SQL LIMIT.
    const limitParamIndex = paramIndex;
    params.push(KYC_EXPORT_ROW_LIMIT);

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
       JOIN verification_tasks vt ON vt.id = kdv.verification_task_id
       LEFT JOIN document_types kdt ON kdt.id = kdv.document_type_id
       LEFT JOIN users u_verified ON u_verified.id = kdv.verified_by
       LEFT JOIN users u_assigned ON u_assigned.id = kdv.assigned_to
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST
       LIMIT $${limitParamIndex}`,
      params
    );

    // DPDP §11 audit row PRE-stream (mirrors CASE_EXPORTED / INVOICE_EXPORTED
    // / TASK_EXPORTED). Captured before the network write starts so the
    // intent is logged even if streaming fails partway.
    await createAuditLog({
      action: 'KYC_EXPORTED',
      entityType: 'KYC_DOCUMENT_VERIFICATION',
      userId: req.user?.id,
      details: { rowCount: result.rows.length, filters: req.query },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

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
      sheet.addRow(escapeFormulaRow(row));
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
