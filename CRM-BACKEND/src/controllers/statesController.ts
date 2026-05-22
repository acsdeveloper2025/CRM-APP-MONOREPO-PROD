import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { sendError, errors } from '@/utils/apiResponse';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

// Shared WHERE-clause builder for getStates + exportStates.
const buildStatesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const { search, country, countryId, isActive, createdFrom, createdTo } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (search && typeof search === 'string') {
    whereConditions.push(
      `(COALESCE(s.name, '') ILIKE $${paramIndex} OR COALESCE(s.code, '') ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (country && typeof country === 'string') {
    whereConditions.push(`UPPER(co.name) = UPPER($${paramIndex})`);
    queryParams.push(country);
    paramIndex++;
  }

  if (countryId !== undefined && countryId !== null && countryId !== '' && countryId !== 'all') {
    const cidNum = Number(countryId);
    if (Number.isFinite(cidNum)) {
      whereConditions.push(`s.country_id = $${paramIndex}`);
      queryParams.push(cidNum);
      paramIndex++;
    }
  }

  if (isActive === 'true' || isActive === 'false') {
    whereConditions.push(`s.is_active = $${paramIndex}`);
    queryParams.push(isActive === 'true');
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    whereConditions.push(`s.created_at >= $${paramIndex}`);
    queryParams.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    whereConditions.push(`s.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    queryParams.push(createdTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

const SORT_COLUMNS: Record<string, string> = {
  country: 'co.name',
  name: 's.name',
  code: 's.code',
  createdAt: 's.created_at',
  updatedAt: 's.updated_at',
};

// GET /api/states - List states with pagination and filters
export const getStates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildStatesWhereClause(req);

    const sortExpr = SORT_COLUMNS[sortBy as string] || 's.name';
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const sql = `
      SELECT
        s.id,
        s.name,
        s.code,
        s.country_id AS "countryId",
        co.name AS country,
        s.is_active AS "isActive",
        s.created_at AS "createdAt",
        s.updated_at AS "updatedAt",
        COALESCE(c."city_count", 0) AS "cityCount"
      FROM states s
      JOIN countries co ON s.country_id = co.id
      LEFT JOIN (
        SELECT state_id, COUNT(*) AS "city_count"
        FROM cities
        GROUP BY state_id
      ) c ON s.id = c.state_id
      ${whereClause}
      ORDER BY ${sortExpr} ${sortDirection}
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;
    const result = await query(sql, [...queryParams, limitNum, offset]);

    const countSql = `
      SELECT COUNT(*) FROM states s
      JOIN countries co ON s.country_id = co.id
      ${whereClause}
    `;
    const countResult = await query<{ count: string }>(countSql, queryParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: result.rows.map(state => ({
        ...state,
        id: state.id.toString(),
        countryId: state.countryId != null ? state.countryId.toString() : null,
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
    logger.error('Error retrieving states:', error);
    errors.internal(res, 'Failed to retrieve states');
  }
};

// GET /api/states/:id
export const getStateById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    const result = await query(
      `SELECT s.id, s.name, s.code, s.country_id AS "countryId", c.name AS country,
              s.is_active AS "isActive", s.created_at AS "createdAt", s.updated_at AS "updatedAt"
       FROM states s
       JOIN countries c ON s.country_id = c.id
       WHERE s.id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return errors.notFound(res, 'State');
    }

    const state = result.rows[0];

    res.json({
      success: true,
      data: {
        ...state,
        id: state.id.toString(),
        countryId: state.countryId != null ? state.countryId.toString() : null,
      },
    });
  } catch (error) {
    logger.error('Error retrieving state:', error);
    errors.internal(res, 'Failed to retrieve state');
  }
};

// POST /api/states
export const createState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, country } = req.body;

    const countryResult = await query('SELECT id FROM countries WHERE name = $1', [country]);

    if (countryResult.rows.length === 0) {
      return sendError(res, 400, 'Country not found', 'COUNTRY_NOT_FOUND');
    }

    const countryId = countryResult.rows[0].id;

    const existingStateResult = await query(
      'SELECT id FROM states WHERE code = $1 AND country_id = $2',
      [code.toUpperCase(), countryId]
    );

    if (existingStateResult.rows.length > 0) {
      return sendError(res, 400, 'State code already exists in this country', 'DUPLICATE_CODE');
    }

    const result = await query(
      'INSERT INTO states (name, code, country_id) VALUES ($1, $2, $3) RETURNING *',
      [name, code.toUpperCase(), countryId]
    );

    const newState = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: newState.id,
        name: newState.name,
        code: newState.code,
        country,
        isActive: newState.is_active,
        createdAt: newState.created_at,
        updatedAt: newState.updated_at,
      },
      message: 'State created successfully',
    });
  } catch (error) {
    logger.error('Error creating state:', error);
    errors.internal(res, 'Failed to create state');
  }
};

