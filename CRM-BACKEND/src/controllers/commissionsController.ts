import type { Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';
import type { CommissionCalculation } from '@/types/commission';
import { requireControllerPermission } from '@/security/controllerAuthorization';
import {
  appendOperationalScopeConditions,
  resolveDataScope,
  valueAllowedByScope,
} from '@/security/dataScope';

// Extended interface for query results including joined fields
interface CommissionCalculationRow extends CommissionCalculation {
  userName?: string;
  userEmail?: string;
  approvedByName?: string;
  paidByName?: string;
}

interface CountResult {
  total: string;
}

const COMMISSION_PRODUCT_SCOPE_EXPR = `(SELECT c.product_id FROM cases c WHERE c.id = cc.case_id)`;

const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// GET /api/commissions - List commissions with pagination and filters
export const getCommissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveDataScope(req);
    const {
      page = 1,
      limit = 20,
      userId,
      status,
      clientId,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`cc.user_id = $${paramIndex++}`);
      params.push(userId as string);
    }

    if (status) {
      conditions.push(`cc.status = $${paramIndex++}`);
      params.push(status as string);
    }

    if (clientId) {
      conditions.push(`cc.client_id = $${paramIndex++}`);
      params.push(parseInt(clientId as string, 10));
    }

    if (dateFrom) {
      conditions.push(`cc.created_at >= $${paramIndex++}`);
      params.push(dateFrom as string);
    }

    if (dateTo) {
      conditions.push(`cc.created_at <= $${paramIndex++}`);
      params.push(dateTo as string);
    }

    if (search && typeof search === 'string') {
      conditions.push(`(
        u.name ILIKE $${paramIndex} OR
        u.username ILIKE $${paramIndex} OR
        cc.case_number::text ILIKE $${paramIndex} OR
        cc."notes" ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    appendOperationalScopeConditions({
      scope,
      conditions,
      params: params as unknown as Array<string | number | boolean | string[] | number[]>,
      userExpr: `cc.user_id`,
      clientExpr: `cc.client_id`,
      productExpr: COMMISSION_PRODUCT_SCOPE_EXPR,
    });
    paramIndex = params.length + 1;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const validSortColumns = [
      'createdAt',
      'commissionAmount',
      'status',
      'caseCompletedAt',
      'approvedAt',
      'paidAt',
    ];
    const safeSortBy: string = validSortColumns.includes(sortBy as string)
      ? `"${sortBy as string}"`
      : 'created_at';
    const safeSortOrder: 'ASC' | 'DESC' = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const limitNum = Math.max(1, Number(limit) || 20);
    const pageNum = Math.max(1, Number(page) || 1);
    const offset = (pageNum - 1) * limitNum;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM commission_calculations cc
      LEFT JOIN users u ON cc.user_id = u.id
      ${whereClause}
    `;
    const countResult = await query<CountResult>(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query
    const dataQuery = `
      SELECT
        cc.*,
        u.name as user_name,
        u.email as "userEmail",
        u2.name as "approvedByName",
        u3.name as "paidByName",
        ${COMMISSION_PRODUCT_SCOPE_EXPR} as "scopeProductId"
      FROM commission_calculations cc
      LEFT JOIN users u ON cc.user_id = u.id
      LEFT JOIN users u2 ON cc.approved_by = u2.id
      LEFT JOIN users u3 ON cc.paid_by = u3.id
      ${whereClause}
      ORDER BY cc.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limitNum, offset);
    const result = await query<CommissionCalculationRow>(dataQuery, params);

    logger.info(`Retrieved ${result.rows.length} commissions`, {
      userId: req.user?.id,
      filters: { userId, status, clientId, search },
      pagination: { page, limit },
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Error retrieving commissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve commissions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/commissions/:id - Get commission by ID
export const getCommissionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const scope = await resolveDataScope(req);

    const sql = `
      SELECT
        cc.*,
        u.name as user_name,
        u.email as "userEmail",
        u2.name as "approvedByName",
        u3.name as "paidByName"
      FROM commission_calculations cc
      LEFT JOIN users u ON cc.user_id = u.id
      LEFT JOIN users u2 ON cc.approved_by = u2.id
      LEFT JOIN users u3 ON cc.paid_by = u3.id
      WHERE cc.id = $1
    `;

    const result = await query<CommissionCalculationRow>(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (
      !valueAllowedByScope(
        {
          userId: (result.rows[0] as unknown as { userId?: string }).userId ?? null,
          clientId: toOptionalNumber((result.rows[0] as unknown as { clientId?: number }).clientId),
          productId: toOptionalNumber(
            (result.rows[0] as unknown as { scopeProductId?: number }).scopeProductId
          ),
        },
        scope
      )
    ) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved commission ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error retrieving commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve commission',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/:id/approve - Approve commission
export const approveCommission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req, res, 'billing.approve')) {
      return;
    }
    const { id } = req.params;
    const { notes } = req.body;
    const approverId = req.user?.id;
    const scope = await resolveDataScope(req);

    // Check current status
    const checkSql = `
      SELECT
        cc.status,
        cc.user_id,
        cc.client_id,
        ${COMMISSION_PRODUCT_SCOPE_EXPR} as "scopeProductId"
      FROM commission_calculations cc
      WHERE cc.id = $1
    `;
    const checkResult = await query<{
      status: string;
      user_id: string;
      client_id: number;
      scopeProductId: number | null;
    }>(checkSql, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (
      !valueAllowedByScope(
        {
          userId: checkResult.rows[0].user_id,
          clientId: Number(checkResult.rows[0].client_id),
          productId: toOptionalNumber(checkResult.rows[0].scopeProductId),
        },
        scope
      )
    ) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (checkResult.rows[0].status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Commission is already approved',
        error: { code: 'ALREADY_APPROVED' },
      });
    }

    const updateSql = `
      UPDATE commission_calculations
      SET
        status = 'APPROVED',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        notes = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const updateResult = await query<CommissionCalculation>(updateSql, [
      approverId,
      notes || null,
      id,
    ]);

    logger.info(`Commission approved: ${id}`, {
      userId: approverId,
      commissionAmount: updateResult.rows[0].commissionAmount,
    });

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Commission approved successfully',
    });
  } catch (error) {
    logger.error('Error approving commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve commission',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/:id/mark-paid - Mark commission as paid
export const markCommissionPaid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req, res, 'billing.approve')) {
      return;
    }
    const { id } = req.params;
    const { paidDate, paymentMethod, transactionId, notes } = req.body;
    const payerId = req.user?.id;
    const scope = await resolveDataScope(req);

    const checkSql = `
      SELECT
        cc.status,
        cc.paid_at,
        cc.user_id,
        cc.client_id,
        ${COMMISSION_PRODUCT_SCOPE_EXPR} as "scopeProductId"
      FROM commission_calculations cc
      WHERE cc.id = $1
    `;
    const checkResult = await query<{
      status: string;
      paid_at: string | null;
      user_id: string;
      client_id: number;
      scopeProductId: number | null;
    }>(checkSql, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (
      !valueAllowedByScope(
        {
          userId: checkResult.rows[0].user_id,
          clientId: Number(checkResult.rows[0].client_id),
          productId: toOptionalNumber(checkResult.rows[0].scopeProductId),
        },
        scope
      )
    ) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (checkResult.rows[0].status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Commission must be approved before marking as paid',
        error: { code: 'NOT_APPROVED' },
      });
    }

    if (checkResult.rows[0].paid_at) {
      return res.status(400).json({
        success: false,
        message: 'Commission is already marked as paid',
        error: { code: 'ALREADY_PAID' },
      });
    }

    const updateSql = `
      UPDATE commission_calculations
      SET
        status = 'PAID',
        paid_by = $1,
        paid_at = $2,
        payment_method = $3,
        transaction_id = $4,
        notes = CASE 
          WHEN notes IS NULL OR notes = '' THEN $5::text
          ELSE notes || E'\nPayment: ' || $5::text
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const updateResult = await query<CommissionCalculation>(updateSql, [
      payerId,
      paidDate || new Date().toISOString(),
      paymentMethod,
      transactionId,
      notes || 'Paid via system',
      id,
    ]);

    logger.info(`Commission marked as paid: ${id}`, {
      userId: payerId,
      commissionAmount: updateResult.rows[0].commissionAmount,
    });

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Commission marked as paid successfully',
    });
  } catch (error) {
    logger.error('Error marking commission as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark commission as paid',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/commissions/summary - Get commission summary
interface SummaryStats {
  totalCommissions: string | number;
  totalAmount: string | number;
  pendingCommissions: string | number;
  pendingAmount: string | number;
  approvedCommissions: string | number;
  approvedAmount: string | number;
  paidCommissions: string | number;
  paidAmount: string | number;
}

interface UserSummaryStats extends SummaryStats {
  user_id: string;
  user_name: string;
}

export const getCommissionSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveDataScope(req);
    const { userId, period = 'month' } = req.query;

    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`cc.user_id = $${paramIndex++}`);
      params.push(userId as string);
    }

    appendOperationalScopeConditions({
      scope,
      conditions,
      params: params as unknown as Array<string | number | boolean | string[] | number[]>,
      userExpr: `cc.user_id`,
      clientExpr: `cc.client_id`,
      productExpr: COMMISSION_PRODUCT_SCOPE_EXPR,
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summarySql = `
      SELECT
        COUNT(*) as "totalCommissions",
        COALESCE(SUM("commissionAmount"), 0) as "totalAmount",
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as "pendingCommissions",
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN "commissionAmount" ELSE 0 END), 0) as "pendingAmount",
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as "approvedCommissions",
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN "commissionAmount" ELSE 0 END), 0) as "approvedAmount",
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as "paidCommissions",
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN "commissionAmount" ELSE 0 END), 0) as "paidAmount"
      FROM commission_calculations cc
      ${whereClause}
    `;

    const summaryResult = await query<SummaryStats>(summarySql, params);
    const stats = summaryResult.rows[0];

    const userSummarySql = `
      SELECT
        cc.user_id,
        u.name as user_name,
        COUNT(*) as "totalCommissions",
        COALESCE(SUM("commissionAmount"), 0) as "totalAmount",
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN "commissionAmount" ELSE 0 END), 0) as "paidAmount",
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN "commissionAmount" ELSE 0 END), 0) as "pendingAmount"
      FROM commission_calculations cc
      LEFT JOIN users u ON cc.user_id = u.id
      ${whereClause}
      GROUP BY cc.user_id, u.name
    `;

    const userSummaryResult = await query<UserSummaryStats>(userSummarySql, params);

    res.json({
      success: true,
      data: {
        totalCommissions: Number(stats.totalCommissions || 0),
        totalAmount: Number(stats.totalAmount || 0),
        pendingCommissions: Number(stats.pendingCommissions || 0),
        pendingAmount: Number(stats.pendingAmount || 0),
        approvedCommissions: Number(stats.approvedCommissions || 0),
        approvedAmount: Number(stats.approvedAmount || 0),
        paidCommissions: Number(stats.paidCommissions || 0),
        paidAmount: Number(stats.paidAmount || 0),
        userSummary: userSummaryResult.rows.map(row => ({
          userId: row.user_id,
          userName: row.user_name,
          totalCommissions: Number(row.totalCommissions),
          totalAmount: Number(row.totalAmount),
          paidAmount: Number(row.paidAmount),
          pendingAmount: Number(row.pendingAmount),
        })),
        period,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting commission summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get commission summary',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/bulk-approve - Bulk approve commissions
interface BulkApproveResult {
  id: number;
}

export const bulkApproveCommissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req, res, 'billing.approve')) {
      return;
    }
    const { commissionIds, notes } = req.body;
    const approverId = req.user?.id;
    const scope = await resolveDataScope(req);

    if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission IDs array is required',
        error: { code: 'MISSING_DATA' },
      });
    }

    const bulkConditions = [`cc.id = ANY($3::int[])`, `cc.status != 'APPROVED'`];
    const bulkParams: Array<string | number | boolean | string[] | number[]> = [
      approverId || '',
      notes || null,
      [] as number[],
    ];

    appendOperationalScopeConditions({
      scope,
      conditions: bulkConditions,
      params: bulkParams,
      userExpr: `cc.user_id`,
      clientExpr: `cc.client_id`,
      productExpr: COMMISSION_PRODUCT_SCOPE_EXPR,
    });

    const sql = `
      UPDATE commission_calculations cc
      SET
        status = 'APPROVED',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        notes = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
      WHERE ${bulkConditions.join(' AND ')}
      RETURNING id
    `;

    const numericIds = (commissionIds as string[]).map(id => Number(id)).filter(n => !isNaN(n));

    if (numericIds.length === 0) {
      return res.status(400).json({ message: 'Invalid IDs provided' });
    }

    bulkParams[2] = numericIds;
    const result = await query<BulkApproveResult>(sql, bulkParams);
    const approvedIds = result.rows.map(r => r.id);
    const failedCount = commissionIds.length - approvedIds.length;

    logger.info(`Bulk approved ${approvedIds.length} commissions`, {
      userId: approverId,
      requested: commissionIds.length,
      approved: approvedIds.length,
    });

    res.json({
      success: true,
      data: {
        approved: approvedIds,
        failedCount,
        message: `Successfully approved ${approvedIds.length} commissions`,
      },
    });
  } catch (error) {
    logger.error('Error in bulk approve:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve commissions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/bulk-mark-paid - Bulk mark commissions as paid
export const bulkMarkCommissionsPaid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req, res, 'billing.approve')) {
      return;
    }
    const { commissionIds, paymentMethod, transactionId, notes } = req.body;
    const payerId = req.user?.id;
    const scope = await resolveDataScope(req);

    if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission IDs array is required',
        error: { code: 'MISSING_DATA' },
      });
    }

    const bulkConditions = [
      `cc.id = ANY($5::int[])`,
      `cc.status = 'APPROVED'`,
      `cc.paid_at IS NULL`,
    ];
    const bulkParams: Array<string | number | boolean | string[] | number[]> = [
      payerId || '',
      paymentMethod as string,
      transactionId as string,
      notes || 'Bulk paid',
      [] as number[],
    ];

    appendOperationalScopeConditions({
      scope,
      conditions: bulkConditions,
      params: bulkParams,
      userExpr: `cc.user_id`,
      clientExpr: `cc.client_id`,
      productExpr: COMMISSION_PRODUCT_SCOPE_EXPR,
    });

    const sql = `
      UPDATE commission_calculations cc
      SET
        status = 'PAID',
        paid_by = $1,
        paid_at = CURRENT_TIMESTAMP,
        payment_method = $2,
        transaction_id = $3,
        notes = CASE 
          WHEN notes IS NULL OR notes = '' THEN $4::text
          ELSE notes || E'\nPayment: ' || $4::text
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE ${bulkConditions.join(' AND ')}
      RETURNING id
    `;

    const numericIds = (commissionIds as string[]).map(id => Number(id)).filter(n => !isNaN(n));

    if (numericIds.length === 0) {
      return res.status(400).json({ message: 'Invalid IDs provided' });
    }

    bulkParams[4] = numericIds;
    const result = await query<{ id: number }>(sql, bulkParams);

    const paidIds = result.rows.map(r => r.id);
    const failedCount = commissionIds.length - paidIds.length;

    logger.info(`Bulk marked ${paidIds.length} commissions as paid`, {
      userId: payerId,
      requested: commissionIds.length,
      paid: paidIds.length,
    });

    res.json({
      success: true,
      data: {
        paid: paidIds,
        failedCount,
        message: `Successfully marked ${paidIds.length} commissions as paid`,
      },
    });
  } catch (error) {
    logger.error('Error in bulk mark paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk mark commissions as paid',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
