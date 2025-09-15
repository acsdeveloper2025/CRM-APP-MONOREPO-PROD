import { Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';

// Database-driven states controller - no more mock data

// GET /api/states - List states with pagination and filters
export const getStates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      country,
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build SQL query with joins to get country names and city counts
    let sql = `
      SELECT
        s.id,
        s.name,
        s.code,
        co.name as country,
        s."createdAt",
        s."updatedAt",
        COALESCE(c."cityCount", 0) as "cityCount"
      FROM states s
      JOIN countries co ON s."countryId" = co.id
      LEFT JOIN (
        SELECT "stateId", COUNT(*) as "cityCount"
        FROM cities
        GROUP BY "stateId"
      ) c ON s.id = c."stateId"
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    // Apply filters
    if (country) {
      paramCount++;
      sql += ` AND co.name = $${paramCount}`;
      params.push(country);
    }

    if (search) {
      paramCount++;
      sql += ` AND (s.name ILIKE $${paramCount} OR s.code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Apply sorting
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortField = sortBy as string;

    if (sortField === 'country') {
      sql += ` ORDER BY co.name ${sortDirection}`;
    } else {
      sql += ` ORDER BY s.${sortField} ${sortDirection}`;
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
      FROM states s
      JOIN countries co ON s."countryId" = co.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamCount = 0;

    if (country) {
      countParamCount++;
      countSql += ` AND co.name = $${countParamCount}`;
      countParams.push(country);
    }

    if (search) {
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
      pagination: { page: pageNum, limit: limitNum }
    });

    res.json({
      success: true,
      data: result.rows.map(state => ({
        ...state,
        id: state.id.toString(), // Convert integer ID to string
        countryId: state.countryId ? state.countryId.toString() : null // Convert integer countryId to string if exists
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve states',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/states/:id - Get state by ID
export const getStateById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT s.id, s.name, s.code, c.name as country, s."createdAt", s."updatedAt"
       FROM states s
       JOIN countries c ON s."countryId" = c.id
       WHERE s.id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'State not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const state = result.rows[0];

    logger.info(`Retrieved state: ${state.name}`, {
      userId: req.user?.id,
      stateId: id
    });

    res.json({
      success: true,
      data: {
        ...state,
        id: state.id.toString() // Convert integer ID to string
      },
    });
  } catch (error) {
    logger.error('Error retrieving state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve state',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/states - Create new state
export const createState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, country } = req.body;

    logger.info('Creating state with data:', { name, code, country, userId: req.user?.id });

    // Get countryId from country name
    const countryResult = await query(
      'SELECT id FROM countries WHERE name = $1',
      [country]
    );

    if (countryResult.rows.length === 0) {
      logger.warn('Country not found:', { country });
      return res.status(400).json({
        success: false,
        message: 'Country not found',
        error: { code: 'COUNTRY_NOT_FOUND' },
      });
    }

    const countryId = countryResult.rows[0].id;

    // Check if state code already exists in this country
    const existingStateResult = await query(
      'SELECT id FROM states WHERE code = $1 AND "countryId" = $2',
      [code.toUpperCase(), countryId]
    );

    if (existingStateResult.rows.length > 0) {
      logger.warn('Duplicate state code:', { code, country });
      return res.status(400).json({
        success: false,
        message: 'State code already exists in this country',
        error: { code: 'DUPLICATE_CODE' },
      });
    }

    // Create new state in database
    const result = await query(
      'INSERT INTO states (name, code, "countryId") VALUES ($1, $2, $3) RETURNING *',
      [name, code.toUpperCase(), countryId]
    );

    const newState = result.rows[0];

    logger.info(`Created new state: ${newState.name}`, {
      userId: req.user?.id,
      stateId: newState.id,
      stateData: newState
    });

    res.status(201).json({
      success: true,
      data: {
        id: newState.id,
        name: newState.name,
        code: newState.code,
        country: country,
        createdAt: newState.createdAt,
        updatedAt: newState.updatedAt,
      },
      message: 'State created successfully',
    });
  } catch (error) {
    logger.error('Error creating state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create state',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/states/:id - Update state
export const updateState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if state exists
    const existingResult = await query(
      'SELECT s.*, c.name as country FROM states s JOIN countries c ON s."countryId" = c.id WHERE s.id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'State not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const existingState = existingResult.rows[0];

    // Check for duplicate code if being updated
    if (updateData.code) {
      let countryId = existingState.countryId;

      // If country is being updated, get new countryId
      if (updateData.country && updateData.country !== existingState.country) {
        const countryResult = await query('SELECT id FROM countries WHERE name = $1', [updateData.country]);
        if (countryResult.rows.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Country not found',
            error: { code: 'COUNTRY_NOT_FOUND' },
          });
        }
        countryId = countryResult.rows[0].id;
      }

      const duplicateResult = await query(
        'SELECT id FROM states WHERE id != $1 AND code = $2 AND "countryId" = $3',
        [id, updateData.code.toUpperCase(), countryId]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'State code already exists in this country',
          error: { code: 'DUPLICATE_CODE' },
        });
      }
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
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
      const countryResult = await query('SELECT id FROM countries WHERE name = $1', [updateData.country]);
      if (countryResult.rows.length > 0) {
        paramCount++;
        updateFields.push(`"countryId" = $${paramCount}`);
        updateValues.push(countryResult.rows[0].id);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
        error: { code: 'NO_UPDATE_FIELDS' },
      });
    }

    // Add updatedAt
    paramCount++;
    updateFields.push(`"updatedAt" = $${paramCount}`);
    updateValues.push(new Date());

    // Add id for WHERE clause
    paramCount++;
    updateValues.push(id);

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
      `SELECT s.id, s.name, s.code, c.name as country, s."createdAt", s."updatedAt"
       FROM states s
       JOIN countries c ON s."countryId" = c.id
       WHERE s.id = $1`,
      [id]
    );

    logger.info(`Updated state: ${updatedState.name}`, {
      userId: req.user?.id,
      stateId: id,
      updateData
    });

    res.json({
      success: true,
      data: finalResult.rows[0],
      message: 'State updated successfully',
    });
  } catch (error) {
    logger.error('Error updating state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update state',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/states/:id - Delete state
export const deleteState = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if state exists and get its details
    const existingResult = await query(
      `SELECT s.id, s.name, s.code, c.name as country
       FROM states s
       JOIN countries c ON s."countryId" = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'State not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const stateToDelete = existingResult.rows[0];

    // Check if state is being used by cities
    const citiesResult = await query(
      'SELECT COUNT(*) as count FROM cities WHERE "stateId" = $1',
      [id]
    );

    const citiesCount = parseInt(citiesResult.rows[0].count);
    if (citiesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete state. It has ${citiesCount} cities associated with it.`,
        error: { code: 'STATE_HAS_CITIES' },
      });
    }

    // Delete the state
    await query('DELETE FROM states WHERE id = $1', [id]);

    logger.info(`Deleted state: ${stateToDelete.name}`, {
      userId: req.user?.id,
      stateId: id,
      stateName: stateToDelete.name
    });

    res.json({
      success: true,
      message: 'State deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete state',
      error: { code: 'INTERNAL_ERROR' },
    });
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
      LEFT JOIN states s ON c.id = s."countryId"
      GROUP BY c.id, c.name
      HAVING COUNT(s.id) > 0
      ORDER BY c.name
    `);

    const statesByCountry = countryResult.rows.reduce((acc, row) => {
      acc[row.country] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      totalStates,
      statesByCountry,
      countries: Object.keys(statesByCountry).length,
    };

    logger.info('Retrieved states statistics', {
      userId: req.user?.id,
      stats
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting states stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get states statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/states/bulk-import - Bulk import states
export const bulkImportStates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // This would handle file upload and parsing in a real implementation
    res.status(501).json({
      success: false,
      message: 'Bulk import not implemented yet',
      error: { code: 'NOT_IMPLEMENTED' },
    });
  } catch (error) {
    logger.error('Error bulk importing states:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import states',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
