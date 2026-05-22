import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/db';
import type { QueryParams } from '@/types/database';
import { sendError, errors } from '@/utils/apiResponse';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

interface Country {
  id: string;
  name: string;
  code: string;
  continent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shared WHERE-clause builder for getCountries + exportCountries so list +
// export stay in lockstep (same filters, same scope). Returns the SQL
// `WHERE …` fragment + positional parameter array.
const buildCountriesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const { search, continent, isActive, createdFrom, createdTo } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (search && typeof search === 'string') {
    whereConditions.push(
      `(COALESCE(name, '') ILIKE $${paramIndex} OR COALESCE(code, '') ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (continent && typeof continent === 'string') {
    whereConditions.push(`continent = $${paramIndex}`);
    queryParams.push(continent);
    paramIndex++;
  }

  if (isActive === 'true' || isActive === 'false') {
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

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

const SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  code: 'code',
  continent: 'continent',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// GET /api/countries - List countries with pagination and filters
export const getCountries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildCountriesWhereClause(req);

    const sortField = SORT_COLUMNS[sortBy as string] || 'name';
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const sql = `
      SELECT
        id, name, code, continent, is_active, created_at, updated_at
      FROM countries
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;
    const result = await query<Country>(sql, [...queryParams, limitNum, offset]);

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM countries ${whereClause}`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: result.rows.map(country => ({
        ...country,
        id: country.id.toString(),
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
    logger.error('Error retrieving countries:', error);
    errors.internal(res, 'Failed to retrieve countries');
  }
};

// GET /api/countries/:id - Get country by ID
export const getCountryById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query<Country>(
      `SELECT id, name, code, continent, is_active, created_at, updated_at
      FROM countries
      WHERE id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return errors.notFound(res, 'Country');
    }

    const country = result.rows[0];

    res.json({
      success: true,
      data: {
        ...country,
        id: country.id.toString(),
      },
    });
  } catch (error) {
    logger.error('Error retrieving country:', error);
    errors.internal(res, 'Failed to retrieve country');
  }
};

// POST /api/countries - Create new country
export const createCountry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, continent } = req.body;

    const existingResult = await query<Country>(
      'SELECT id FROM countries WHERE code = $1 OR name = $2',
      [code.toUpperCase(), name]
    );

    if (existingResult.rows.length > 0) {
      return sendError(res, 400, 'Country code or name already exists', 'DUPLICATE_ENTRY');
    }

    const result = await query<Country>(
      `INSERT INTO countries (name, code, continent)
       VALUES ($1, $2, $3)
       RETURNING id, name, code, continent, is_active, created_at, updated_at`,
      [name, code.toUpperCase(), continent]
    );

    const newCountry = result.rows[0];

    logger.info(`Created new country: ${newCountry.name}`, {
      userId: req.user?.id,
      countryId: newCountry.id,
    });

    res.status(201).json({
      success: true,
      data: newCountry,
      message: 'Country created successfully',
    });
  } catch (error) {
    logger.error('Error creating country:', error);
    errors.internal(res, 'Failed to create country');
  }
};

// PUT /api/countries/:id - Update country
export const updateCountry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const countryResult = await query<Country>('SELECT id FROM countries WHERE id = $1', [id]);

    if (countryResult.rows.length === 0) {
      return errors.notFound(res, 'Country');
    }

    if (updateData.code) {
      const existingResult = await query<Country>(
        'SELECT id FROM countries WHERE code = $1 AND id != $2',
        [updateData.code.toUpperCase(), id]
      );

      if (existingResult.rows.length > 0) {
        return sendError(res, 400, 'Country code already exists', 'DUPLICATE_CODE');
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

    if (updateData.continent) {
      paramCount++;
      updateFields.push(`continent = $${paramCount}`);
      updateValues.push(updateData.continent);
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
    updateValues.push(new Date().toISOString());

    paramCount++;
    updateValues.push(id);

    const updateSql = `UPDATE countries SET ${updateFields.join(', ')} WHERE id = $${paramCount}
                       RETURNING id, name, code, continent, is_active, created_at, updated_at`;
    const result = await query<Country>(updateSql, updateValues);

    const updatedCountry = result.rows[0];

    res.json({
      success: true,
      data: updatedCountry,
      message: 'Country updated successfully',
    });
  } catch (error) {
    logger.error('Error updating country:', error);
    errors.internal(res, 'Failed to update country');
  }
};

// DELETE /api/countries/:id - Delete country
export const deleteCountry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const countryResult = await query<Country>('SELECT id, name FROM countries WHERE id = $1', [
      id,
    ]);

    if (countryResult.rows.length === 0) {
      return errors.notFound(res, 'Country');
    }

    const statesResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM states WHERE country_id = $1',
      [id]
    );

    const statesCount = parseInt(statesResult.rows[0].count, 10);
    if (statesCount > 0) {
      return sendError(
        res,
        400,
        `Cannot delete country. This country has ${statesCount} associated state(s).`,
        'HAS_DEPENDENCIES'
      );
    }

    await query('DELETE FROM countries WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Country deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting country:', error);
    errors.internal(res, 'Failed to delete country');
  }
};

