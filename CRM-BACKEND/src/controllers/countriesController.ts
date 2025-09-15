import { Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/db';

interface Country {
  id: string;
  name: string;
  code: string;
  continent: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/countries - List countries with pagination and filters
export const getCountries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      continent,
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build SQL query with filters and field name transformation
    let sql = `
      SELECT
        id,
        name,
        code,
        continent,
        "createdAt",
        "updatedAt"
      FROM countries
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Apply filters
    if (continent) {
      paramCount++;
      sql += ` AND continent = $${paramCount}`;
      params.push(continent);
    }

    if (search) {
      paramCount++;
      sql += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(code) LIKE $${paramCount})`;
      params.push(`%${(search as string).toLowerCase()}%`);
    }

    // Apply sorting
    const validSortFields = ['name', 'code', 'continent', 'createdAt', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy as string) ? (sortBy as string) : 'name';
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortFieldExpr = (sortField === 'createdAt' || sortField === 'updatedAt') ? `"${sortField}"` : sortField;
    sql += ` ORDER BY ${sortFieldExpr} ${sortDirection}`;

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
    const result = await query<Country>(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) FROM countries WHERE 1=1';
    const countParams: any[] = [];
    let countParamCount = 0;

    if (continent) {
      countParamCount++;
      countSql += ` AND continent = $${countParamCount}`;
      countParams.push(continent);
    }

    if (search) {
      countParamCount++;
      countSql += ` AND (LOWER(name) LIKE $${countParamCount} OR LOWER(code) LIKE $${countParamCount})`;
      countParams.push(`%${(search as string).toLowerCase()}%`);
    }

    const countResult = await query<{ count: string }>(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    logger.info(`Retrieved ${result.rows.length} countries`, {
      userId: req.user?.id,
      filters: { continent, search },
      pagination: { page: pageNum, limit: limitNum }
    });

    res.json({
      success: true,
      data: result.rows.map(country => ({
        ...country,
        id: country.id.toString() // Convert integer ID to string
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
    logger.error('Error retrieving countries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve countries',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/countries/:id - Get country by ID
export const getCountryById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query<Country>(
      `SELECT
        id,
        name,
        code,
        continent,
        "createdAt",
        "updatedAt"
      FROM countries
      WHERE id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Country not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const country = result.rows[0];

    logger.info(`Retrieved country: ${country.name}`, {
      userId: req.user?.id,
      countryId: id
    });

    res.json({
      success: true,
      data: {
        ...country,
        id: country.id.toString() // Convert integer ID to string
      },
    });
  } catch (error) {
    logger.error('Error retrieving country:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve country',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/countries - Create new country
export const createCountry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, continent } = req.body;

    // Check if country code already exists
    const existingResult = await query<Country>(
      'SELECT id FROM countries WHERE code = $1 OR name = $2',
      [code.toUpperCase(), name]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Country code or name already exists',
        error: { code: 'DUPLICATE_ENTRY' },
      });
    }

    // Create new country
    const result = await query<Country>(
      `INSERT INTO countries (name, code, continent)
       VALUES ($1, $2, $3)
       RETURNING id, name, code, continent, "createdAt", "updatedAt"`,
      [name, code.toUpperCase(), continent]
    );

    const newCountry = result.rows[0];

    logger.info(`Created new country: ${newCountry.name}`, {
      userId: req.user?.id,
      countryId: newCountry.id,
      countryData: newCountry
    });

    res.status(201).json({
      success: true,
      data: newCountry,
      message: 'Country created successfully',
    });
  } catch (error) {
    logger.error('Error creating country:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create country',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/countries/:id - Update country
export const updateCountry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if country exists
    const countryResult = await query<Country>(
      'SELECT * FROM countries WHERE id = $1',
      [id]
    );

    if (countryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Country not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for duplicate code if being updated
    if (updateData.code) {
      const existingResult = await query<Country>(
        'SELECT id FROM countries WHERE code = $1 AND id != $2',
        [updateData.code.toUpperCase(), id]
      );

      if (existingResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Country code already exists',
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

    if (updateData.continent) {
      paramCount++;
      updateFields.push(`continent = $${paramCount}`);
      updateValues.push(updateData.continent);
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
    updateValues.push(new Date().toISOString());

    // Add id for WHERE clause
    paramCount++;
    updateValues.push(id);

    const updateSql = `UPDATE countries SET ${updateFields.join(', ')} WHERE id = $${paramCount}
                       RETURNING id, name, code, continent, "createdAt", "updatedAt"`;
    const result = await query<Country>(updateSql, updateValues);

    const updatedCountry = result.rows[0];

    logger.info(`Updated country: ${updatedCountry.name}`, {
      userId: req.user?.id,
      countryId: id,
      updateData
    });

    res.json({
      success: true,
      data: updatedCountry,
      message: 'Country updated successfully',
    });
  } catch (error) {
    logger.error('Error updating country:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update country',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/countries/:id - Delete country
export const deleteCountry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if country exists
    const countryResult = await query<Country>(
      'SELECT * FROM countries WHERE id = $1',
      [id]
    );

    if (countryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Country not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for associated states before deletion
    const statesResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM states WHERE "countryId" = $1',
      [id]
    );

    const statesCount = parseInt(statesResult.rows[0].count, 10);
    if (statesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete country. This country has ${statesCount} associated state(s).`,
        error: { code: 'HAS_DEPENDENCIES' }
      });
    }

    const deletedCountry = countryResult.rows[0];

    // Delete the country
    await query('DELETE FROM countries WHERE id = $1', [id]);

    logger.info(`Deleted country: ${deletedCountry.name}`, {
      userId: req.user?.id,
      countryId: id
    });

    res.json({
      success: true,
      message: 'Country deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting country:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete country',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/countries/stats - Get countries statistics
export const getCountriesStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get total countries
    const totalResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM countries'
    );
    const totalCountries = parseInt(totalResult.rows[0].count, 10);

    // Get countries by continent
    const continentResult = await query<{ continent: string; count: string }>(
      'SELECT continent, COUNT(*) FROM countries GROUP BY continent ORDER BY continent'
    );

    const countriesByContinent = continentResult.rows.reduce((acc, row) => {
      acc[row.continent] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      totalCountries,
      countriesByContinent,
      continents: Object.keys(countriesByContinent).length,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting countries stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get countries statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/countries/bulk-import - Bulk import countries
export const bulkImportCountries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // This would handle file upload and parsing in a real implementation
    res.status(501).json({
      success: false,
      message: 'Bulk import not implemented yet',
      error: { code: 'NOT_IMPLEMENTED' },
    });
  } catch (error) {
    logger.error('Error bulk importing countries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import countries',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