// PUT /api/states/:id
export const updateState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const updateData = req.body;

    const existingResult = await query(
      'SELECT s.*, c.name AS country FROM states s JOIN countries c ON s.country_id = c.id WHERE s.id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return errors.notFound(res, 'State');
    }

    const existingState = existingResult.rows[0];

    if (updateData.code) {
      let countryId = existingState.country_id;
      if (updateData.country && updateData.country !== existingState.country) {
        const countryResult = await query('SELECT id FROM countries WHERE name = $1', [
          updateData.country,
        ]);
        if (countryResult.rows.length === 0) {
          return sendError(res, 400, 'Country not found', 'COUNTRY_NOT_FOUND');
        }
        countryId = countryResult.rows[0].id;
      }

      const duplicateResult = await query(
        'SELECT id FROM states WHERE id != $1 AND code = $2 AND country_id = $3',
        [id, updateData.code.toUpperCase(), countryId]
      );

      if (duplicateResult.rows.length > 0) {
        return sendError(res, 400, 'State code already exists in this country', 'DUPLICATE_CODE');
      }
    }

    const updateFields: string[] = [];
    const updateValues: QueryParams = [];
    let paramCount = 0;

    if (updateData.name) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(updateData.name);
    }

    if (updateData.code) {
      paramCount++;
      updateFields.push(`code = $${paramCount}`);
      updateValues.push(updateData.code.toUpperCase());
    }

    if (updateData.country) {
      const countryResult = await query('SELECT id FROM countries WHERE name = $1', [
        updateData.country,
      ]);
      if (countryResult.rows.length > 0) {
        paramCount++;
        updateFields.push(`country_id = $${paramCount}`);
        updateValues.push(countryResult.rows[0].id);
      }
    }

    if (typeof updateData.isActive === 'boolean') {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      updateValues.push(updateData.isActive);
    }

    if (updateFields.length === 0) {
      return sendError(res, 400, 'No valid fields to update', 'NO_UPDATE_FIELDS');
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    paramCount++;
    updateValues.push(String(id));

    await query(
      `UPDATE states SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      updateValues
    );

    const finalResult = await query(
      `SELECT s.id, s.name, s.code, c.name AS country, s.is_active AS "isActive",
              s.created_at AS "createdAt", s.updated_at AS "updatedAt"
       FROM states s
       JOIN countries c ON s.country_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: finalResult.rows[0],
      message: 'State updated successfully',
    });
  } catch (error) {
    logger.error('Error updating state:', error);
    errors.internal(res, 'Failed to update state');
  }
};

// DELETE /api/states/:id
export const deleteState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    const existingResult = await query('SELECT id, name FROM states WHERE id = $1', [id]);

    if (existingResult.rows.length === 0) {
      return errors.notFound(res, 'State');
    }

    const citiesResult = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM cities WHERE state_id = $1',
      [id]
    );
    const citiesCount = parseInt(citiesResult.rows[0].count, 10);
    if (citiesCount > 0) {
      return sendError(
        res,
        400,
        `Cannot delete state. It has ${citiesCount} cities associated with it.`,
        'STATE_HAS_CITIES'
      );
    }

    await query('DELETE FROM states WHERE id = $1', [id]);

    res.json({ success: true, message: 'State deleted successfully' });
  } catch (error) {
    logger.error('Error deleting state:', error);
    errors.internal(res, 'Failed to delete state');
  }
};

