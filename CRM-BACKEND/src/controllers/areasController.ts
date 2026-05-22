import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { sendError, errors } from '@/utils/apiResponse';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

// Shared WHERE-clause builder for getAreas + exportAreas.
const buildAreasWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const { search, isActive, pincodeId, createdFrom, createdTo } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (search && typeof search === 'string') {
    whereConditions.push(`COALESCE(a.name, '') ILIKE $${paramIndex}`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (isActive === 'true' || isActive === 'false') {
    whereConditions.push(`a.is_active = $${paramIndex}`);
    queryParams.push(isActive === 'true');
    paramIndex++;
  }

  if (pincodeId !== undefined && pincodeId !== null && pincodeId !== '' && pincodeId !== 'all') {
    const pid = Number(pincodeId);
    if (Number.isFinite(pid)) {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM pincode_areas pax WHERE pax.area_id = a.id AND pax.pincode_id = $${paramIndex})`
      );
      queryParams.push(pid);
      paramIndex++;
    }
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    whereConditions.push(`a.created_at >= $${paramIndex}`);
    queryParams.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    whereConditions.push(`a.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    queryParams.push(createdTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

// GET /api/areas - List areas with pagination and filters
export const getAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildAreasWhereClause(req);

    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortField = sortBy as string;
    let orderBy: string;
    if (sortField === 'usageCount') {
      orderBy = `"usageCount" ${sortDirection}`;
    } else if (sortField === 'createdAt') {
      orderBy = `a.created_at ${sortDirection}`;
    } else if (sortField === 'updatedAt') {
      orderBy = `a.updated_at ${sortDirection}`;
    } else {
      orderBy = `a.name ${sortDirection}`;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const sql = `
      SELECT
        a.id,
        a.name,
        a.is_active AS "isActive",
        a.created_at AS "createdAt",
        a.updated_at AS "updatedAt",
        COALESCE(COUNT(pa.id), 0)::int AS "usageCount"
      FROM areas a
      LEFT JOIN pincode_areas pa ON pa.area_id = a.id
      ${whereClause}
      GROUP BY a.id, a.name, a.is_active, a.created_at, a.updated_at
      ORDER BY ${orderBy}
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;
    const result = await query(sql, [...queryParams, limitNum, offset]);

    const countSql = `
      SELECT COUNT(DISTINCT a.id) FROM areas a
      ${whereClause}
    `;
    const countResult = await query<{ count: string }>(countSql, queryParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: result.rows.map(area => ({
        ...area,
        id: area.id.toString(),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: totalPages,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    logger.error('Error retrieving areas:', error);
    errors.internal(res, 'Failed to retrieve areas');
  }
};

// GET /api/standalone-areas - Get standalone areas for multi-select
export const getStandaloneAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query('SELECT id, name FROM areas ORDER BY name ASC');

    res.json({
      success: true,
      data: result.rows.map(area => ({
        ...area,
        id: area.id.toString(),
      })),
    });
  } catch (error) {
    logger.error('Error retrieving standalone areas:', error);
    errors.internal(res, 'Failed to retrieve standalone areas');
  }
};

// GET /api/areas/:id - Get area by ID
export const getAreaById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT
        a.id,
        a.name,
        a.is_active AS "isActive",
        a.created_at AS "createdAt",
        a.updated_at AS "updatedAt",
        COUNT(pa.id)::int AS "usageCount"
      FROM areas a
      LEFT JOIN pincode_areas pa ON pa.area_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, a.name, a.is_active, a.created_at, a.updated_at
    `;

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return errors.notFound(res, 'Area');
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error retrieving area:', error);
    errors.internal(res, 'Failed to retrieve area');
  }
};

// POST /api/areas - Create standalone area
export const createArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return sendError(
        res,
        400,
        'Valid area name is required (minimum 2 characters)',
        'VALIDATION_ERROR'
      );
    }

    const existingAreaCheck = await query(
      'SELECT id FROM areas WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name.trim()]
    );

    if (existingAreaCheck.rows.length > 0) {
      return sendError(res, 400, 'Area with this name already exists', 'DUPLICATE_AREA');
    }

    const result = await query(
      `INSERT INTO areas (name, created_at, updated_at)
       VALUES ($1, NOW(), NOW())
       RETURNING id, name, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name.trim()]
    );

    const newArea = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Area created successfully',
      data: {
        ...newArea,
        id: newArea.id.toString(),
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return sendError(res, 400, 'Area with this name already exists', 'DUPLICATE_AREA');
    }

    logger.error('Error creating area:', error);
    errors.internal(res, 'Failed to create area');
  }
};

// PUT /api/areas/:id - Update area
export const updateArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const areaCheck = await query('SELECT id, name FROM areas WHERE id = $1', [id]);

    if (areaCheck.rows.length === 0) {
      return errors.notFound(res, 'Area');
    }

    const updateFields: string[] = [];
    const updateValues: QueryParams = [];
    let paramCount = 0;

    if (typeof name === 'string' && name.trim().length >= 2) {
      const duplicateCheck = await query(
        'SELECT id FROM areas WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name.trim(), id]
      );
      if (duplicateCheck.rows.length > 0) {
        return sendError(res, 400, 'Area name already exists', 'DUPLICATE_AREA');
      }
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name.trim());
    }

    if (typeof isActive === 'boolean') {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return sendError(res, 400, 'No valid fields to update', 'NO_UPDATE_FIELDS');
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    paramCount++;
    updateValues.push(id);

    const result = await query(
      `UPDATE areas SET ${updateFields.join(', ')} WHERE id = $${paramCount}
       RETURNING id, name, is_active AS "isActive", updated_at AS "updatedAt"`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Area updated successfully',
      data: {
        ...result.rows[0],
        id: result.rows[0].id.toString(),
      },
    });
  } catch (error) {
    logger.error('Error updating area:', error);
    errors.internal(res, 'Failed to update area');
  }
};

// DELETE /api/areas/:id - Delete area
export const deleteArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const areaCheck = await query('SELECT id, name FROM areas WHERE id = $1', [id]);

    if (areaCheck.rows.length === 0) {
      return errors.notFound(res, 'Area');
    }

    const areaName = areaCheck.rows[0].name;

    const usageCheck = await query(
      'SELECT COUNT(*) AS count FROM pincode_areas WHERE area_id = $1',
      [id]
    );
    const usageCount = parseInt(usageCheck.rows[0].count, 10);

    if (usageCount > 0) {
      return sendError(
        res,
        400,
        `Cannot delete area "${areaName}" as it is assigned to ${usageCount} pincode(s)`,
        'AREA_IN_USE'
      );
    }

    await query('DELETE FROM areas WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Area deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting area:', error);
    errors.internal(res, 'Failed to delete area');
  }
};

// GET /api/areas/stats - Canonical 5-card aggregate
export const getAreasStats = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const aggRes = await query<{
      total: string;
      active: string;
      inactive: string;
      recentlyAdded: string;
      mapped: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_active = true)::text AS active,
         COUNT(*) FILTER (WHERE is_active = false)::text AS inactive,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS "recentlyAdded",
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM pincode_areas pa WHERE pa.area_id = a.id))::text AS mapped
       FROM areas a`
    );

    const row = aggRes.rows[0];

    res.json({
      success: true,
      data: {
        total: parseInt(row.total, 10),
        active: parseInt(row.active, 10),
        inactive: parseInt(row.inactive, 10),
        recentlyAddedCount: parseInt(row.recentlyAdded, 10),
        mappedCount: parseInt(row.mapped, 10),
      },
    });
  } catch (error) {
    logger.error('Error getting areas stats:', error);
    errors.internal(res, 'Failed to get areas statistics');
  }
};

