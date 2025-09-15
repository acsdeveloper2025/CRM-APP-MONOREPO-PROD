import { Request, Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';

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
      deliveryStatus,
      isActive,
      search,
      sortBy = 'code',
      sortOrder = 'asc'
    } = req.query;

    // Build SQL query with joins to get pincode data and associated areas
    let sql = `
      SELECT
        p.id,
        p.code,
        p."cityId" as "cityId",
        c.name as "cityName",
        s.name as state,
        co.name as country,
        p."createdAt" as "createdAt",
        p."updatedAt" as "updatedAt",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'name', a.name,
              'displayOrder', pa."displayOrder"
            ) ORDER BY pa."displayOrder"
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as areas
      FROM pincodes p
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id
      LEFT JOIN "pincodeAreas" pa ON p.id = pa."pincodeId"
      LEFT JOIN areas a ON pa."areaId" = a.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    // Apply filters
    if (cityId) {
      paramCount++;
      sql += ` AND p."cityId" = $${paramCount}`;
      params.push(cityId);
    }

    if (state) {
      paramCount++;
      sql += ` AND s.name ILIKE $${paramCount}`;
      params.push(`%${state}%`);
    }

    if (search) {
      paramCount++;
      sql += ` AND (
        p.code ILIKE $${paramCount} OR
        c.name ILIKE $${paramCount} OR
        s.name ILIKE $${paramCount} OR
        p.area ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Add GROUP BY clause for area aggregation
    sql += ` GROUP BY p.id, p.code, p."cityId", c.name, s.name, co.name, p."createdAt", p."updatedAt"`;

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
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id
      LEFT JOIN "pincodeAreas" pa ON p.id = pa."pincodeId"
      LEFT JOIN areas a ON pa."areaId" = a.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamCount = 0;

    if (cityId) {
      countParamCount++;
      countSql += ` AND p."cityId" = $${countParamCount}`;
      countParams.push(cityId);
    }

    if (state) {
      countParamCount++;
      countSql += ` AND s.name ILIKE $${countParamCount}`;
      countParams.push(`%${state}%`);
    }

    if (search) {
      countParamCount++;
      countSql += ` AND (
        p.code ILIKE $${countParamCount} OR
        c.name ILIKE $${countParamCount} OR
        s.name ILIKE $${countParamCount} OR
        a.name ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query<{ count: string }>(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    logger.info(`Retrieved ${result.rows.length} pincodes`, {
      userId: req.user?.id,
      filters: { cityId, state, district, region, search },
      pagination: { page: pageNum, limit: limitNum }
    });

    res.json({
      success: true,
      data: result.rows,
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pincodes',
      error: { code: 'INTERNAL_ERROR' },
    });
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
        p."cityId" as "cityId",
        c.name as "cityName",
        s.name as state,
        co.name as country,
        p."createdAt" as "createdAt",
        p."updatedAt" as "updatedAt",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'name', a.name,
              'displayOrder', pa."displayOrder"
            ) ORDER BY pa."displayOrder"
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as areas
      FROM pincodes p
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id
      LEFT JOIN "pincodeAreas" pa ON p.id = pa."pincodeId"
      LEFT JOIN areas a ON pa."areaId" = a.id
      WHERE p.id = $1
      GROUP BY p.id, p.code, p."cityId", c.name, s.name, co.name, p."createdAt", p."updatedAt"
    `;

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pincode not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved pincode ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error retrieving pincode:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pincode',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/pincodes - Create new pincode
export const createPincode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      code,
      area, // For backward compatibility
      areas, // New multi-area support
      cityId
    } = req.body;



    if (!code || !cityId) {
      return res.status(400).json({
        success: false,
        message: 'Pincode code and city are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Handle areas - support both single area (backward compatibility) and multiple areas
    let areaIds: string[] = [];

    if (areas && Array.isArray(areas) && areas.length > 0) {
      // New multi-area support
      areaIds = areas;
      if (areaIds.length > 15) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 15 areas allowed per pincode',
          error: { code: 'VALIDATION_ERROR' },
        });
      }
    } else if (area && typeof area === 'string') {
      // Backward compatibility - convert area name to area ID
      const areaResult = await query('SELECT id FROM areas WHERE name = $1', [area.trim()]);
      if (areaResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Area not found. Please select a valid area.',
          error: { code: 'INVALID_AREA' },
        });
      }
      areaIds = [areaResult.rows[0].id];
    } else {
      return res.status(400).json({
        success: false,
        message: 'At least one area is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Validate area IDs
    for (const areaId of areaIds) {
      if (!areaId || typeof areaId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Invalid area ID provided',
          error: { code: 'VALIDATION_ERROR' },
        });
      }
    }

    // Check if pincode already exists
    const existingPincode = await query('SELECT id FROM pincodes WHERE code = $1', [code]);
    if (existingPincode.rows.length > 0) {

      return res.status(400).json({
        success: false,
        message: 'Pincode already exists',
        error: { code: 'DUPLICATE_PINCODE' },
      });
    }

    // Verify city exists
    const cityCheck = await query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city selected',
        error: { code: 'INVALID_CITY' },
      });
    }

    // Verify all area IDs exist before creating pincode
    for (const areaId of areaIds) {
      const areaCheck = await query('SELECT id FROM areas WHERE id = $1', [areaId]);
      if (areaCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Area with ID ${areaId} not found`,
          error: { code: 'INVALID_AREA' },
        });
      }
    }

    // Start transaction for pincode creation and area associations
    await query('BEGIN');

    let newPincode;
    try {
      // Create pincode in database
      const pincodeResult = await query(
        'INSERT INTO pincodes (code, "cityId") VALUES ($1, $2) RETURNING id, code, "cityId" as "cityId", "createdAt" as "createdAt", "updatedAt" as "updatedAt"',
        [code, cityId]
      );

      newPincode = pincodeResult.rows[0];

      // Associate pincode with areas
      for (let i = 0; i < areaIds.length; i++) {
        await query(
          'INSERT INTO "pincodeAreas" ("pincodeId", "areaId", "displayOrder") VALUES ($1, $2, $3)',
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
    const completeResult = await query(`
      SELECT
        p.id,
        p.code,
        p."cityId" as "cityId",
        c.name as "cityName",
        s.name as state,
        co.name as country,
        p."createdAt" as "createdAt",
        p."updatedAt" as "updatedAt",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'name', a.name,
              'displayOrder', pa."displayOrder"
            ) ORDER BY pa."displayOrder"
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as areas
      FROM pincodes p
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id
      LEFT JOIN "pincodeAreas" pa ON p.id = pa."pincodeId"
      LEFT JOIN areas a ON pa."areaId" = a.id
      WHERE p.id = $1
      GROUP BY p.id, p.code, p."cityId", c.name, s.name, co.name, p."createdAt", p."updatedAt"
    `, [newPincode.id]);

    const responseData = completeResult.rows[0];

    logger.info(`Created new pincode: ${newPincode.id}`, {
      userId: req.user?.id,
      pincodeCode: code,
      requestedAreaIds: areaIds,
      savedAreas: responseData.areas,
      cityName: responseData.cityName,
      areaCount: responseData.areas.length
    });

    res.status(201).json({
      success: true,
      message: 'Pincode created successfully',
      data: responseData,
    });
  } catch (error) {
    logger.error('Error creating pincode:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create pincode',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/pincodes/:id - Update pincode
export const updatePincode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if pincode exists
    const existingResult = await query(
      'SELECT * FROM pincodes WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pincode not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for duplicate code if being updated
    if (updateData.code) {
      const duplicateResult = await query(
        'SELECT id FROM pincodes WHERE id != $1 AND code = $2',
        [id, updateData.code]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Pincode already exists',
          error: { code: 'DUPLICATE_PINCODE' },
        });
      }
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 0;

    if (updateData.code) {
      paramCount++;
      updateFields.push(`code = $${paramCount}`);
      updateValues.push(updateData.code);
    }

    if (updateData.area) {
      paramCount++;
      updateFields.push(`area = $${paramCount}`);
      updateValues.push(updateData.area);
    }

    if (updateData.cityId) {
      paramCount++;
      updateFields.push(`"cityId" = $${paramCount}`);
      updateValues.push(updateData.cityId);
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
      UPDATE pincodes
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);
    const updatedPincode = result.rows[0];

    logger.info(`Updated pincode: ${id}`, {
      userId: req.user?.id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: {
        id: updatedPincode.id,
        code: updatedPincode.code,
        area: updatedPincode.area,
        cityId: updatedPincode.cityId,
        createdAt: updatedPincode.createdAt,
        updatedAt: updatedPincode.updatedAt,
      },
      message: 'Pincode updated successfully',
    });
  } catch (error) {
    logger.error('Error updating pincode:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pincode',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/pincodes/:id - Delete pincode
export const deletePincode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if pincode exists
    const existingResult = await query(
      'SELECT * FROM pincodes WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pincode not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const pincodeToDelete = existingResult.rows[0];

    // Delete the pincode
    await query('DELETE FROM pincodes WHERE id = $1', [id]);

    logger.info(`Deleted pincode: ${id}`, {
      userId: req.user?.id,
      pincodeCode: pincodeToDelete.code
    });

    res.json({
      success: true,
      message: 'Pincode deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting pincode:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete pincode',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/pincodes/search - Search pincodes
export const searchPincodes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
        error: { code: 'MISSING_QUERY' },
      });
    }

    const searchTerm = `%${(q as string).toLowerCase()}%`;
    const limitNum = parseInt(limit as string, 10);

    const result = await query(`
      SELECT
        p.id,
        p.code,
        p.area,
        p."cityId" as "cityId",
        c.name as "cityName",
        s.name as state,
        co.name as country,
        p."createdAt" as "createdAt",
        p."updatedAt" as "updatedAt"
      FROM pincodes p
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id
      WHERE
        LOWER(p.code) LIKE $1 OR
        LOWER(p.area) LIKE $1 OR
        LOWER(c.name) LIKE $1 OR
        LOWER(s.name) LIKE $1
      ORDER BY p.code
      LIMIT $2
    `, [searchTerm, limitNum]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error searching pincodes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search pincodes',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/pincodes/bulk-import - Bulk import pincodes
export const bulkImportPincodes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // TODO: Implement database-driven bulk import
    res.status(501).json({
      success: false,
      message: 'Bulk import not implemented yet - requires database integration',
      error: { code: 'NOT_IMPLEMENTED' },
    });
  } catch (error) {
    logger.error('Error in bulk import:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import pincodes',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/cities/:id/pincodes - Get pincodes by city
export const getPincodesByCity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: cityId } = req.params;
    const { limit = 50 } = req.query;

    const limitNum = parseInt(limit as string, 10);

    const result = await query(`
      SELECT
        p.id,
        p.code,
        p.area,
        p."cityId" as "cityId",
        c.name as "cityName",
        s.name as state,
        co.name as country,
        p."createdAt" as "createdAt",
        p."updatedAt" as "updatedAt"
      FROM pincodes p
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      JOIN countries co ON c."countryId" = co.id
      WHERE p."cityId" = $1
      ORDER BY p.code
      LIMIT $2
    `, [cityId, limitNum]);

    logger.info(`Retrieved ${result.rows.length} pincodes for city ${cityId}`, {
      userId: req.user?.id,
      cityId
    });

    res.json({
      success: true,
      data: result.rows.map(pincode => ({
        ...pincode,
        id: pincode.id.toString(), // Convert integer ID to string
        cityId: pincode.cityId ? pincode.cityId.toString() : null // Convert integer cityId to string if exists
      })),
    });
  } catch (error) {
    logger.error('Error getting pincodes by city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pincodes by city',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/pincodes/:id/areas - Get areas for a pincode
export const getPincodeAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: pincodeId } = req.params;

    // Check if pincode exists
    const pincodeCheck = await query('SELECT id, code FROM pincodes WHERE id = $1', [pincodeId]);
    if (pincodeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pincode not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get areas for this pincode
    const areasResult = await query(`
      SELECT
        a.id,
        a.name,
        pa."displayOrder"
      FROM "pincodeAreas" pa
      JOIN areas a ON pa."areaId" = a.id
      WHERE pa."pincodeId" = $1
      ORDER BY pa."displayOrder"
    `, [pincodeId]);

    logger.info(`Retrieved ${areasResult.rows.length} areas for pincode ${pincodeId}`, {
      userId: req.user?.id,
      pincodeId,
      areaCount: areasResult.rows.length
    });

    res.json({
      success: true,
      data: areasResult.rows,
    });
  } catch (error) {
    logger.error('Error getting pincode areas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pincode areas',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/pincodes/:id/areas - Add areas to a pincode
export const addPincodeAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: pincodeId } = req.params;
    const { areaIds } = req.body;

    if (!areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Area IDs array is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if pincode exists
    const pincodeCheck = await query('SELECT id FROM pincodes WHERE id = $1', [pincodeId]);
    if (pincodeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pincode not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get current area count
    const currentAreasResult = await query(
      'SELECT COUNT(*) as count FROM "pincodeAreas" WHERE "pincodeId" = $1',
      [pincodeId]
    );
    const currentCount = parseInt(currentAreasResult.rows[0].count, 10);

    if (currentCount + areaIds.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 15 areas allowed per pincode',
        error: { code: 'LIMIT_EXCEEDED' },
      });
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
          return res.status(400).json({
            success: false,
            message: `Area with ID ${areaId} not found`,
            error: { code: 'INVALID_AREA' },
          });
        }

        const result = await query(
          `INSERT INTO "pincodeAreas" ("pincodeId", "areaId", "displayOrder")
           VALUES ($1, $2, $3)
           RETURNING id, "displayOrder" as "displayOrder", "createdAt" as "createdAt"`,
          [pincodeId, areaId, displayOrder]
        );

        insertedAreas.push({
          ...result.rows[0],
          id: areaCheck.rows[0].id,
          name: areaCheck.rows[0].name
        });
      } catch (error: any) {
        if (error.code === '23505') { // Unique constraint violation
          return res.status(400).json({
            success: false,
            message: `Area is already assigned to this pincode`,
            error: { code: 'DUPLICATE_AREA' },
          });
        }
        throw error;
      }
    }

    logger.info(`Added ${insertedAreas.length} areas to pincode ${pincodeId}`, {
      userId: req.user?.id,
      pincodeId,
      areas: insertedAreas.map(a => a.name)
    });

    res.status(201).json({
      success: true,
      message: `Successfully added ${insertedAreas.length} areas`,
      data: insertedAreas,
    });
  } catch (error) {
    logger.error('Error adding pincode areas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add areas',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/pincodes/:id/areas/:areaId - Remove area from pincode
export const removePincodeArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: pincodeId, areaId } = req.params;

    // Check if area is assigned to this pincode
    const areaCheck = await query(
      'SELECT pa.id, a.name FROM "pincodeAreas" pa JOIN areas a ON pa."areaId" = a.id WHERE pa."pincodeId" = $1 AND pa."areaId" = $2',
      [pincodeId, areaId]
    );

    if (areaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Area not assigned to this pincode',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if this is the last area (prevent deletion if it would leave pincode with no areas)
    const areaCountResult = await query(
      'SELECT COUNT(*) as count FROM "pincodeAreas" WHERE "pincodeId" = $1',
      [pincodeId]
    );
    const areaCount = parseInt(areaCountResult.rows[0].count, 10);

    if (areaCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the last area. Pincode must have at least one area.',
        error: { code: 'LAST_AREA_DELETION' },
      });
    }

    const areaName = areaCheck.rows[0].name;

    // Remove the area assignment
    await query('DELETE FROM "pincodeAreas" WHERE "pincodeId" = $1 AND "areaId" = $2', [pincodeId, areaId]);

    logger.info(`Removed area ${areaId} (${areaName}) from pincode ${pincodeId}`, {
      userId: req.user?.id,
      pincodeId,
      areaId,
      areaName
    });

    res.json({
      success: true,
      message: 'Area removed successfully',
    });
  } catch (error) {
    logger.error('Error removing pincode area:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove area',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};






