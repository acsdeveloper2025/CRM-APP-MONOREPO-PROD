import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import { redact } from '@/utils/logRedact';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/db';
import type { QueryParams } from '@/types/database';
import { sendError, errors } from '@/utils/apiResponse';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

interface City {
  id: string;
  name: string;
  stateId: string;
  createdAt: string;
  updatedAt: string;
}

// Shared WHERE-clause builder for getCities + exportCities.
const buildCitiesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const { search, state, stateId, country, isActive, createdFrom, createdTo } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (search && typeof search === 'string') {
    whereConditions.push(
      `(COALESCE(c.name, '') ILIKE $${paramIndex} OR COALESCE(s.name, '') ILIKE $${paramIndex} OR COALESCE(co.name, '') ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (state && typeof state === 'string') {
    whereConditions.push(`UPPER(s.name) = UPPER($${paramIndex})`);
    queryParams.push(state);
    paramIndex++;
  }

  if (stateId !== undefined && stateId !== null && stateId !== '' && stateId !== 'all') {
    const sidNum = Number(stateId);
    if (Number.isFinite(sidNum)) {
      whereConditions.push(`c.state_id = $${paramIndex}`);
      queryParams.push(sidNum);
      paramIndex++;
    }
  }

  if (country && typeof country === 'string') {
    whereConditions.push(`UPPER(co.name) = UPPER($${paramIndex})`);
    queryParams.push(country);
    paramIndex++;
  }

  if (isActive === 'true' || isActive === 'false') {
    whereConditions.push(`c.is_active = $${paramIndex}`);
    queryParams.push(isActive === 'true');
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    whereConditions.push(`c.created_at >= $${paramIndex}`);
    queryParams.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    whereConditions.push(`c.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    queryParams.push(createdTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

const SORT_COLUMNS: Record<string, string> = {
  name: 'c.name',
  state: 's.name',
  country: 'co.name',
  createdAt: 'c.created_at',
  updatedAt: 'c.updated_at',
};

// GET /api/cities - List cities with pagination and filters
export const getCities = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildCitiesWhereClause(req);

    const sortExpr = SORT_COLUMNS[sortBy as string] || 'c.name';
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const sql = `
      SELECT
        c.id,
        c.name,
        c.state_id AS "stateId",
        s.name AS state,
        co.name AS country,
        c.is_active AS "isActive",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt"
      FROM cities c
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      ${whereClause}
      ORDER BY ${sortExpr} ${sortDirection}
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;
    const result = await query(sql, [...queryParams, limitNum, offset]);

    const countSql = `
      SELECT COUNT(*) FROM cities c
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      ${whereClause}
    `;
    const countResult = await query<{ count: string }>(countSql, queryParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: result.rows.map(city => ({
        ...city,
        id: city.id.toString(),
        stateId: city.stateId != null ? city.stateId.toString() : null,
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
    logger.error('Error retrieving cities:', error);
    errors.internal(res, 'Failed to retrieve cities');
  }
};

// GET /api/cities/:id
export const getCityById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.id, c.name, c.state_id AS "stateId", s.name AS state, co.name AS country,
              c.is_active AS "isActive", c.created_at AS "createdAt", c.updated_at AS "updatedAt"
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       WHERE c.id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return errors.notFound(res, 'City');
    }

    const city = result.rows[0];

    res.json({
      success: true,
      data: {
        ...city,
        id: city.id.toString(),
        stateId: city.stateId != null ? city.stateId.toString() : null,
      },
    });
  } catch (error) {
    logger.error('Error retrieving city:', error);
    errors.internal(res, 'Failed to retrieve city');
  }
};

// POST /api/cities
export const createCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('Creating city', { body: redact(req.body), userId: req.user?.id });
    const { name, state, country } = req.body;

    if (!name || !state || !country) {
      return sendError(
        res,
        400,
        'Name, state, and country are required',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const stateResult = await query<{ id: string }>('SELECT id FROM states WHERE name = $1', [
      state,
    ]);
    if (stateResult.rows.length === 0) {
      return sendError(res, 400, 'State not found', 'STATE_NOT_FOUND');
    }

    const countryResult = await query<{ id: string }>('SELECT id FROM countries WHERE name = $1', [
      country,
    ]);
    if (countryResult.rows.length === 0) {
      return sendError(res, 400, 'Country not found', 'COUNTRY_NOT_FOUND');
    }

    const stateId = stateResult.rows[0].id;

    const existingCity = await query<{ id: string }>(
      'SELECT id FROM cities WHERE name = $1 AND state_id = $2',
      [name, stateId]
    );

    if (existingCity.rows.length > 0) {
      return errors.conflict(res, 'City already exists in this state');
    }

    const insertResult = await query<City>(
      `INSERT INTO cities (name, state_id, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, state_id, created_at, updated_at`,
      [name, stateId]
    );

    const newCity = insertResult.rows[0];

    const fullCityResult = await query(
      `SELECT c.id, c.name, s.name AS state, co.name AS country,
              c.is_active AS "isActive", c.created_at AS "createdAt", c.updated_at AS "updatedAt"
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       WHERE c.id = $1`,
      [newCity.id]
    );

    res.status(201).json({
      success: true,
      data: fullCityResult.rows[0],
      message: 'City created successfully',
    });
  } catch (error) {
    logger.error('Error creating city:', error);
    errors.internal(res, 'Failed to create city');
  }
};

// PUT /api/cities/:id
export const updateCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, state, country, isActive } = req.body;

    const existingCity = await query<{ id: string }>('SELECT id FROM cities WHERE id = $1', [id]);

    if (existingCity.rows.length === 0) {
      return errors.notFound(res, 'City');
    }

    const updateFields: string[] = [];
    const updateValues: QueryParams = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name);
    }

    if (state) {
      const stateResult = await query<{ id: string }>('SELECT id FROM states WHERE name = $1', [
        state,
      ]);
      if (stateResult.rows.length === 0) {
        return sendError(res, 400, 'State not found', 'STATE_NOT_FOUND');
      }
      paramCount++;
      updateFields.push(`state_id = $${paramCount}`);
      updateValues.push(stateResult.rows[0].id);
    }

    if (country) {
      const countryResult = await query<{ id: string }>(
        'SELECT id FROM countries WHERE name = $1',
        [country]
      );
      if (countryResult.rows.length === 0) {
        return sendError(res, 400, 'Country not found', 'COUNTRY_NOT_FOUND');
      }
      // Country update flows through state_id implicitly when state is changed too;
      // when only country is changed but not state, that's a no-op for cities (country
      // is reachable via state_id → states.country_id). We accept the field for API
      // back-compat but don't write a column.
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

    await query(
      `UPDATE cities SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
      updateValues
    );

    const updatedCityResult = await query(
      `SELECT c.id, c.name, s.name AS state, co.name AS country,
              c.is_active AS "isActive", c.created_at AS "createdAt", c.updated_at AS "updatedAt"
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       WHERE c.id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: updatedCityResult.rows[0],
      message: 'City updated successfully',
    });
  } catch (error) {
    logger.error('Error updating city:', error);
    errors.internal(res, 'Failed to update city');
  }
};

// DELETE /api/cities/:id
export const deleteCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cityResult = await query('SELECT id, name FROM cities WHERE id = $1', [id]);

    if (cityResult.rows.length === 0) {
      return errors.notFound(res, 'City');
    }

    await query('DELETE FROM cities WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'City deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting city:', error);
    errors.internal(res, 'Failed to delete city');
  }
};

// GET /api/cities/stats - Canonical 5-card aggregate
export const getCitiesStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const aggRes = await query<{
      total: string;
      active: string;
      inactive: string;
      recentlyAdded: string;
      withPincodes: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_active = true)::text AS active,
         COUNT(*) FILTER (WHERE is_active = false)::text AS inactive,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS "recentlyAdded",
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM pincodes p WHERE p.city_id = c.id))::text AS "withPincodes"
       FROM cities c`
    );

    const row = aggRes.rows[0];

    // Legacy distributions kept for back-compat (DashboardPage etc).
    const stateDistributionResult = await query<{ state: string; count: string }>(
      `SELECT s.name AS state, COUNT(*) AS count
       FROM cities c
       JOIN states s ON c.state_id = s.id
       GROUP BY s.name
       ORDER BY count DESC`
    );

    const countryDistributionResult = await query<{ country: string; count: string }>(
      `SELECT co.name AS country, COUNT(*) AS count
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       GROUP BY co.name
       ORDER BY count DESC`
    );

    const stateDistribution = stateDistributionResult.rows.reduce(
      (acc, r) => {
        acc[r.state] = parseInt(r.count, 10);
        return acc;
      },
      {} as Record<string, number>
    );

    const countryDistribution = countryDistributionResult.rows.reduce(
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
        withPincodesCount: parseInt(row.withPincodes, 10),
        // legacy
        totalCities: parseInt(row.total, 10),
        stateDistribution,
        countryDistribution,
      },
    });
  } catch (error) {
    logger.error('Error getting cities stats:', error);
    errors.internal(res, 'Failed to get cities statistics');
  }
};

