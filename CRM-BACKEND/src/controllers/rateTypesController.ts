import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

const EXPORT_ROW_LIMIT = 10000;

// Shared WHERE-clause builder for getRateTypes + exportRateTypes so the two
// stay in lockstep. Returns SQL `WHERE …` fragment + positional params.
// Mirrors the Client Mgmt pattern (buildClientsWhereClause).
const buildRateTypesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const { search, isActive, createdFrom, createdTo } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (search && typeof search === 'string') {
    whereConditions.push(
      `(COALESCE(name, '') ILIKE $${paramIndex} OR COALESCE(description, '') ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  // 'all' / undefined → no filter; 'true'/'false' (string or boolean) → flip is_active branch.
  if (isActive === 'true' || isActive === 'false') {
    whereConditions.push(`is_active = $${paramIndex}`);
    queryParams.push(isActive === 'true');
    paramIndex++;
  } else if (typeof isActive === 'boolean') {
    whereConditions.push(`is_active = $${paramIndex}`);
    queryParams.push(isActive);
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

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

// GET /api/rate-types - List rate types with pagination and filters
export const getRateTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', sortOrder = 'asc' } = req.query;
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);

    const { whereClause, queryParams: values } = buildRateTypesWhereClause(req);

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM rate_types ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get rate types with pagination
    const offset = (safePage - 1) * safeLimit;
    // API contract: sortBy is camelCase; map to snake_case DB column.
    const sortColumnMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 'name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM rate_types
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, safeLimit, offset]
    );
    const rateTypes = listRes.rows;

    logger.info(`Retrieved ${rateTypes.length} rate types from database`, {
      userId: req.user?.id,
      page: safePage,
      limit: safeLimit,
      search: search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: rateTypes,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    logger.error('Error retrieving rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-types/:id - Get rate type by ID
export const getRateTypeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rateTypeRes = await query(
      `SELECT id, name, description, is_active, created_at, updated_at FROM rate_types WHERE id = $1`,
      [Number(id)]
    );
    const rateType = rateTypeRes.rows[0];

    if (!rateType) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved rate type ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: rateType,
    });
  } catch (error) {
    logger.error('Error retrieving rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/rate-types - Create new rate type
export const createRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, isActive = true } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Rate type name is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Upsert on (name). Name is the natural key; description + is_active
    // are the editable non-key fields. If the name exists, update those
    // instead of rejecting with 400 — resubmitting the same name with an
    // updated description is the intuitive way to change a rate type.
    const existingRes = await query(`SELECT id FROM rate_types WHERE name = $1 LIMIT 1`, [name]);
    if (existingRes.rows[0]) {
      const existingId = existingRes.rows[0].id;
      const updateRes = await query(
        `UPDATE rate_types
         SET description = $1,
             is_active = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, description, is_active, created_at, updated_at`,
        [description || null, isActive, existingId]
      );
      const updatedRateType = updateRes.rows[0];

      logger.info(`Upserted rate type (updated existing): ${existingId}`, {
        userId: req.user?.id,
        rateTypeName: name,
        description: description || '',
      });

      return res.status(200).json({
        success: true,
        data: { ...updatedRateType, updated: true },
        message: 'Rate type updated successfully',
      });
    }

    // Create rate type in database
    const insertRes = await query(
      `INSERT INTO rate_types (name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, description, is_active, created_at, updated_at`,
      [name, description || null, isActive]
    );
    const newRateType = insertRes.rows[0];

    logger.info(`Created new rate type: ${newRateType.id}`, {
      userId: req.user?.id,
      rateTypeName: name,
      description: description || '',
    });

    res.status(201).json({
      success: true,
      data: newRateType,
      message: 'Rate type created successfully',
    });
  } catch (error) {
    logger.error('Error creating rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-types/available-for-case - Get available rate types for case assignment
export const getAvailableRateTypesForCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, verificationTypeId } = req.query;

    // Validate required parameters
    if (!clientId || !productId || !verificationTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Product ID, and Verification Type ID are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Get rate types that are assigned to this combination and have rates
    const availableRes = await query(
      `SELECT DISTINCT
        rt.id,
        rt.name,
        rt.description,
        rt.is_active,
        r.amount,
        r.currency,
        CASE WHEN r.id IS NOT NULL THEN true ELSE false END as "has_rate"
       FROM rate_type_assignments rta
       JOIN rate_types rt ON rta.rate_type_id = rt.id
       LEFT JOIN rates r ON rta.client_id = r.client_id
         AND rta.product_id = r.product_id
         AND rta.verification_type_id = r.verification_type_id
         AND rta.rate_type_id = r.rate_type_id
         AND r.is_active = true
       WHERE rta.client_id = $1
         AND rta.product_id = $2
         AND rta.verification_type_id = $3
         AND rta.is_active = true
         AND rt.is_active = true
       ORDER BY rt.name ASC`,
      [Number(clientId), Number(productId), Number(verificationTypeId)]
    );

    const availableRateTypes = availableRes.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      amount: row.amount,
      currency: row.currency || 'INR',
      hasRate: row.hasRate,
    }));

    logger.info(`Retrieved ${availableRateTypes.length} available rate types for case assignment`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      rateTypeCount: availableRateTypes.length,
    });

    res.json({
      success: true,
      data: availableRateTypes,
      message: `Found ${availableRateTypes.length} available rate types`,
    });
  } catch (error) {
    logger.error('Error fetching available rate types for case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/rate-types/:id - Update rate type
export const updateRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body as { name?: string; description?: string; isActive?: boolean };

    // Check if rate type exists
    const existingRes = await query(`SELECT id, name FROM rate_types WHERE id = $1`, [Number(id)]);
    const existingRateType = existingRes.rows[0];

    if (!existingRateType) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for duplicate name if being updated
    if (updateData.name && updateData.name !== existingRateType.name) {
      const dupRes = await query(`SELECT 1 FROM rate_types WHERE name = $1`, [updateData.name]);
      if (dupRes.rowCount && dupRes.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Rate type name already exists',
          error: { code: 'DUPLICATE_NAME' },
        });
      }
    }

    // Prepare update data
    const updatePayload: Record<string, unknown> = {};
    if (updateData.name) {
      updatePayload.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      updatePayload.description = updateData.description;
    }
    if (updateData.isActive !== undefined) {
      updatePayload.isActive = updateData.isActive;
    }

    // Build dynamic update — map camelCase JS keys to snake_case
    // DB column names. The prior code used `"${key}"` which
    // double-quoted camelCase keys, but PostgreSQL treats
    // double-quoted identifiers as case-sensitive so "isActive"
    // doesn't match the real column is_active.
    const camelToSnakeMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      isActive: 'is_active',
    };
    const sets: string[] = [];
    const vals: QueryParams = [];
    let idx = 1;
    for (const key of Object.keys(updatePayload)) {
      const dbCol = camelToSnakeMap[key] || key;
      sets.push(`${dbCol} = $${idx++}`);
      vals.push(updatePayload[key] as string | number | boolean | Date | number[] | string[]);
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(Number(id));

    const updRes = await query(
      `UPDATE rate_types SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, description, is_active, created_at, updated_at`,
      vals
    );
    const updatedRateType = updRes.rows[0];

    logger.info(`Updated rate type: ${id}`, {
      userId: req.user?.id,
      rateTypeId: id,
      updates: Object.keys(updatePayload),
    });

    res.json({
      success: true,
      data: updatedRateType,
      message: 'Rate type updated successfully',
    });
  } catch (error) {
    logger.error('Error updating rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/rate-types/:id - Delete rate type
export const deleteRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if rate type exists
    const existRes = await query(`SELECT id, name FROM rate_types WHERE id = $1`, [Number(id)]);
    const existingRateType = existRes.rows[0];

    if (!existingRateType) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if rate type is being used in assignments or rates
    const usageRes = await query(
      `SELECT
        (SELECT COUNT(*) FROM rate_type_assignments WHERE rate_type_id = $1) as assignments,
        (SELECT COUNT(*) FROM rates WHERE rate_type_id = $1) as rates`,
      [Number(id)]
    );
    const usage = usageRes.rows[0];

    if (Number(usage.assignments) > 0 || Number(usage.rates) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete rate type that is being used in assignments or rates',
        error: { code: 'RATE_TYPE_IN_USE' },
      });
    }

    // Delete rate type
    await query(`DELETE FROM rate_types WHERE id = $1`, [Number(id)]);

    logger.info(`Deleted rate type: ${id}`, {
      userId: req.user?.id,
      rateTypeId: id,
      rateTypeName: existingRateType.name,
    });

    res.json({
      success: true,
      message: 'Rate type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-types/stats - 5-card stats aggregate. Filter-standardization
// sweep Page 1 (2026-05-22) extended this with recentlyAddedCount (last 30
// days) + usedInRatesCount (EXISTS in rates) to fill out the canonical
// 5-card shell (§9.1 feedback_fe_code_standards.md).
export const getRateTypeStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query<{
      total: number;
      active: number;
      inactive: number;
      recentlyAddedCount: number;
      usedInRatesCount: number;
    }>(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as "recentlyAddedCount",
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM rates r WHERE r.rate_type_id = rate_types.id
        ) THEN 1 END)::int as "usedInRatesCount"
      FROM rate_types
    `);
    const stats = statsRes.rows[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      recentlyAddedCount: 0,
      usedInRatesCount: 0,
    };

    res.json({
      success: true,
      data: stats,
      message: 'Rate type statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving rate type statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate type statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-types/export - xlsx download mirroring list filters via the
// shared buildRateTypesWhereClause helper. Hard cap EXPORT_ROW_LIMIT rows;
// every user-controlled cell passes through escapeFormulaRow (CWE-1236).
// MUST stay declared BEFORE /:id in the router.
export const exportRateTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildRateTypesWhereClause(req);

    const sortColumnMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 'name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query<{
      id: number;
      name: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date | null;
    }>(
      `SELECT id, name, description, is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM rate_types
         ${whereClause}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${nextParamIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );

    await createAuditLog({
      action: 'RATE_TYPE_EXPORTED',
      entityType: 'RATE_TYPE',
      entityId: undefined,
      userId: req.user?.id,
      details: { rowCount: listRes.rows.length, filters: req.query },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rate Types');
    ws.addRow(['Name', 'Description', 'Created Date', 'Updated Date', 'Status']);
    for (const r of listRes.rows) {
      ws.addRow(
        escapeFormulaRow([
          r.name,
          r.description ?? '',
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '',
          r.isActive ? 'ACTIVE' : 'INACTIVE',
        ])
      );
    }

    const filename = `rate_types_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buf = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (error) {
    logger.error('Error exporting rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
