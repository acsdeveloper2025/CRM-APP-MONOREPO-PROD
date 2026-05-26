import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

// Shared WHERE-clause builder for getVerificationTypes + exportVerificationTypes.
// Returns SQL `WHERE …` fragment + params.
const buildVerificationTypesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const { search, isActive, createdFrom, createdTo, excludeKyc } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (search && typeof search === 'string' && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereConditions.push(
      `(COALESCE(name, '') ILIKE $${paramIndex} OR COALESCE(code, '') ILIKE $${paramIndex} OR COALESCE(description, '') ILIKE $${paramIndex})`
    );
    queryParams.push(searchTerm);
    paramIndex++;
  }

  if (typeof isActive === 'boolean') {
    whereConditions.push(`is_active = $${paramIndex}`);
    queryParams.push(isActive);
    paramIndex++;
  } else if (isActive === 'true' || isActive === 'false') {
    whereConditions.push(`is_active = $${paramIndex}`);
    queryParams.push(isActive === 'true');
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    whereConditions.push(`created_at >= $${paramIndex}`);
    queryParams.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    whereConditions.push(`created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    queryParams.push(createdTo);
    paramIndex++;
  }

  // F9.2 (2026-05-26): field-task dropdowns pass excludeKyc=true so the
  // synthetic 'KYC Verification' row (used only as the parent type for KYC
  // tasks) doesn't appear in case/task creation flows. Admin
  // VerificationTypesPage and ProductMappingsEditor stay unfiltered.
  if (excludeKyc === 'true' || excludeKyc === '1') {
    whereConditions.push(`code <> 'KYC'`);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

const SORT_COLUMN_MAP: Record<string, string> = {
  name: 'name',
  code: 'code',
  category: 'category',
  basePrice: 'base_price',
  estimatedTime: 'estimated_time',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// GET /api/verification-types - List verification types with pagination and filters
export const getVerificationTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const {
      whereClause,
      queryParams,
      nextParamIndex: paramIndex,
    } = buildVerificationTypesWhereClause(req);

    const countQuery = `SELECT COUNT(*)::text as count FROM verification_types ${whereClause}`;
    const countRes = await query<{ count: string }>(countQuery, queryParams);
    const totalCount = Number(countRes.rows[0]?.count || 0);

    const sortCol = SORT_COLUMN_MAP[typeof sortBy === 'string' ? sortBy : ''] || 'name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // M10: secondary ORDER BY id so OFFSET pagination is deterministic
    // when rows share the same sort column value.
    const dataQuery = `SELECT id, name, code, description, is_active, created_at, updated_at,
       EXISTS (
         SELECT 1 FROM rates r WHERE r.verification_type_id = verification_types.id AND r.is_active = true
       ) as "hasRates"
       FROM verification_types ${whereClause} ORDER BY ${sortCol} ${sortDir}, id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataParams = [...queryParams, Number(limit), (Number(page) - 1) * Number(limit)];
    const vtRes = await query(dataQuery, dataParams);
    const verificationTypes = vtRes.rows;

    logger.info(`Retrieved ${verificationTypes.length} verification types from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: verificationTypes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving verification types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/verification-types/:id - Get verification type by ID
export const getVerificationTypeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vtRes2 = await query(
      `SELECT id, name, code, description, is_active, created_at, updated_at FROM verification_types WHERE id = $1`,
      [Number(id)]
    );
    const verificationType = vtRes2.rows[0];
    if (!verificationType) {
      return res.status(404).json({
        success: false,
        message: 'Verification type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved verification type ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: verificationType,
    });
  } catch (error) {
    logger.error('Error retrieving verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/verification-types - Create new verification type
export const createVerificationType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code } = req.body;

    // Check if verification type code already exists
    const exRes = await query(`SELECT id FROM verification_types WHERE code = $1`, [code]);
    const existingVerificationType = exRes.rows[0];

    if (existingVerificationType) {
      return res.status(400).json({
        success: false,
        message: 'Verification type code already exists',
        error: { code: 'DUPLICATE_CODE' },
      });
    }

    const newRes = await query(
      `INSERT INTO verification_types (name, code, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [name, code]
    );
    const newVerificationType = newRes.rows[0];

    logger.info(`Created new verification type: ${newVerificationType.id}`, {
      userId: req.user?.id,
      verificationTypeName: name,
      verificationTypeCode: code,
    });

    res.status(201).json({
      success: true,
      data: newVerificationType,
      message: 'Verification type created successfully',
    });
  } catch (error) {
    logger.error('Error creating verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/verification-types/:id - Update verification type
export const updateVerificationType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body as { name?: string; code?: string; isActive?: boolean };

    const exRes2 = await query(
      `SELECT id, name, code, description, is_active, created_at, updated_at FROM verification_types WHERE id = $1`,
      [id]
    );
    const existingVerificationType = exRes2.rows[0];

    if (!existingVerificationType) {
      return res.status(404).json({
        success: false,
        message: 'Verification type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (updateData.code && updateData.code !== existingVerificationType.code) {
      const dupRes = await query(`SELECT id FROM verification_types WHERE code = $1`, [
        updateData.code,
      ]);
      const duplicateVerificationType = dupRes.rows[0];

      if (duplicateVerificationType) {
        return res.status(400).json({
          success: false,
          message: 'Verification type code already exists',
          error: { code: 'DUPLICATE_CODE' },
        });
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (updateData.name) {
      updatePayload.name = updateData.name;
    }
    if (updateData.code) {
      updatePayload.code = updateData.code;
    }
    if (typeof updateData.isActive === 'boolean') {
      updatePayload.is_active = updateData.isActive;
    }

    const sets: string[] = [];
    const vals: QueryParams = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updatePayload)) {
      sets.push(`"${key}" = $${idx++}`);
      vals.push(value as string | number | boolean | Date | number[] | string[]);
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(id);
    const updRes = await query(
      `UPDATE verification_types SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    const updatedVerificationType = updRes.rows[0];

    logger.info(`Updated verification type: ${id}`, {
      userId: req.user?.id,
      verificationTypeId: id,
      updates: Object.keys(updatePayload),
    });

    res.json({
      success: true,
      data: updatedVerificationType,
      message: 'Verification type updated successfully',
    });
  } catch (error) {
    logger.error('Error updating verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/verification-types/:id - Delete verification type
export const deleteVerificationType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const exRes3 = await query(
      `SELECT id, name, code, description, is_active, created_at, updated_at FROM verification_types WHERE id = $1`,
      [id]
    );
    const existingVerificationType = exRes3.rows[0];

    if (!existingVerificationType) {
      return res.status(404).json({
        success: false,
        message: 'Verification type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    await query(`DELETE FROM verification_types WHERE id = $1`, [id]);

    logger.info(`Deleted verification type: ${id}`, {
      userId: req.user?.id,
      verificationTypeId: id,
      verificationTypeName: existingVerificationType.name,
    });

    res.json({
      success: true,
      message: 'Verification type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/verification-types/stats - Get verification type statistics
export const getVerificationTypeStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as recently_added_count,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM rates r WHERE r.verification_type_id = verification_types.id AND r.is_active = true
        ) THEN 1 END)::int as with_rates_count
      FROM verification_types
    `);
    const row = statsRes.rows[0] || {};
    const stats = {
      total: row.total ?? 0,
      active: row.active ?? 0,
      inactive: row.inactive ?? 0,
      recentlyAddedCount: row.recently_added_count ?? 0,
      withRatesCount: row.with_rates_count ?? 0,
      // verification_types has no category column; keep the bucket so
      // downstream FE/MIS that expect this shape doesn't break.
      byCategory: { OTHER: row.total ?? 0 },
    };

    res.json({
      success: true,
      data: stats,
      message: 'Verification type statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving verification type statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification type statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/verification-types/export - xlsx download mirroring list filters.
const EXPORT_ROW_LIMIT = 10000;

export const exportVerificationTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;
    const {
      whereClause,
      queryParams,
      nextParamIndex: paramIndex,
    } = buildVerificationTypesWhereClause(req);

    const sortCol = SORT_COLUMN_MAP[typeof sortBy === 'string' ? sortBy : ''] || 'name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query<{
      id: number;
      name: string;
      code: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      hasRates: boolean;
    }>(
      `SELECT id, name, code, description, is_active, created_at,
              EXISTS (
                SELECT 1 FROM rates r WHERE r.verification_type_id = verification_types.id AND r.is_active = true
              ) as "hasRates"
         FROM verification_types ${whereClause}
         ORDER BY ${sortCol} ${sortDir}, id ASC
         LIMIT $${paramIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );
    const rows = listRes.rows;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Verification Types');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Has Rates', key: 'hasRates', width: 10 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' },
    };

    for (const r of rows) {
      ws.addRow(
        escapeFormulaRow({
          name: r.name,
          code: r.code,
          description: r.description || '',
          hasRates: r.hasRates ? 'YES' : 'NO',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        })
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `verification_types_${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    void createAuditLog({
      action: 'VERIFICATION_TYPE_EXPORTED',
      entityType: 'VERIFICATION_TYPE',
      entityId: undefined,
      userId: req.user!.id,
      details: {
        rowCount: rows.length,
        filename,
        filters: {
          search: typeof req.query.search === 'string' ? req.query.search : null,
          isActive:
            typeof req.query.isActive === 'string' || typeof req.query.isActive === 'boolean'
              ? String(req.query.isActive)
              : null,
          createdFrom: typeof req.query.createdFrom === 'string' ? req.query.createdFrom : null,
          createdTo: typeof req.query.createdTo === 'string' ? req.query.createdTo : null,
          sortBy: typeof sortBy === 'string' ? sortBy : 'name',
          sortOrder: sortDir.toLowerCase(),
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    await workbook.xlsx.write(res);
    res.end();
    logger.info(`Verification types exported: ${filename}, ${rows.length} rows`);
  } catch (error) {
    logger.error('Error exporting verification types:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export verification types',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
};