// GET /api/countries/stats - Canonical 5-card aggregate
export const getCountriesStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const aggRes = await query<{
      total: string;
      active: string;
      inactive: string;
      recentlyAdded: string;
      withStates: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_active = true)::text AS active,
         COUNT(*) FILTER (WHERE is_active = false)::text AS inactive,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS "recentlyAdded",
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM states s WHERE s.country_id = c.id))::text AS "withStates"
       FROM countries c`
    );

    const row = aggRes.rows[0];

    // Continent distribution kept for back-compat consumers (DashboardPage etc).
    const continentResult = await query<{ continent: string; count: string }>(
      'SELECT continent, COUNT(*) FROM countries GROUP BY continent ORDER BY continent'
    );

    const countriesByContinent = continentResult.rows.reduce(
      (acc, r) => {
        acc[r.continent] = parseInt(r.count, 10);
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
        withStatesCount: parseInt(row.withStates, 10),
        // legacy
        totalCountries: parseInt(row.total, 10),
        countriesByContinent,
        continents: Object.keys(countriesByContinent).length,
      },
    });
  } catch (error) {
    logger.error('Error getting countries stats:', error);
    errors.internal(res, 'Failed to get countries statistics');
  }
};

// GET /api/countries/export - xlsx download mirroring getCountries filters.
const EXPORT_ROW_LIMIT = 10000;

export const exportCountries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams, nextParamIndex } = buildCountriesWhereClause(req);

    const sortField = SORT_COLUMNS[sortBy as string] || 'name';
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const rowsRes = await query<{
      name: string;
      code: string;
      continent: string;
      isActive: boolean;
      createdAt: Date;
    }>(
      `SELECT name, code, continent, is_active, created_at
         FROM countries
         ${whereClause}
         ORDER BY ${sortField} ${sortDirection}
         LIMIT $${nextParamIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );
    const rows = rowsRes.rows;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Countries');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Continent', key: 'continent', width: 20 },
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
          continent: r.continent,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        })
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `countries_${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    void createAuditLog({
      action: 'COUNTRY_EXPORTED',
      entityType: 'COUNTRY',
      entityId: undefined,
      userId: req.user!.id,
      details: {
        rowCount: rows.length,
        filename,
        filters: {
          search: typeof req.query.search === 'string' ? req.query.search : null,
          isActive: typeof req.query.isActive === 'string' ? req.query.isActive : null,
          continent: typeof req.query.continent === 'string' ? req.query.continent : null,
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
    logger.info(`Countries exported: ${filename}, ${rows.length} rows`);
  } catch (error) {
    logger.error('Error exporting countries:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export countries',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
};

// POST /api/countries/bulk-import - Bulk import countries
export const bulkImportCountries = async (
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
        const validationError = validateCSVRow(row, ['name', 'code', 'continent']);
        if (validationError) {
          results.failed++;
          results.errors.push({ row: i + 1, data: row, error: validationError });
          continue;
        }

        const { name, code, continent } = row;

        const validContinents = [
          'Africa',
          'Antarctica',
          'Asia',
          'Europe',
          'North America',
          'Oceania',
          'South America',
        ];
        if (!validContinents.includes(continent)) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: `Invalid continent: ${continent}. Must be one of: ${validContinents.join(', ')}`,
          });
          continue;
        }

        const existingCountry = await query(
          'SELECT id FROM countries WHERE code = $1 OR name = $2',
          [code.toUpperCase(), name]
        );

        if (existingCountry.rows.length > 0) {
          await query(
            `UPDATE countries
             SET name = $1, continent = $2, updated_at = NOW()
             WHERE code = $3`,
            [name, continent, code.toUpperCase()]
          );
          results.updated++;
        } else {
          await query(
            `INSERT INTO countries (name, code, continent)
             VALUES ($1, $2, $3)`,
            [name, code.toUpperCase(), continent]
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
        logger.error(`Error importing country at row ${i + 1}:`, error);
      }
    }

    logger.info('Bulk import countries completed', { userId: req.user?.id, results });

    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    logger.error('Error bulk importing countries:', error);
    errors.internal(res, 'Failed to bulk import countries');
  }
};
