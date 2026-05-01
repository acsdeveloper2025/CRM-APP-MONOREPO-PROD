import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import type { QueryParams, DatabaseError } from '@/types/database';
import { sendError, errors } from '@/utils/apiResponse';

// Database-driven pincodes controller - no more mock data

// GET /api/pincodes - List pincodes with pagination and filters
export const getPincodes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      cityId,
      state,
      district,
      region,
      deliveryStatus: _deliveryStatus,
      isActive: _isActive,
      search,
      sortBy = 'code',
      sortOrder = 'asc',
    } = req.query;

    // Build SQL query with joins to get pincode data and associated areas
    let sql = `
      SELECT
        p.id,
        p.code,
        p.city_id as city_id,
        c.name as city_name,
        c.state_id as state_id,
        s.name as state_name,
        s.country_id as country_id,
        co.name as country_name,
        p.created_at as created_at,
        p.updated_at as updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'name', a.name,
              'displayOrder', pa.display_order
            ) ORDER BY pa.display_order
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as areas
      FROM pincodes p
      JOIN cities c ON p.city_id = c.id
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      LEFT JOIN pincode_areas pa ON p.id = pa.pincode_id
      LEFT JOIN areas a ON pa.area_id = a.id
      WHERE 1=1
    `;

    const params: QueryParams = [];
    let paramCount = 0;

    // Apply filters
    if (cityId) {
      paramCount++;
      sql += ` AND p.city_id = $${paramCount}`;
      params.push(cityId as string);
    }

    if (state) {
      paramCount++;
      sql += ` AND COALESCE(s.name, '') ILIKE $${paramCount}`;
      params.push(
        `%${typeof state === 'string' || typeof state === 'number' ? String(state) : ''}%`
      );
    }

    if (search) {
      paramCount++;
      sql += ` AND (
        COALESCE(p.code, '') ILIKE $${paramCount} OR
        COALESCE(c.name, '') ILIKE $${paramCount} OR
        COALESCE(s.name, '') ILIKE $${paramCount} OR
        COALESCE(a.name, '') ILIKE $${paramCount}
      )`;
      params.push(
        `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
      );
    }

    // Add GROUP BY clause for area aggregation
    sql += ` GROUP BY p.id, p.code, p.city_id, c.name, c.state_id, s.name, s.country_id, co.name, p.created_at, p.updated_at`;

    // Apply sorting
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortField = sortBy as string;

    if (sortField === 'cityName') {
      sql += ` ORDER BY c.name ${sortDirection}`;
    } else if (sortField === 'state') {
      sql += ` ORDER BY s.name ${sortDirection}`;
    } else if (sortField === 'country') {
      sql += ` ORDER BY co.name ${sortDirection}`;
    } else {
      sql += ` ORDER BY p.${sortField} ${sortDirection}`;
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
      SELECT COUNT(DISTINCT p.id)
      FROM pincodes p
      JOIN cities c ON p.city_id = c.id
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      LEFT JOIN pincode_areas pa ON p.id = pa.pincode_id
      LEFT JOIN areas a ON pa.area_id = a.id
      WHERE 1=1
    `;
    const countParams: QueryParams = [];
    let countParamCount = 0;

    if (cityId) {
      countParamCount++;
      countSql += ` AND p.city_id = $${countParamCount}`;
      countParams.push(cityId as string);
    }

    if (state) {
      countParamCount++;
      countSql += ` AND s.name ILIKE $${countParamCount}`;
      countParams.push(
        `%${typeof state === 'string' || typeof state === 'number' ? String(state) : ''}%`
      );
    }

    if (search) {
      countParamCount++;
      countSql += ` AND (
        p.code ILIKE $${countParamCount} OR
        c.name ILIKE $${countParamCount} OR
        s.name ILIKE $${countParamCount} OR
        a.name ILIKE $${countParamCount}
      )`;
      countParams.push(
        `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
      );
    }

    const countResult = await query<{ count: string }>(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    logger.info(`Retrieved ${result.rows.length} pincodes`, {
      userId: req.user?.id,
      filters: { cityId, state, district, region, search },
      pagination: { page: pageNum, limit: limitNum },
    });

    res.json({
      success: true,
      data: result.rows.map(pincode => ({
        ...pincode,
        id: pincode.id.toString(),
        cityId: pincode.cityId ? pincode.cityId.toString() : null,
        areas: Array.isArray(pincode.areas)
          ? pincode.areas.map((area: Record<string, unknown>) => ({
              ...area,
              id:
                typeof area.id === 'string' || typeof area.id === 'number'
                  ? area.id.toString()
                  : null,
            }))
          : [],
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
    logger.error('Error retrieving pincodes:', error);
    errors.internal(res, 'Failed to retrieve pincodes');
  }
};

// GET /api/pincodes/:id - Get pincode by ID
export const getPincodeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Query pincode with associated areas
    const sql = `
      SELECT
        p.id,
        p.code,
        p.city_id as city_id,
        c.name as city_name,
        s.name as state,
        co.name as country,
        p.created_at as created_at,
        p.updated_at as updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'name', a.name,
              'displayOrder', pa.display_order
            ) ORDER BY pa.display_order
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as areas
      FROM pincodes p
      JOIN cities c ON p.city_id = c.id
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      LEFT JOIN pincode_areas pa ON p.id = pa.pincode_id
      LEFT JOIN areas a ON pa.area_id = a.id
      WHERE p.id = $1
      GROUP BY p.id, p.code, p.city_id, c.name, s.name, co.name, p.created_at, p.updated_at
    `;

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return errors.notFound(res, 'Pincode');
    }

    logger.info(`Retrieved pincode ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error retrieving pincode:', error);
    errors.internal(res, 'Failed to retrieve pincode');
  }
};

// POST /api/pincodes - Create new pincode
export const createPincode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      code,
      area, // For backward compatibility
      areas, // New multi-area support
      cityId,
    } = req.body;

    if (!code || !cityId) {
      return sendError(res, 400, 'Pincode code and city are required', 'VALIDATION_ERROR');
    }

    // Handle areas - support both single area (backward compatibility) and multiple areas
    let areaIds: string[] = [];

    if (areas && Array.isArray(areas) && areas.length > 0) {
      // New multi-area support
      areaIds = areas;
      if (areaIds.length > 15) {
        return sendError(res, 400, 'Maximum 15 areas allowed per pincode', 'VALIDATION_ERROR');
      }
    } else if (area && typeof area === 'string') {
      // Backward compatibility - convert area name to area ID
      const areaResult = await query('SELECT id FROM areas WHERE name = $1', [area.trim()]);
      if (areaResult.rows.length === 0) {
        return sendError(res, 400, 'Area not found. Please select a valid area.', 'INVALID_AREA');
      }
      areaIds = [areaResult.rows[0].id];
    } else {
      return sendError(res, 400, 'At least one area is required', 'VALIDATION_ERROR');
    }

    // Validate area IDs
    for (const areaId of areaIds) {
      if (!areaId || typeof areaId !== 'string') {
        return sendError(res, 400, 'Invalid area ID provided', 'VALIDATION_ERROR');
      }
    }

    // Check if pincode already exists
    const existingPincode = await query('SELECT id FROM pincodes WHERE code = $1', [code]);
    if (existingPincode.rows.length > 0) {
      return sendError(res, 400, 'Pincode already exists', 'DUPLICATE_PINCODE');
    }

    // Verify city exists
    const cityCheck = await query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return sendError(res, 400, 'Invalid city selected', 'INVALID_CITY');
    }

    // Verify all area IDs exist before creating pincode
    for (const areaId of areaIds) {
      const areaCheck = await query('SELECT id FROM areas WHERE id = $1', [areaId]);
      if (areaCheck.rows.length === 0) {
        return sendError(res, 400, `Area with ID ${areaId} not found`, 'INVALID_AREA');
      }
    }

    // Start transaction for pincode creation and area associations
    await query('BEGIN');

    let newPincode;
    try {
      // Create pincode in database
      const pincodeResult = await query(
        'INSERT INTO pincodes (code, city_id) VALUES ($1, $2) RETURNING id, code, city_id as city_id, created_at as created_at, updated_at as updated_at',
        [code, cityId]
      );

      newPincode = pincodeResult.rows[0];

      // Associate pincode with areas
      for (let i = 0; i < areaIds.length; i++) {
        await query(
          'INSERT INTO pincode_areas (pincode_id, area_id, display_order) VALUES ($1, $2, $3)',
          [newPincode.id, areaIds[i], i + 1]
        );
      }

      // Commit transaction
      await query('COMMIT');
    } catch (error) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw error;
    }

    // Get complete pincode data with areas and city information
    const completeResult = await query(
      `
      SELECT
        p.id,
        p.code,
        p.city_id as city_id,
        c.name as city_name,
        s.name as state,
        co.name as country,
        p.created_at as created_at,
        p.updated_at as updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'name', a.name,
              'displayOrder', pa.display_order
            ) ORDER BY pa.display_order
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as areas
      FROM pincodes p
      JOIN cities c ON p.city_id = c.id
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      LEFT JOIN pincode_areas pa ON p.id = pa.pincode_id
      LEFT JOIN areas a ON pa.area_id = a.id
      WHERE p.id = $1
      GROUP BY p.id, p.code, p.city_id, c.name, s.name, co.name, p.created_at, p.updated_at
    `,
      [newPincode.id]
    );

    const responseData = completeResult.rows[0];

    logger.info(`Created new pincode: ${newPincode.id}`, {
      userId: req.user?.id,
      pincodeCode: code,
      requestedAreaIds: areaIds,
      savedAreas: responseData.areas,
      cityName: responseData.cityName,
      areaCount: responseData.areas.length,
    });

    res.status(201).json({
      success: true,
      message: 'Pincode created successfully',
      data: responseData,
    });
  } catch (error) {
    logger.error('Error creating pincode:', error);
    errors.internal(res, 'Failed to create pincode');
  }
};

