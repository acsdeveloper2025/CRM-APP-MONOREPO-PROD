import { Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';

// GET /api/areas - List areas with pagination and filters
export const getAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      cityId,
      state,
      country,
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Query areas with usage count from pincodeAreas junction table
    let sql = `
      SELECT
        a.id,
        a.name,
        a."createdAt",
        a."updatedAt",
        COALESCE(COUNT(pa.id), 0) as "usageCount"
      FROM areas a
      LEFT JOIN "pincodeAreas" pa ON pa."areaId" = a.id
    `;

    const params: any[] = [];
    let paramCount = 0;
    const whereConditions: string[] = [];

    // Apply search filter
    if (search) {
      paramCount++;
      whereConditions.push(`a.name ILIKE $${paramCount}`);
      params.push(`%${search}%`);
    }

    // Add WHERE clause if needed
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add GROUP BY
    sql += ` GROUP BY a.id, a.name, a."createdAt", a."updatedAt"`;

    // Apply sorting
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortField = sortBy as string;

    if (sortField === 'usageCount') {
      sql += ` ORDER BY "usageCount" ${sortDirection}`;
    } else if (sortField === 'createdAt') {
      sql += ` ORDER BY a."createdAt" ${sortDirection}`;
    } else if (sortField === 'name') {
      sql += ` ORDER BY a.name ${sortDirection}`;
    } else {
      sql += ` ORDER BY a.name ${sortDirection}`;
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
      SELECT COUNT(*) as count
      FROM areas a
    `;

    const countParams: any[] = [];
    let countParamCount = 0;
    const countWhereConditions: string[] = [];

    // Apply same search filter for count
    if (search) {
      countParamCount++;
      countWhereConditions.push(`a.name ILIKE $${countParamCount}`);
      countParams.push(`%${search}%`);
    }

    // Add WHERE clause if needed
    if (countWhereConditions.length > 0) {
      countSql += ` WHERE ${countWhereConditions.join(' AND ')}`;
    }

    const countResult = await query<{ count: string }>(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limitNum);

    logger.info(`Retrieved ${result.rows.length} areas`, {
      userId: req.user?.id,
      filters: { cityId, state, country, search },
      pagination: { page: pageNum, limit: limitNum }
    });

    res.json({
      success: true,
      data: result.rows.map(area => ({
        ...area,
        id: area.id.toString() // Convert integer ID to string for frontend compatibility
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
    logger.error('Error retrieving areas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve areas',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/standalone-areas - Get standalone areas for multi-select
export const getStandaloneAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, name FROM areas ORDER BY name ASC'
    );

    logger.info(`Retrieved ${result.rows.length} standalone areas`, {
      userId: req.user?.id,
      count: result.rows.length
    });

    res.json({
      success: true,
      data: result.rows.map(area => ({
        ...area,
        id: area.id.toString() // Convert integer ID to string for frontend compatibility
      })),
    });
  } catch (error) {
    logger.error('Error retrieving standalone areas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve standalone areas',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/areas/:id - Get area by ID
export const getAreaById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Query area with usage count
    const sql = `
      SELECT
        a.id,
        a.name,
        a."createdAt",
        a."updatedAt",
        COUNT(pa.id) as "usageCount"
      FROM areas a
      LEFT JOIN "pincodeAreas" pa ON pa."areaId" = a.id
      WHERE a.id = $1
      GROUP BY a.id, a.name, a."createdAt", a."updatedAt"
    `;

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Area not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved area ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error retrieving area:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve area',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/areas - Create standalone area
export const createArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Valid area name is required (minimum 2 characters)',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if area name already exists (case-insensitive)
    const existingAreaCheck = await query(
      'SELECT id FROM areas WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name.trim()]
    );

    if (existingAreaCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Area with this name already exists',
        error: { code: 'DUPLICATE_AREA' },
      });
    }

    // Create a standalone area entry
    const result = await query(
      `INSERT INTO areas (name, "createdAt", "updatedAt")
       VALUES ($1, NOW(), NOW())
       RETURNING id, name, "createdAt" as "createdAt", "updatedAt" as "updatedAt"`,
      [name.trim()]
    );

    const newArea = result.rows[0];

    logger.info(`Created standalone area: ${name}`, {
      userId: req.user?.id,
      areaId: newArea.id,
      areaName: name.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Area created successfully',
      data: {
        ...newArea,
        id: newArea.id.toString() // Convert integer ID to string for frontend compatibility
      },
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        message: 'Area with this name already exists',
        error: { code: 'DUPLICATE_AREA' },
      });
    }

    logger.error('Error creating area:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create area',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/areas/:id - Update area
export const updateArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, displayOrder } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Valid area name is required (minimum 2 characters)',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if area exists
    const areaCheck = await query('SELECT id, name FROM areas WHERE id = $1', [id]);

    if (areaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Area not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for duplicate area name
    const duplicateCheck = await query(
      'SELECT id FROM areas WHERE name = $1 AND id != $2',
      [name.trim(), id]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Area name already exists',
        error: { code: 'DUPLICATE_AREA' },
      });
    }

    // Update the area
    const result = await query(
      `UPDATE areas
       SET name = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, "updatedAt" as "updatedAt"`,
      [id, name.trim()]
    );

    logger.info(`Updated area ${id}`, { 
      userId: req.user?.id,
      areaId: id,
      newName: name
    });

    res.json({
      success: true,
      message: 'Area updated successfully',
      data: {
        ...result.rows[0],
        id: result.rows[0].id.toString() // Convert integer ID to string for frontend compatibility
      },
    });
  } catch (error) {
    logger.error('Error updating area:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update area',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/areas/:id - Delete area
export const deleteArea = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if area exists
    const areaCheck = await query(
      'SELECT id, name FROM areas WHERE id = $1',
      [id]
    );

    if (areaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Area not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const areaName = areaCheck.rows[0].name;

    // Check if area is in use by any pincodes
    const usageCheck = await query(
      'SELECT COUNT(*) as count FROM "pincodeAreas" WHERE "areaId" = $1',
      [id]
    );
    const usageCount = parseInt(usageCheck.rows[0].count, 10);

    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete area "${areaName}" as it is assigned to ${usageCount} pincode(s)`,
        error: { code: 'AREA_IN_USE' },
      });
    }

    // Delete the area
    await query('DELETE FROM areas WHERE id = $1', [id]);

    logger.info(`Deleted standalone area ${id} (${areaName})`, {
      userId: req.user?.id,
      areaId: id,
      areaName,
      type: 'standalone_area'
    });

    res.json({
      success: true,
      message: 'Area deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting area:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete area',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