// GET /api/cities/export - xlsx download mirroring getCities filters.
const EXPORT_ROW_LIMIT = 10000;

export const exportCities = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildCitiesWhereClause(req);

    const sortExpr = SORT_COLUMNS[sortBy as string] || 'c.name';
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const rowsRes = await query<{
      name: string;
      state: string;
      country: string;
      isActive: boolean;
      createdAt: Date;
    }>(
      `SELECT c.name, s.name AS state, co.name AS country,
              c.is_active AS "isActive", c.created_at AS "createdAt"
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       ${whereClause}
       ORDER BY ${sortExpr} ${sortDirection}
       LIMIT $${nextParamIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );
    const rows = rowsRes.rows;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Cities');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'State', key: 'state', width: 25 },
      { header: 'Country', key: 'country', width: 20 },
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
          state: r.state,
          country: r.country,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        })
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `cities_${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    void createAuditLog({
      action: 'CITY_EXPORTED',
      entityType: 'CITY',
      entityId: undefined,
      userId: req.user!.id,
      details: {
        rowCount: rows.length,
        filename,
        filters: {
          search: typeof req.query.search === 'string' ? req.query.search : null,
          isActive: typeof req.query.isActive === 'string' ? req.query.isActive : null,
          state: typeof req.query.state === 'string' ? req.query.state : null,
          stateId: typeof req.query.stateId === 'string' ? req.query.stateId : null,
          country: typeof req.query.country === 'string' ? req.query.country : null,
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
    logger.info(`Cities exported: ${filename}, ${rows.length} rows`);
  } catch (error) {
    logger.error('Error exporting cities:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export cities',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
};

// POST /api/cities/bulk-import - Bulk import cities
export const bulkImportCities = async (
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response
) => {
  try {
    if (!req.file) {
      return errors.badRequest(res, 'No file uploaded');
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
        const validationError = validateCSVRow(row, ['name', 'state', 'country']);
        if (validationError) {
          results.failed++;
          results.errors.push({ row: i + 1, data: row, error: validationError });
          continue;
        }

        const { name, state, country } = row;

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

        const stateResult = await query(
          'SELECT id FROM states WHERE LOWER(name) = LOWER($1) AND country_id = $2',
          [state, countryId]
        );
        if (stateResult.rows.length === 0) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: `State "${state}" not found in country "${country}". Seed it via the states import first.`,
          });
          continue;
        }
        const stateId = stateResult.rows[0].id;

        const existingCity = await query(
          'SELECT id FROM cities WHERE LOWER(name) = LOWER($1) AND state_id = $2',
          [name, stateId]
        );

        if (existingCity.rows.length > 0) {
          await query(
            `UPDATE cities SET updated_at = NOW()
             WHERE LOWER(name) = LOWER($1) AND state_id = $2`,
            [name, stateId]
          );
          results.updated++;
        } else {
          await query(`INSERT INTO cities (name, state_id) VALUES ($1, $2)`, [name, stateId]);
          results.created++;
        }
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          data: row,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Error importing city at row ${i + 1}:`, error);
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    logger.error('Error bulk importing cities:', error);
    errors.internal(res, 'Failed to bulk import cities');
  }
};
