import type { Response } from 'express';
import { logger } from '@/config/logger';
import { redact } from '@/utils/logRedact';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/db';
import type { QueryParams } from '@/types/database';
import { sendError, errors } from '@/utils/apiResponse';

interface City {
  id: string;
  name: string;
  stateId: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/cities - List cities with pagination and filters
export const getCities = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      state,
      stateId,
      country = 'India',
      isActive: _isActive,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    // Build SQL query with joins to get state and country names, and pincode counts
    let sql = `
      SELECT
        c.id,
        c.name,
        s.name as state,
        co.name as country,
        c.created_at,
        c.updated_at,
        0 as "pincode_count"
      FROM cities c
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id

      WHERE 1=1
    `;

    const params: QueryParams = [];
    let paramCount = 0;

    // Apply filters
    if (state) {
      paramCount++;
      sql += ` AND UPPER(s.name) = UPPER($${paramCount})`;
      params.push(state as string);
    }

    // 2026-05-06 bug 79: accept stateId in addition to state (name).
    // Eliminates the FE-side parent-name lookup race in CascadingLocationSelector.
    if (stateId !== undefined && stateId !== null && stateId !== '') {
      const sidNum = Number(stateId);
      if (Number.isFinite(sidNum)) {
        paramCount++;
        sql += ` AND c.state_id = $${paramCount}`;
        params.push(sidNum);
      }
    }

    if (country) {
      paramCount++;
      sql += ` AND UPPER(co.name) = UPPER($${paramCount})`;
      params.push(country as string);
    }

