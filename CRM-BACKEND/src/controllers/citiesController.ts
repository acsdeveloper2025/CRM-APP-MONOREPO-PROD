import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/db';

interface City {
  id: string;
  name: string;
  stateId: string;
  countryId: string;
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
      country = 'India',
      isActive,
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
        c."createdAt",
        c."updatedAt",
        0 as "pincodeCount"
      FROM cities c
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id

      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    // Apply filters
    if (state) {
      paramCount++;
      sql += ` AND UPPER(s.name) = UPPER($${paramCount})`;
      params.push(state);
    }

    if (country) {
      paramCount++;
      sql += ` AND UPPER(co.name) = UPPER($${paramCount})`;
      params.push(country);
    }

    if (search) {
      paramCount++;
      sql += ` AND (COALESCE(c.name, '') ILIKE $${paramCount} OR COALESCE(s.name, '') ILIKE $${paramCount} OR COALESCE(co.name, '') ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Apply sorting
    const validSortFields = ['name', 'state', 'country', 'createdAt', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'name';
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    if (sortField === 'state') {
      sql += ` ORDER BY s.name ${sortDirection}`;
    } else if (sortField === 'country') {
      sql += ` ORDER BY co.name ${sortDirection}`;
    } else {
      sql += ` ORDER BY c.${sortField} ${sortDirection}`;
    }

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
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamCount = 0;

    if (state) {
      countParamCount++;
      countSql += ` AND s.name = $${countParamCount}`;
      countParams.push(state);
    }

    if (country) {
      countParamCount++;
      countSql += ` AND co.name = $${countParamCount}`;
      countParams.push(country);
    }

    if (search) {
      countParamCount++;
      countSql += ` AND (LOWER(c.name) LIKE $${countParamCount} OR LOWER(s.name) LIKE $${countParamCount} OR LOWER(co.name) LIKE $${countParamCount})`;
      countParams.push(`%${(search as string).toLowerCase()}%`);
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
        id: city.id.toString(), // Convert integer ID to string
        stateId: city.stateId ? city.stateId.toString() : null, // Convert integer stateId to string if exists
        countryId: city.countryId ? city.countryId.toString() : null, // Convert integer countryId to string if exists
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cities',
      error: { code: 'INTERNAL_ERROR' },
    });
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
        c."createdAt",
        c."updatedAt"
       FROM cities c
       JOIN states s ON c."stateId" = s.id
       JOIN countries co ON c."countryId" = co.id
       WHERE c.id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
        error: { code: 'NOT_FOUND' },
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve city',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/cities - Create new city
export const createCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('Creating city with data:', { body: req.body, userId: req.user?.id });
    const { name, state, country } = req.body;

    if (!name || !state || !country) {
      logger.error('Missing required fields:', { name, state, country });
      return res.status(400).json({
        success: false,
        message: 'Name, state, and country are required',
        error: { code: 'MISSING_REQUIRED_FIELDS' },
      });
    }

    // Get stateId and countryId
    logger.info('Looking up state:', { state });
    const stateResult = await query<{ id: string }>('SELECT id FROM states WHERE name = $1', [
      state,
    ]);

    if (stateResult.rows.length === 0) {
      logger.error('State not found:', { state });
      return res.status(400).json({
        success: false,
        message: 'State not found',
        error: { code: 'STATE_NOT_FOUND' },
      });
    }

    logger.info('Looking up country:', { country });
    const countryResult = await query<{ id: string }>('SELECT id FROM countries WHERE name = $1', [
      country,
    ]);

    if (countryResult.rows.length === 0) {
      logger.error('Country not found:', { country });
      return res.status(400).json({
        success: false,
        message: 'Country not found',
        error: { code: 'COUNTRY_NOT_FOUND' },
      });
    }

    const stateId = stateResult.rows[0].id;
    const countryId = countryResult.rows[0].id;

    // Check if city already exists in this state
    const existingCity = await query<{ id: string }>(
      'SELECT id FROM cities WHERE name = $1 AND "stateId" = $2',
      [name, stateId]
    );

    if (existingCity.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'City already exists in this state',
        error: { code: 'DUPLICATE_CITY' },
      });
    }

    // Insert new city
    const insertResult = await query<City>(
      `INSERT INTO cities (name, "stateId", "countryId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, name, "stateId", "countryId", "createdAt", "updatedAt"`,
      [name, stateId, countryId]
    );

    const newCity = insertResult.rows[0];

    // Get the full city data with state and country names
    const fullCityResult = await query(
      `SELECT
        c.id,
        c.name,
        s.name as state,
        co.name as country,
        c."createdAt",
        c."updatedAt"
       FROM cities c
       JOIN states s ON c."stateId" = s.id
       JOIN countries co ON c."countryId" = co.id
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
    res.status(500).json({
      success: false,
      message: 'Failed to create city',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/cities/:id - Update city
export const updateCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, state, country } = req.body;

    if (!name || !state || !country) {
      return res.status(400).json({
        success: false,
        message: 'Name, state, and country are required',
        error: { code: 'MISSING_REQUIRED_FIELDS' },
      });
    }

    // Check if city exists
    const existingCity = await query<{ id: string }>('SELECT id FROM cities WHERE id = $1', [id]);

    if (existingCity.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get stateId and countryId
    const stateResult = await query<{ id: string }>('SELECT id FROM states WHERE name = $1', [
      state,
    ]);

    if (stateResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'State not found',
        error: { code: 'STATE_NOT_FOUND' },
      });
    }

    const countryResult = await query<{ id: string }>('SELECT id FROM countries WHERE name = $1', [
      country,
    ]);

    if (countryResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Country not found',
        error: { code: 'COUNTRY_NOT_FOUND' },
      });
    }

    const stateId = stateResult.rows[0].id;
    const countryId = countryResult.rows[0].id;

    // Update city
    await query(
      `UPDATE cities
       SET name = $1, "stateId" = $2, "countryId" = $3, "updatedAt" = NOW()
       WHERE id = $4`,
      [name, stateId, countryId, id]
    );

    // Get updated city data
    const updatedCityResult = await query(
      `SELECT
        c.id,
        c.name,
        s.name as state,
        co.name as country,
        c."createdAt",
        c."updatedAt"
       FROM cities c
       JOIN states s ON c."stateId" = s.id
       JOIN countries co ON c."countryId" = co.id
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
    res.status(500).json({
      success: false,
      message: 'Failed to update city',
      error: { code: 'INTERNAL_ERROR' },
    });
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
       JOIN states s ON c."stateId" = s.id
       JOIN countries co ON c."countryId" = co.id
       WHERE c.id = $1`,
      [id]
    );

    if (cityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
        error: { code: 'NOT_FOUND' },
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to delete city',
      error: { code: 'INTERNAL_ERROR' },
    });
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
       JOIN states s ON c."stateId" = s.id
       GROUP BY s.name
       ORDER BY count DESC`
    );

    const countryDistributionResult = await query<{ country: string; count: string }>(
      `SELECT co.name as country, COUNT(*) as count
       FROM cities c
       JOIN countries co ON c."countryId" = co.id
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
    res.status(500).json({
      success: false,
      message: 'Failed to get cities statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/cities/bulk-import - Bulk import cities
export const bulkImportCities = async (
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        error: { code: 'NO_FILE' },
      });
    }

    const { parseCSV, validateCSVRow } = await import('@/utils/csvParser');
    const rows = await parseCSV(req.file.buffer);

    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; data: any; error: string }>,
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

        // Find or create country
        const countryResult = await query(
          'SELECT id FROM countries WHERE LOWER(name) = LOWER($1)',
          [country]
        );

        let countryId: number;
        if (countryResult.rows.length === 0) {
          const newCountry = await query(
            'INSERT INTO countries (name, code, continent) VALUES ($1, $2, $3) RETURNING id',
            [country, country.substring(0, 3).toUpperCase(), 'Asia']
          );
          countryId = newCountry.rows[0].id;
        } else {
          countryId = countryResult.rows[0].id;
        }

        // Find or create state
        const stateResult = await query(
          'SELECT id FROM states WHERE LOWER(name) = LOWER($1) AND "countryId" = $2',
          [state, countryId]
        );

        let stateId: number;
        if (stateResult.rows.length === 0) {
          const newState = await query(
            'INSERT INTO states (name, code, "countryId") VALUES ($1, $2, $3) RETURNING id',
            [state, state.substring(0, 3).toUpperCase(), countryId]
          );
          stateId = newState.rows[0].id;
        } else {
          stateId = stateResult.rows[0].id;
        }

        // Check if city already exists
        const existingCity = await query(
          'SELECT id FROM cities WHERE LOWER(name) = LOWER($1) AND "stateId" = $2',
          [name, stateId]
        );

        if (existingCity.rows.length > 0) {
          // Update existing city
          await query(
            `UPDATE cities
             SET "updatedAt" = NOW()
             WHERE LOWER(name) = LOWER($1) AND "stateId" = $2`,
            [name, stateId]
          );
          results.updated++;
        } else {
          // Create new city
          await query(
            `INSERT INTO cities (name, "stateId", "countryId")
             VALUES ($1, $2, $3)`,
            [name, stateId, countryId]
          );
          results.created++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          data: row,
          error: error.message || 'Unknown error',
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
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import cities',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
