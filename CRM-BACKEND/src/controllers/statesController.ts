import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { sendError, errors } from '@/utils/apiResponse';

// Database-driven states controller - no more mock data

// GET /api/states - List states with pagination and filters
export const getStates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, country, search, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Build SQL query with joins to get country names and city counts
    let sql = `
      SELECT
        s.id,
        s.name,
        s.code,
        co.name as country,
        s.created_at,
        s.updated_at,
        COALESCE(c."city_count", 0) as "city_count"
      FROM states s
      JOIN countries co ON s.country_id = co.id
      LEFT JOIN (
        SELECT state_id, COUNT(*) as "city_count"
        FROM cities
        GROUP BY state_id
      ) c ON s.id = c.state_id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];
    let paramCount = 0;

    // Apply filters
    if (country && typeof country === 'string') {
      paramCount++;
      sql += ` AND co.name = $${paramCount}`;
      params.push(country);
    }

    if (search && typeof search === 'string') {
      paramCount++;
      sql += ` AND (COALESCE(s.name, '') ILIKE $${paramCount} OR COALESCE(s.code, '') ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // API contract: sortBy is camelCase; map to snake_case DB column (or joined table).
    const sortColumnMap: Record<string, string> = {
      country: 'co.name',
      name: 's.name',
      code: 's.code',
      createdAt: 's.created_at',
      updatedAt: 's.updated_at',
    };
    const sortDirection: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortExpr = sortColumnMap[sortBy as string] || 's.name';
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
      FROM states s
      JOIN countries co ON s.country_id = co.id
      WHERE 1=1
    `;
    const countParams: (string | number)[] = [];
    let countParamCount = 0;

    if (country && typeof country === 'string') {
      countParamCount++;
      countSql += ` AND co.name = $${countParamCount}`;
      countParams.push(country);
    }

    if (search && typeof search === 'string') {
      countParamCount++;
      countSql += ` AND (s.name ILIKE $${countParamCount} OR s.code ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query<{ count: string }>(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    logger.info(`Retrieved ${result.rows.length} states`, {
      userId: req.user?.id,
      filters: { country, search },
      pagination: { page: pageNum, limit: limitNum },
    });

    res.json({
      success: true,
      data: result.rows.map(state => ({
        ...state,
        id: state.id.toString(), // Convert integer ID to string
        countryId: state.countryId ? state.countryId.toString() : null, // Convert integer countryId to string if exists
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
    logger.error('Error retrieving states:', error);
    errors.internal(res, 'Failed to retrieve states');
  }
};

// GET /api/states/:id - Get state by ID
export const getStateById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    const result = await query(
      `SELECT s.id, s.name, s.code, c.name as country, s.created_at, s.updated_at
       FROM states s
       JOIN countries c ON s.country_id = c.id
       WHERE s.id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return errors.notFound(res, 'State');
    }

    const state = result.rows[0];

    logger.info(`Retrieved state: ${state.name}`, {
      userId: req.user?.id,
      stateId: id,
    });

    res.json({
      success: true,
      data: {
        ...state,
        id: state.id.toString(), // Convert integer ID to string
      },
    });
  } catch (error) {
    logger.error('Error retrieving state:', error);
    errors.internal(res, 'Failed to retrieve state');
  }
};

// POST /api/states - Create new state
export const createState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, country } = req.body;

    logger.info('Creating state with data:', { name, code, country, userId: req.user?.id });

    // Get countryId from country name
    const countryResult = await query('SELECT id FROM countries WHERE name = $1', [country]);

    if (countryResult.rows.length === 0) {
      logger.warn('Country not found:', { country });
      return sendError(res, 400, 'Country not found', 'COUNTRY_NOT_FOUND');
    }

    const countryId = countryResult.rows[0].id;

    // Check if state code already exists in this country
    const existingStateResult = await query(
      'SELECT id FROM states WHERE code = $1 AND country_id = $2',
      [code.toUpperCase(), countryId]
    );

    if (existingStateResult.rows.length > 0) {
      logger.warn('Duplicate state code:', { code, country });
      return sendError(res, 400, 'State code already exists in this country', 'DUPLICATE_CODE');
    }

    // Create new state in database
    const result = await query(
      'INSERT INTO states (name, code, country_id) VALUES ($1, $2, $3) RETURNING *',
      [name, code.toUpperCase(), countryId]
    );

    const newState = result.rows[0];

    logger.info(`Created new state: ${newState.name}`, {
      userId: req.user?.id,
      stateId: newState.id,
      stateData: newState,
    });

    res.status(201).json({
      success: true,
      data: {
        id: newState.id,
        name: newState.name,
        code: newState.code,
        country,
        createdAt: newState.createdAt,
        updatedAt: newState.updatedAt,
      },
      message: 'State created successfully',
    });
  } catch (error) {
    logger.error('Error creating state:', error);
    errors.internal(res, 'Failed to create state');
  }
};

// PUT /api/states/:id - Update state
export const updateState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const updateData = req.body;

    // Check if state exists
    const existingResult = await query(
      'SELECT s.*, c.name as country FROM states s JOIN countries c ON s.country_id = c.id WHERE s.id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return errors.notFound(res, 'State');
    }

    const existingState = existingResult.rows[0];

    // Check for duplicate code if being updated
    if (updateData.code) {
      let countryId = existingState.countryId;

      // If country is being updated, get new countryId
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

    // Build update query
    const updateFields: string[] = [];
    const updateValues: (string | number | Date)[] = [];
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

    if (updateFields.length === 0) {
      return sendError(res, 400, 'No valid fields to update', 'NO_UPDATE_FIELDS');
    }

    // Add updatedAt
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Add id for WHERE clause
    paramCount++;
    updateValues.push(String(id));

    const updateQuery = `
      UPDATE states
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);
    const updatedState = result.rows[0];

    // Get the updated state with country name
    const finalResult = await query(
      `SELECT s.id, s.name, s.code, c.name as country, s.created_at, s.updated_at
       FROM states s
       JOIN countries c ON s.country_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    logger.info(`Updated state: ${updatedState.name}`, {
      userId: req.user?.id,
      stateId: id,
      updateData,
    });

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

// DELETE /api/states/:id - Delete state
export const deleteState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    // Check if state exists and get its details
    const existingResult = await query(
      `SELECT s.id, s.name, s.code, c.name as country
       FROM states s
       JOIN countries c ON s.country_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return errors.notFound(res, 'State');
    }

    const stateToDelete = existingResult.rows[0];

    // Check if state is being used by cities
    const citiesResult = await query('SELECT COUNT(*) as count FROM cities WHERE state_id = $1', [
      id,
    ]);

    const citiesCount = parseInt(citiesResult.rows[0].count);
    if (citiesCount > 0) {
      return sendError(
        res,
        400,
        `Cannot delete state. It has ${citiesCount} cities associated with it.`,
        'STATE_HAS_CITIES'
      );
    }

    // Delete the state
    await query('DELETE FROM states WHERE id = $1', [id]);

    logger.info(`Deleted state: ${stateToDelete.name}`, {
      userId: req.user?.id,
      stateId: id,
      stateName: stateToDelete.name,
    });

    res.json({
      success: true,
      message: 'State deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting state:', error);
    errors.internal(res, 'Failed to delete state');
  }
};

// GET /api/states/stats - Get states statistics
export const getStatesStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get total states count
    const totalResult = await query('SELECT COUNT(*) as total FROM states');
    const totalStates = parseInt(totalResult.rows[0].total);

    // Get states count by country
    const countryResult = await query(`
      SELECT c.name as country, COUNT(s.id) as count
      FROM countries c
      LEFT JOIN states s ON c.id = s.country_id
      GROUP BY c.id, c.name
      HAVING COUNT(s.id) > 0
      ORDER BY c.name
    `);

    const statesByCountry = countryResult.rows.reduce(
      (acc, row) => {
        acc[row.country] = parseInt(row.count);
        return acc;
      },
      {} as Record<string, number>
    );

    const stats = {
      totalStates,
      statesByCountry,
      countries: Object.keys(statesByCountry).length,
    };

    logger.info('Retrieved states statistics', {
      userId: req.user?.id,
      stats,
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting states stats:', error);
    errors.internal(res, 'Failed to get states statistics');
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

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Validate required fields
        const validationError = validateCSVRow(row, ['name', 'code', 'country']);
        if (validationError) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: validationError,
          });
          continue;
        }

        const { name, code, country } = row;

        // Find or create country
        const countryResult = await query(
          'SELECT id FROM countries WHERE LOWER(name) = LOWER($1)',
          [country]
        );

        let countryId: number;
        if (countryResult.rows.length === 0) {
          // Auto-create country if it doesn't exist
          const newCountry = await query(
            'INSERT INTO countries (name, code, continent) VALUES ($1, $2, $3) RETURNING id',
            [country, country.substring(0, 3).toUpperCase(), 'Asia'] // Default to Asia
          );
          countryId = newCountry.rows[0].id;
        } else {
          countryId = countryResult.rows[0].id;
        }

        // Check if state already exists
        const existingState = await query(
          'SELECT id FROM states WHERE code = $1 AND country_id = $2',
          [code.toUpperCase(), countryId]
        );

        if (existingState.rows.length > 0) {
          // Update existing state
          await query(
            `UPDATE states
             SET name = $1, updated_at = NOW()
             WHERE code = $2 AND country_id = $3`,
            [name, code.toUpperCase(), countryId]
          );
          results.updated++;
        } else {
          // Create new state
          await query(
            `INSERT INTO states (name, code, country_id)
             VALUES ($1, $2, $3)`,
            [name, code.toUpperCase(), countryId]
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

    logger.info('Bulk import states completed', {
      userId: req.user?.id,
      results,
    });

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