// GET /api/areas/export - xlsx download mirroring getAreas filters.
const EXPORT_ROW_LIMIT = 10000;

export const exportAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildAreasWhereClause(req);

    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortField = sortBy as string;
    let orderBy: string;
    if (sortField === 'usageCount') {
      orderBy = `"usageCount" ${sortDirection}`;
    } else if (sortField === 'createdAt') {
      orderBy = `a.created_at ${sortDirection}`;
    } else {
      orderBy = `a.name ${sortDirection}`;
    }

    const rowsRes = await query<{
      name: string;
      usageCount: number;
      isActive: boolean;
      createdAt: Date;
    }>(
      `SELECT a.name,
              a.is_active AS "isActive",
              a.created_at AS "createdAt",
              COALESCE(COUNT(pa.id), 0)::int AS "usageCount"
       FROM areas a
       LEFT JOIN pincode_areas pa ON pa.area_id = a.id
       ${whereClause}
       GROUP BY a.id, a.name, a.is_active, a.created_at
       ORDER BY ${orderBy}
       LIMIT $${nextParamIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );
    const rows = rowsRes.rows;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Areas');
    ws.columns = [
      { header: 'Name', key: 'name', width: 40 },
      { header: 'Usage Count', key: 'usageCount', width: 14 },
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
          usageCount: Number(r.usageCount),
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        })
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `areas_${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    void createAuditLog({
      action: 'AREA_EXPORTED',
      entityType: 'AREA',
      entityId: undefined,
      userId: req.user!.id,
      details: {
        rowCount: rows.length,
        filename,
        filters: {
          search: typeof req.query.search === 'string' ? req.query.search : null,
          isActive: typeof req.query.isActive === 'string' ? req.query.isActive : null,
          pincodeId: typeof req.query.pincodeId === 'string' ? req.query.pincodeId : null,
          createdFrom: typeof req.query.createdFrom === 'string' ? req.query.createdFrom : null,
          createdTo: typeof req.query.createdTo === 'string' ? req.query.createdTo : null,
          sortBy: sortField,
          sortOrder: sortDirection.toLowerCase(),
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    await workbook.xlsx.write(res);
    res.end();
    logger.info(`Areas exported: ${filename}, ${rows.length} rows`);
  } catch (error) {
    logger.error('Error exporting areas:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export areas',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
};

/**
 * GET /api/areas/by-pincodes?pincodeIds=1,2,3
 * Batch fetch areas for multiple pincodes
 * Returns areas grouped by pincodeId
 */
export const getAreasByPincodes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pincodeIds } = req.query;

    if (!pincodeIds || typeof pincodeIds !== 'string') {
      return sendError(res, 400, 'pincodeIds query parameter is required', 'VALIDATION_ERROR');
    }

    const pincodeIdArray = pincodeIds.split(',').map(id => parseInt(id.trim(), 10));

    if (pincodeIdArray.some(isNaN)) {
      return sendError(res, 400, 'All pincodeIds must be valid integers', 'VALIDATION_ERROR');
    }

    const result = await query(
      `
      SELECT
        pa.pincode_id,
        a.id,
        a.name,
        pa.display_order
      FROM pincode_areas pa
      JOIN areas a ON pa.area_id = a.id
      WHERE pa.pincode_id = ANY($1::int[])
      ORDER BY pa.pincode_id, pa.display_order
    `,
      [pincodeIdArray]
    );

    const areasByPincode: Record<number, Array<{ id: number; name: string }>> = {};

    result.rows.forEach(row => {
      if (!areasByPincode[row.pincode_id]) {
        areasByPincode[row.pincode_id] = [];
      }
      areasByPincode[row.pincode_id].push({
        id: row.id,
        name: row.name,
      });
    });

    res.json({ success: true, data: areasByPincode });
  } catch (error) {
    logger.error('Error fetching areas by pincodes:', error);
    errors.internal(res, 'Failed to fetch areas');
  }
};