    if (search && typeof search === 'string') {
      paramCount++;
      sql += ` AND (COALESCE(c.name, '') ILIKE $${paramCount} OR COALESCE(s.name, '') ILIKE $${paramCount} OR COALESCE(co.name, '') ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // API contract: sortBy is camelCase; map to snake_case DB column (or joined table).
    const sortColumnMap: Record<string, string> = {
      name: 'c.name',
      state: 's.name',
      country: 'co.name',
      createdAt: 'c.created_at',
      updatedAt: 'c.updated_at',
    };
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortExpr = sortColumnMap[sortBy as string] || 'c.name';
    sql += ` ORDER BY ${sortExpr} ${sortDirection}`;

    // Apply pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    paramCount++;
    sql += ` LIMIT $${paramCount}`;
    params.push(limitNum);

    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    // Execute query
    const result = await query(sql, params);

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*)
      FROM cities c
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      WHERE 1=1
    `;
    const countParams: QueryParams = [];
    let countParamCount = 0;

    if (state) {
      countParamCount++;
      countSql += ` AND UPPER(s.name) = UPPER($${countParamCount})`;
      countParams.push(state as string);
    }

    if (stateId !== undefined && stateId !== null && stateId !== '') {
      const sidNum = Number(stateId);
      if (Number.isFinite(sidNum)) {
        countParamCount++;
        countSql += ` AND c.state_id = $${countParamCount}`;
        countParams.push(sidNum);
      }
    }

    if (country) {
      countParamCount++;
      countSql += ` AND UPPER(co.name) = UPPER($${countParamCount})`;
      countParams.push(country as string);
    }

    if (search && typeof search === 'string') {
      countParamCount++;
      countSql += ` AND (LOWER(c.name) LIKE $${countParamCount} OR LOWER(s.name) LIKE $${countParamCount} OR LOWER(co.name) LIKE $${countParamCount})`;
      countParams.push(`%${search.toLowerCase()}%`);
    }

    const countResult = await query<{ count: string }>(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    logger.info(`Retrieved ${result.rows.length} cities`, {
      userId: req.user?.id,
      filters: { state, country, search },
      pagination: { page: pageNum, limit: limitNum },
    });

    res.json({
      success: true,
      data: result.rows.map(city => ({
        ...city,
        id: city.id.toString(),
        stateId: city.stateId ? city.stateId.toString() : null,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    logger.error('Error retrieving cities:', error);
    errors.internal(res, 'Failed to retrieve cities');
  }
};

// GET /api/cities/:id - Get city by ID
export const getCityById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        c.id,
        c.name,
        s.name as state,
        co.name as country,
        c.created_at,
        c.updated_at
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
    logger.info(`Retrieved city ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: {
        ...city,
        id: city.id.toString(), // Convert integer ID to string
      },
    });
  } catch (error) {
    logger.error('Error retrieving city:', error);
    errors.internal(res, 'Failed to retrieve city');
  }
};

// POST /api/cities - Create new city
export const createCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('Creating city', { body: redact(req.body), userId: req.user?.id });
    const { name, state, country } = req.body;

    if (!name || !state || !country) {
      logger.error('Missing required fields:', { name, state, country });
      return sendError(
        res,
        400,
        'Name, state, and country are required',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    // Get stateId and countryId
    logger.info('Looking up state:', { state });
    const stateResult = await query<{ id: string }>('SELECT id FROM states WHERE name = $1', [
      state,
    ]);

    if (stateResult.rows.length === 0) {
      logger.error('State not found:', { state });
      return sendError(res, 400, 'State not found', 'STATE_NOT_FOUND');
    }

    logger.info('Looking up country:', { country });
    const countryResult = await query<{ id: string }>('SELECT id FROM countries WHERE name = $1', [
      country,
    ]);

    if (countryResult.rows.length === 0) {
      logger.error('Country not found:', { country });
      return sendError(res, 400, 'Country not found', 'COUNTRY_NOT_FOUND');
    }

    const stateId = stateResult.rows[0].id;

    // Check if city already exists in this state
    const existingCity = await query<{ id: string }>(
      'SELECT id FROM cities WHERE name = $1 AND state_id = $2',
      [name, stateId]
    );

    if (existingCity.rows.length > 0) {
      return errors.conflict(res, 'City already exists in this state');
    }

    // Insert new city. country reachable via state_id → states.country_id.
    const insertResult = await query<City>(
      `INSERT INTO cities (name, state_id, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, state_id, created_at, updated_at`,
      [name, stateId]
    );

    const newCity = insertResult.rows[0];

    // Get the full city data with state and country names
    const fullCityResult = await query(
      `SELECT
        c.id,
        c.name,
        s.name as state,
        co.name as country,
        c.created_at,
        c.updated_at
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       WHERE c.id = $1`,
      [newCity.id]
    );

    const cityData = fullCityResult.rows[0];

    logger.info(`Created new city: ${cityData.name}`, {
      userId: req.user?.id,
      cityId: cityData.id,
      cityName: cityData.name,
      state: cityData.state,
      country: cityData.country,
    });

    res.status(201).json({
      success: true,
      data: cityData,
      message: 'City created successfully',
    });
  } catch (error) {
    logger.error('Error creating city:', error);
    errors.internal(res, 'Failed to create city');
  }
};

// PUT /api/cities/:id - Update city
export const updateCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, state, country } = req.body;

    if (!name || !state || !country) {
      return sendError(
        res,
        400,
        'Name, state, and country are required',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    // Check if city exists
    const existingCity = await query<{ id: string }>('SELECT id FROM cities WHERE id = $1', [id]);

    if (existingCity.rows.length === 0) {
      return errors.notFound(res, 'City');
    }

    // Get stateId and countryId
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

    // Update city. country reachable via state_id → states.country_id.
    await query(
      `UPDATE cities
       SET name = $1, state_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [name, stateId, id]
    );

    // Get updated city data
    const updatedCityResult = await query(
      `SELECT
        c.id,
        c.name,
        s.name as state,
        co.name as country,
        c.created_at,
        c.updated_at
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       WHERE c.id = $1`,
      [id]
    );

    const updatedCity = updatedCityResult.rows[0];

    logger.info(`Updated city: ${id}`, {
      userId: req.user?.id,
      cityName: updatedCity.name,
      state: updatedCity.state,
      country: updatedCity.country,
    });

    res.json({
      success: true,
      data: updatedCity,
      message: 'City updated successfully',
    });
  } catch (error) {
    logger.error('Error updating city:', error);
    errors.internal(res, 'Failed to update city');
  }
};

// DELETE /api/cities/:id - Delete city
export const deleteCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get city info before deletion
    const cityResult = await query(
      `SELECT
        c.id,
        c.name,
        s.name as state,
        co.name as country
       FROM cities c
       JOIN states s ON c.state_id = s.id
       JOIN countries co ON s.country_id = co.id
       WHERE c.id = $1`,
      [id]
    );

    if (cityResult.rows.length === 0) {
      return errors.notFound(res, 'City');
    }

    const cityToDelete = cityResult.rows[0];

    // Note: Pincodes table has been removed, so no dependency check needed

    // Delete city
    await query('DELETE FROM cities WHERE id = $1', [id]);

    logger.info(`Deleted city: ${cityToDelete.name}`, {
      userId: req.user?.id,
      cityId: id,
      cityName: cityToDelete.name,
      state: cityToDelete.state,
      country: cityToDelete.country,
    });

    res.json({
      success: true,
      message: 'City deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting city:', error);
    errors.internal(res, 'Failed to delete city');
  }
};

// GET /api/cities/stats - Get cities statistics
export const getCitiesStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalResult = await query<{ count: string }>('SELECT COUNT(*) FROM cities');

    const totalCities = parseInt(totalResult.rows[0].count, 10);

    const stateDistributionResult = await query<{ state: string; count: string }>(
      `SELECT s.name as state, COUNT(*) as count
       FROM cities c
       JOIN states s ON c.state_id = s.id
       GROUP BY s.name
       ORDER BY count DESC`
    );

    const countryDistributionResult = await query<{ country: string; count: string }>(
      `SELECT co.name as country, COUNT(*) as count
       FROM cities c
       JOIN countries co ON s.country_id = co.id
       GROUP BY co.name
       ORDER BY count DESC`
    );

    const stateDistribution = stateDistributionResult.rows.reduce(
      (acc, row) => {
        acc[row.state] = parseInt(row.count, 10);
        return acc;
      },
      {} as Record<string, number>
    );

    const countryDistribution = countryDistributionResult.rows.reduce(
      (acc, row) => {
        acc[row.country] = parseInt(row.count, 10);
        return acc;
      },
      {} as Record<string, number>
    );

    const stats = {
      totalCities,
      stateDistribution,
      countryDistribution,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting cities stats:', error);
    errors.internal(res, 'Failed to get cities statistics');
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

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Validate required fields
        const validationError = validateCSVRow(row, ['name', 'state', 'country']);
        if (validationError) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: validationError,
          });
          continue;
        }

        const { name, state, country } = row;

        // Country must exist (auto-create removed — produced junk rows
        // with hardcoded continent + truncated code).
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

        // State must exist within country (same reason).
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

        // Check if city already exists
        const existingCity = await query(
          'SELECT id FROM cities WHERE LOWER(name) = LOWER($1) AND state_id = $2',
          [name, stateId]
        );

        if (existingCity.rows.length > 0) {
          // Update existing city
          await query(
            `UPDATE cities
             SET updated_at = NOW()
             WHERE LOWER(name) = LOWER($1) AND state_id = $2`,
            [name, stateId]
          );
          results.updated++;
        } else {
          // Create new city. country is reachable via state_id → states.country_id.
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

    logger.info('Bulk import cities completed', {
      userId: req.user?.id,
      results,
    });

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
