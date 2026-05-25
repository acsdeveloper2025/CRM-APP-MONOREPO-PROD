/**
 * A2.2 (audit 2026-05-25): admin CRUD for the revoke_reasons master.
 *
 * Replaces the drift-prone hardcoded lists in CRM-FRONTEND and crm-mobile-native
 * with a real lookup table. The `code` column is the stable identifier and is
 * IMMUTABLE post-create — changing it would break the FK semantics for any
 * task_revocations.revoke_reason_id rows pointing at it. The PUT endpoint
 * accepts only label/sortOrder/isActive.
 *
 * Soft-delete-only by design: toggle is_active=false to retire a reason
 * without losing the FK pointer on historical revocations. No hard DELETE.
 */
import { Response } from 'express';
import { query } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/config/logger';

type RevokeReasonRow = {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const REVOKE_REASON_SORT_MAP: Record<string, string> = {
  sortOrder: 'sort_order',
  label: 'label',
  code: 'code',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const parseIsActiveFilter = (raw: unknown): boolean | null => {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null; // 'all' / undefined → no filter
};

/**
 * GET /api/revoke-reasons
 * List with optional ?isActive=true|false|all + sort.
 * No pagination — table is small by design (≤ ~20 rows ever expected).
 */
export const getRevokeReasons = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isActive = parseIsActiveFilter(req.query.isActive);
    const sortByKey = (req.query.sortBy as string) || 'sortOrder';
    const sortColumn = REVOKE_REASON_SORT_MAP[sortByKey] || 'sort_order';
    const sortOrderRaw = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : 'asc';
    const sortOrder = sortOrderRaw.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const params: unknown[] = [];
    let where = '';
    if (isActive !== null) {
      params.push(isActive);
      where = `WHERE is_active = $${params.length}`;
    }

    const result = await query(
      `
        SELECT id, code, label, sort_order, is_active, created_at, updated_at
        FROM revoke_reasons
        ${where}
        ORDER BY ${sortColumn} ${sortOrder}, id ASC
      `,
      params
    );

    res.json({
      success: true,
      message: 'Revoke reasons fetched',
      data: result.rows as RevokeReasonRow[],
    });
  } catch (error) {
    logger.error('getRevokeReasons failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revoke reasons',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * GET /api/revoke-reasons/active
 * Lightweight endpoint for FE/mobile dropdown consumption. Returns only
 * active rows sorted by sort_order. No filtering options — this is the
 * "give me what users can pick" path.
 */
export const getActiveRevokeReasons = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `
        SELECT id, code, label, sort_order
        FROM revoke_reasons
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, id ASC
      `,
      []
    );
    res.json({
      success: true,
      message: 'Active revoke reasons fetched',
      data: result.rows,
    });
  } catch (error) {
    logger.error('getActiveRevokeReasons failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active revoke reasons',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * GET /api/revoke-reasons/:id
 */
export const getRevokeReasonById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await query(
      `
        SELECT id, code, label, sort_order, is_active, created_at, updated_at
        FROM revoke_reasons
        WHERE id = $1
      `,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Revoke reason not found',
        error: { code: 'NOT_FOUND' },
      });
      return;
    }
    res.json({
      success: true,
      message: 'Revoke reason fetched',
      data: result.rows[0] as RevokeReasonRow,
    });
  } catch (error) {
    logger.error('getRevokeReasonById failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revoke reason',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * POST /api/revoke-reasons
 * Body: { code, label, sortOrder?, isActive? }
 */
export const createRevokeReason = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      code,
      label,
      sortOrder = 0,
      isActive = true,
    } = req.body as {
      code: string;
      label: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    const normalizedCode = String(code).trim().toUpperCase();
    if (!/^[A-Z_]+$/.test(normalizedCode)) {
      res.status(400).json({
        success: false,
        message: 'Code must contain only uppercase letters and underscores',
        error: { code: 'INVALID_CODE' },
      });
      return;
    }

    const existing = await query(`SELECT id FROM revoke_reasons WHERE code = $1`, [normalizedCode]);
    if (existing.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'A revoke reason with this code already exists',
        error: { code: 'CODE_CONFLICT' },
      });
      return;
    }

    const result = await query(
      `
        INSERT INTO revoke_reasons (code, label, sort_order, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id, code, label, sort_order, is_active, created_at, updated_at
      `,
      [normalizedCode, String(label).trim(), sortOrder, isActive]
    );

    res.status(201).json({
      success: true,
      message: 'Revoke reason created',
      data: result.rows[0] as RevokeReasonRow,
    });
  } catch (error) {
    logger.error('createRevokeReason failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: 'Failed to create revoke reason',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * PUT /api/revoke-reasons/:id
 * Body: { label?, sortOrder?, isActive? }
 * `code` is intentionally omitted — immutable post-create.
 */
export const updateRevokeReason = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { label, sortOrder, isActive } = req.body as {
      label?: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    // Dynamic field-build map (B6 prevention per code quality standards)
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (label !== undefined) {
      sets.push(`label = $${idx++}`);
      params.push(String(label).trim());
    }
    if (sortOrder !== undefined) {
      sets.push(`sort_order = $${idx++}`);
      params.push(sortOrder);
    }
    if (isActive !== undefined) {
      sets.push(`is_active = $${idx++}`);
      params.push(isActive);
    }

    if (sets.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No fields provided to update',
        error: { code: 'NO_UPDATE_FIELDS' },
      });
      return;
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `
        UPDATE revoke_reasons
        SET ${sets.join(', ')}
        WHERE id = $${idx}
        RETURNING id, code, label, sort_order, is_active, created_at, updated_at
      `,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Revoke reason not found',
        error: { code: 'NOT_FOUND' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Revoke reason updated',
      data: result.rows[0] as RevokeReasonRow,
    });
  } catch (error) {
    logger.error('updateRevokeReason failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: 'Failed to update revoke reason',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