// GET /api/states/stats - Canonical 5-card aggregate
export const getStatesStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const aggRes = await query<{
      total: string;
      active: string;
      inactive: string;
      recentlyAdded: string;
      withCities: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_active = true)::text AS active,
         COUNT(*) FILTER (WHERE is_active = false)::text AS inactive,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS "recentlyAdded",
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM cities c WHERE c.state_id = s.id))::text AS "withCities"
       FROM states s`
    );

    const row = aggRes.rows[0];

    // Legacy: states per country
    const countryRes = await query<{ country: string; count: string }>(
      `SELECT c.name AS country, COUNT(s.id) AS count
       FROM countries c
       LEFT JOIN states s ON c.id = s.country_id
       GROUP BY c.id, c.name
       HAVING COUNT(s.id) > 0
       ORDER BY c.name`
    );

    const statesByCountry = countryRes.rows.reduce(
      (acc, r) => {
        acc[r.country] = parseInt(r.count, 10);
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      success: true,
      data: {
        // canonical
        total: parseInt(row.total, 10),
        active: parseInt(row.active, 10),
        inactive: parseInt(row.inactive, 10),
        recentlyAddedCount: parseInt(row.recentlyAdded, 10),
        withCitiesCount: parseInt(row.withCities, 10),
        // legacy
        totalStates: parseInt(row.total, 10),
        statesByCountry,
        countries: Object.keys(statesByCountry).length,
      },
    });
  } catch (error) {
    logger.error('Error getting states stats:', error);
    errors.internal(res, 'Failed to get states statistics');
  }
};

// GET /api/states/export - xlsx download mirroring getStates filters.
const EXPORT_ROW_LIMIT = 10000;

export const exportStates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildStatesWhereClause(req);

    const sortExpr = SORT_COLUMNS[sortBy as string] || 's.name';
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const rowsRes = await query<{
      name: string;
      code: string;
      country: string;
      cityCount: string;
      isActive: boolean;
      createdAt: Date;
    }>(
      `SELECT s.name, s.code, co.name AS country, s.is_active AS "isActive",
              s.created_at AS "createdAt",
              COALESCE(cc.city_count, 0)::text AS "cityCount"
       FROM states s
       JOIN countries co ON s.country_id = co.id
       LEFT JOIN (
         SELECT state_id, COUNT(*) AS city_count FROM cities GROUP BY state_id
       ) cc ON s.id = cc.state_id
       ${whereClause}
       ORDER BY ${sortExpr} ${sortDirection}
       LIMIT $${nextParamIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );
    const rows = rowsRes.rows;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('States');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Country', key: 'country', width: 25 },
      { header: 'Cities', key: 'cityCount', width: 12 },
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
          country: r.country,
          cityCount: Number(r.cityCount),
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        })
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `states_${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    void createAuditLog({
      action: 'STATE_EXPORTED',
      entityType: 'STATE',
      entityId: undefined,
      userId: req.user!.id,
      details: {
        rowCount: rows.length,
        filename,
        filters: {
          search: typeof req.query.search === 'string' ? req.query.search : null,
          isActive: typeof req.query.isActive === 'string' ? req.query.isActive : null,
          country: typeof req.query.country === 'string' ? req.query.country : null,
          countryId: typeof req.query.countryId === 'string' ? req.query.countryId : null,
          createdFrom: typeof req.query.createdFrom === 'string' ? req.query.createdFrom : null,
          createdTo: typeof req.query.createdTo === 'string' ? req.query.createdTo : null,
          sortBy: sortExpr,
          sortOrder: sortDirection.toLowerCase(),
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    await workbook.xlsx.write(res);
    res.end();
    logger.info(`States exported: ${filename}, ${rows.length} rows`);
  } catch (error) {
    logger.error('Error exporting states:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export states',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
};

// POST /api/states/bulk-import - Bulk import states
export const bulkImportStates = async (
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response
) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded', 'NO_FILE');
    }

    const { parseCSV, validateCSVRow } = await import('@/utils/csvParser');
    const rows = await parseCSV(req.file.buffer);

    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; data: Record<string, unknown>; error: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const validationError = validateCSVRow(row, ['name', 'code', 'country']);
        if (validationError) {
          results.failed++;
          results.errors.push({ row: i + 1, data: row, error: validationError });
          continue;
        }

        const { name, code, country, gstStateCode } = row;
        const gstCode: string | null =
          typeof gstStateCode === 'string' && gstStateCode.trim() !== ''
            ? gstStateCode.trim()
            : null;

        const countryResult = await query(
          'SELECT id FROM countries WHERE LOWER(name) = LOWER($1)',
          [country]
        );

        if (countryResult.rows.length === 0) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: `Country "${country}" not found. Seed it via the countries import first.`,
          });
          continue;
        }
        const countryId = countryResult.rows[0].id;

        const existingState = await query(
          'SELECT id FROM states WHERE code = $1 AND country_id = $2',
          [code.toUpperCase(), countryId]
        );

        if (existingState.rows.length > 0) {
          if (gstCode !== null) {
            await query(
              `UPDATE states
               SET name = $1, gst_state_code = $2, updated_at = NOW()
               WHERE code = $3 AND country_id = $4`,
              [name, gstCode, code.toUpperCase(), countryId]
            );
          } else {
            await query(
              `UPDATE states
               SET name = $1, updated_at = NOW()
               WHERE code = $2 AND country_id = $3`,
              [name, code.toUpperCase(), countryId]
            );
          }
          results.updated++;
        } else {
          await query(
            `INSERT INTO states (name, code, country_id, gst_state_code)
             VALUES ($1, $2, $3, $4)`,
            [name, code.toUpperCase(), countryId, gstCode]
          );
          results.created++;
        }
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          data: row,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Error importing state at row ${i + 1}:`, error);
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    logger.error('Error bulk importing states:', error);
    errors.internal(res, 'Failed to bulk import states');
  }
};