// PUT /api/pincodes/:id - Update pincode
export const updatePincode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if pincode exists. Post-migration 010 the pincodes table
    // only has: id, code, city_id, created_at, updated_at. The prior
    // query selected 9 columns (pincode, area, city, state,
    // country_id, is_active) that no longer exist — every updatePincode
    // call threw "column does not exist".
    const existingResult = await query(
      'SELECT id, code, city_id, created_at, updated_at FROM pincodes WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return errors.notFound(res, 'Pincode');
    }

    // Check for duplicate code if being updated
    if (updateData.code) {
      const duplicateResult = await query('SELECT id FROM pincodes WHERE id != $1 AND code = $2', [
        id,
        updateData.code,
      ]);

      if (duplicateResult.rows.length > 0) {
        return sendError(res, 400, 'Pincode already exists', 'DUPLICATE_PINCODE');
      }
    }

    // Build update query — only code and city_id are updatable on the
    // pincodes table. Area management goes through the separate
    // /pincodes/:id/areas endpoint + pincode_areas junction table.
    const updateFields: string[] = [];
    const updateValues: QueryParams = [];
    let paramCount = 0;

    if (updateData.code) {
      paramCount++;
      updateFields.push(`code = $${paramCount}`);
      updateValues.push(updateData.code);
    }

    if (updateData.cityId) {
      paramCount++;
      updateFields.push(`city_id = $${paramCount}`);
      updateValues.push(updateData.cityId);
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
    updateValues.push(id);

    const updateQuery = `
      UPDATE pincodes
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);
    const updatedPincode = result.rows[0];

    logger.info(`Updated pincode: ${id}`, {
      userId: req.user?.id,
      changes: Object.keys(updateData),
    });

    res.json({
      success: true,
      data: {
        id: updatedPincode.id,
        code: updatedPincode.code,
        cityId: updatedPincode.cityId,
        createdAt: updatedPincode.createdAt,
        updatedAt: updatedPincode.updatedAt,
      },
      message: 'Pincode updated successfully',
    });
  } catch (error) {
    logger.error('Error updating pincode:', error);
    errors.internal(res, 'Failed to update pincode');
  }
};

// DELETE /api/pincodes/:id - Delete pincode
export const deletePincode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if pincode exists (only real columns)
    const existingResult = await query(
      'SELECT id, code, city_id, created_at, updated_at FROM pincodes WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return errors.notFound(res, 'Pincode');
    }

    const pincodeToDelete = existingResult.rows[0];

    // Delete the pincode
    await query('DELETE FROM pincodes WHERE id = $1', [id]);

    logger.info(`Deleted pincode: ${id}`, {
      userId: req.user?.id,
      pincodeCode: pincodeToDelete.code,
    });

    res.json({
      success: true,
      message: 'Pincode deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting pincode:', error);
    errors.internal(res, 'Failed to delete pincode');
  }
};

// GET /api/pincodes/search - Search pincodes
export const searchPincodes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return sendError(res, 400, 'Search query is required', 'MISSING_QUERY');
    }

    const searchTerm = `%${(q as string).toLowerCase()}%`;
    const limitNum = parseInt(limit as string, 10);

    const result = await query(
      `
      SELECT
        p.id,
        p.code,
        p.area,
        p.city_id as city_id,
        c.name as city_name,
        s.name as state,
        co.name as country,
        p.created_at as created_at,
        p.updated_at as updated_at
      FROM pincodes p
      JOIN cities c ON p.city_id = c.id
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      WHERE
        LOWER(p.code) LIKE $1 OR
        LOWER(p.area) LIKE $1 OR
        LOWER(c.name) LIKE $1 OR
        LOWER(s.name) LIKE $1
      ORDER BY p.code
      LIMIT $2
    `,
      [searchTerm, limitNum]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error searching pincodes:', error);
    errors.internal(res, 'Failed to search pincodes');
  }
};

// POST /api/pincodes/bulk-import - Bulk import pincodes
export const bulkImportPincodes = async (
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response
) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded', 'NO_FILE');
    }

    const { parseCSV, validateCSVRow: _validateCSVRow } = await import('@/utils/csvParser');
    const pincodes = await parseCSV(req.file.buffer);

    const results = {
      total: pincodes.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; code: string; error: string }>,
    };

    // Process each pincode
    for (let i = 0; i < pincodes.length; i++) {
      const pincodeData = pincodes[i];

      try {
        const { code, area, cityName, state, country } = pincodeData;

        // Validate required fields
        if (!code || !area || !cityName || !state) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            code: code || 'N/A',
            error: 'Missing required fields (code, area, cityName, state)',
          });
          continue;
        }

        // Country must exist (auto-create removed — produced junk rows
        // with hardcoded continent + truncated code).
        const countryName = country || 'India';
        const countryResult = await query(
          'SELECT id FROM countries WHERE LOWER(name) = LOWER($1)',
          [countryName]
        );
        if (countryResult.rows.length === 0) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            code,
            error: `Country "${countryName}" not found. Seed it via the countries import first.`,
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
            code,
            error: `State "${state}" not found in country "${countryName}". Seed it via the states import first.`,
          });
          continue;
        }
        const stateId = stateResult.rows[0].id;

        // City auto-created on demand within the state — cities don't
        // carry country/continent metadata so there's nothing to fake.
        const cityResult = await query(
          'SELECT id FROM cities WHERE LOWER(name) = LOWER($1) AND state_id = $2',
          [cityName, stateId]
        );

        let cityId: number;
        if (cityResult.rows.length === 0) {
          const newCity = await query(
            'INSERT INTO cities (name, state_id) VALUES ($1, $2) RETURNING id',
            [cityName, stateId]
          );
          cityId = newCity.rows[0].id;
        } else {
          cityId = cityResult.rows[0].id;
        }

        // Find or create area
        const areaResult = await query('SELECT id FROM areas WHERE LOWER(name) = LOWER($1)', [
          area,
        ]);

        let areaId: number;
        if (areaResult.rows.length === 0) {
          const newArea = await query('INSERT INTO areas (name) VALUES ($1) RETURNING id', [area]);
          areaId = newArea.rows[0].id;
        } else {
          areaId = areaResult.rows[0].id;
        }

        // Check if pincode already exists
        const existingPincode = await query('SELECT id FROM pincodes WHERE code = $1', [code]);

        let pincodeId: number;
        if (existingPincode.rows.length > 0) {
          // Update existing pincode
          await query(`UPDATE pincodes SET city_id = $1, updated_at = NOW() WHERE code = $2`, [
            cityId,
            code,
          ]);
          pincodeId = existingPincode.rows[0].id;

          // Check if area is already associated with this pincode
          const existingAssociation = await query(
            'SELECT id FROM pincode_areas WHERE pincode_id = $1 AND area_id = $2',
            [pincodeId, areaId]
          );

          if (existingAssociation.rows.length === 0) {
            // Get current max display order
            const maxOrderResult = await query(
              'SELECT COALESCE(MAX(display_order), 0) as "max_order" FROM pincode_areas WHERE pincode_id = $1',
              [pincodeId]
            );
            const nextOrder = maxOrderResult.rows[0].maxOrder + 1;

            // Add new area association
            await query(
              'INSERT INTO pincode_areas (pincode_id, area_id, display_order) VALUES ($1, $2, $3)',
              [pincodeId, areaId, nextOrder]
            );
          }

          results.updated++;
        } else {
          // Create new pincode
          const newPincode = await query(
            `INSERT INTO pincodes (code, city_id) VALUES ($1, $2) RETURNING id`,
            [code, cityId]
          );
          pincodeId = newPincode.rows[0].id;

          // Associate area with pincode
          await query(
            'INSERT INTO pincode_areas (pincode_id, area_id, display_order) VALUES ($1, $2, 1)',
            [pincodeId, areaId]
          );

          results.created++;
        }
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          code: pincodeData.code || 'N/A',
          error: (error as Error).message || 'Unknown error',
        });
        logger.error(`Error importing pincode at row ${i + 1}:`, error);
      }
    }

    logger.info('Bulk import completed', {
      userId: req.user?.id,
      results,
    });

    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    logger.error('Error in bulk import:', error);
    errors.internal(res, 'Failed to bulk import pincodes');
  }
};

// GET /api/cities/:id/pincodes - Get pincodes by city
export const getPincodesByCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: cityId } = req.params;
    const { limit = 50 } = req.query;

    const limitNum = parseInt(limit as string, 10);

    const result = await query(
      `
      SELECT
        p.id,
        p.code,
        p.city_id as city_id,
        c.name as city_name,
        s.name as state,
        co.name as country,
        p.created_at as created_at,
        p.updated_at as updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'name', a.name,
              'displayOrder', pa.display_order
            ) ORDER BY pa.display_order
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as areas
      FROM pincodes p
      JOIN cities c ON p.city_id = c.id
      JOIN states s ON c.state_id = s.id
      JOIN countries co ON s.country_id = co.id
      LEFT JOIN pincode_areas pa ON p.id = pa.pincode_id
      LEFT JOIN areas a ON pa.area_id = a.id
      WHERE p.city_id = $1
      GROUP BY p.id, c.name, s.name, co.name
      ORDER BY p.code
      LIMIT $2
    `,
      [cityId, limitNum]
    );

    logger.info(`Retrieved ${result.rows.length} pincodes for city ${cityId}`, {
      userId: req.user?.id,
      cityId,
    });

    res.json({
      success: true,
      data: result.rows.map(pincode => ({
        ...pincode,
        id: pincode.id.toString(), // Convert integer ID to string
        cityId: pincode.cityId ? pincode.cityId.toString() : null, // Convert integer cityId to string if exists
        areas: Array.isArray(pincode.areas)
          ? pincode.areas.map((area: Record<string, unknown>) => ({
              ...area,
              id:
                typeof area.id === 'string' || typeof area.id === 'number'
                  ? area.id.toString()
                  : null,
            }))
          : [],
      })),
    });
  } catch (error) {
    logger.error('Error getting pincodes by city:', error);
    errors.internal(res, 'Failed to get pincodes by city');
  }
};

// GET /api/pincodes/:id/areas - Get areas for a pincode
export const getPincodeAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: pincodeId } = req.params;

    // Check if pincode exists
    const pincodeCheck = await query('SELECT id, code FROM pincodes WHERE id = $1', [pincodeId]);
    if (pincodeCheck.rows.length === 0) {
      return errors.notFound(res, 'Pincode');
    }

    // Get areas for this pincode
    const areasResult = await query(
      `
      SELECT
        a.id,
        a.name,
        pa.display_order
      FROM pincode_areas pa
      JOIN areas a ON pa.area_id = a.id
      WHERE pa.pincode_id = $1
      ORDER BY pa.display_order
    `,
      [pincodeId]
    );

    logger.info(`Retrieved ${areasResult.rows.length} areas for pincode ${pincodeId}`, {
      userId: req.user?.id,
      pincodeId,
      areaCount: areasResult.rows.length,
    });

    res.json({
      success: true,
      data: areasResult.rows,
    });
  } catch (error) {
    logger.error('Error getting pincode areas:', error);
    errors.internal(res, 'Failed to get pincode areas');
  }
};

// POST /api/pincodes/:id/areas - Add areas to a pincode
export const addPincodeAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: pincodeId } = req.params;
    const { areaIds } = req.body;

    if (!areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
      return sendError(res, 400, 'Area IDs array is required', 'VALIDATION_ERROR');
    }

    // Check if pincode exists
    const pincodeCheck = await query('SELECT id FROM pincodes WHERE id = $1', [pincodeId]);
    if (pincodeCheck.rows.length === 0) {
      return errors.notFound(res, 'Pincode');
    }

    // Get current area count
    const currentAreasResult = await query(
      'SELECT COUNT(*) as count FROM pincode_areas WHERE pincode_id = $1',
      [pincodeId]
    );
    const currentCount = parseInt(currentAreasResult.rows[0].count, 10);

    if (currentCount + areaIds.length > 15) {
      return sendError(res, 400, 'Maximum 15 areas allowed per pincode', 'LIMIT_EXCEEDED');
    }

    // Insert new area associations
    const insertedAreas = [];
    for (let i = 0; i < areaIds.length; i++) {
      const areaId = areaIds[i];
      const displayOrder = currentCount + i + 1;

      try {
        // Check if area exists
        const areaCheck = await query('SELECT id, name FROM areas WHERE id = $1', [areaId]);
        if (areaCheck.rows.length === 0) {
          return sendError(res, 400, `Area with ID ${areaId} not found`, 'INVALID_AREA');
        }

        const result = await query(
          `INSERT INTO pincode_areas (pincode_id, area_id, display_order)
           VALUES ($1, $2, $3)
           RETURNING id, display_order as display_order, created_at as created_at`,
          [pincodeId, areaId, displayOrder]
        );

        insertedAreas.push({
          ...result.rows[0],
          id: areaCheck.rows[0].id,
          name: areaCheck.rows[0].name,
        });
      } catch (error: unknown) {
        if ((error as DatabaseError).code === '23505') {
          // Unique constraint violation
          return sendError(res, 400, 'Area is already assigned to this pincode', 'DUPLICATE_AREA');
        }
        throw error;
      }
    }

    logger.info(`Added ${insertedAreas.length} areas to pincode ${pincodeId}`, {
      userId: req.user?.id,
      pincodeId,
      areas: insertedAreas.map(a => a.name),
    });

    res.status(201).json({
      success: true,
      message: `Successfully added ${insertedAreas.length} areas`,
      data: insertedAreas,
    });
  } catch (error) {
    logger.error('Error adding pincode areas:', error);
    errors.internal(res, 'Failed to add areas');
  }
};

// DELETE /api/pincodes/:id/areas/:areaId - Remove area from pincode
export const removePincodeArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: pincodeId, areaId } = req.params;

    // Check if area is assigned to this pincode
    const areaCheck = await query(
      'SELECT pa.id, a.name FROM pincode_areas pa JOIN areas a ON pa.area_id = a.id WHERE pa.pincode_id = $1 AND pa.area_id = $2',
      [pincodeId, areaId]
    );

    if (areaCheck.rows.length === 0) {
      return errors.notFound(res, 'Area not assigned to this pincode');
    }

    // Check if this is the last area (prevent deletion if it would leave pincode with no areas)
    const areaCountResult = await query(
      'SELECT COUNT(*) as count FROM pincode_areas WHERE pincode_id = $1',
      [pincodeId]
    );
    const areaCount = parseInt(areaCountResult.rows[0].count, 10);

    if (areaCount <= 1) {
      return sendError(
        res,
        400,
        'Cannot remove the last area. Pincode must have at least one area.',
        'LAST_AREA_DELETION'
      );
    }

    const areaName = areaCheck.rows[0].name;

    // Remove the area assignment
    await query('DELETE FROM pincode_areas WHERE pincode_id = $1 AND area_id = $2', [
      pincodeId,
      areaId,
    ]);

    logger.info(`Removed area ${areaId} (${areaName}) from pincode ${pincodeId}`, {
      userId: req.user?.id,
      pincodeId,
      areaId,
      areaName,
    });

    res.json({
      success: true,
      message: 'Area removed successfully',
    });
  } catch (error) {
    logger.error('Error removing pincode area:', error);
    errors.internal(res, 'Failed to remove area');
  }
};
