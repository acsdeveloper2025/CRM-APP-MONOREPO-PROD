import { Request, Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';

// Get all designations
export const getDesignations = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      isActive,
      departmentId 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    let whereConditions = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      whereConditions.push(`(d.name ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Active status filter
    if (isActive !== undefined) {
      whereConditions.push(`d."isActive" = $${paramIndex}`);
      queryParams.push(isActive === 'true');
      paramIndex++;
    }

    // Department filter
    if (departmentId) {
      whereConditions.push(`d."departmentId" = $${paramIndex}`);
      queryParams.push(departmentId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const designationsQuery = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d."departmentId",
        dept.name as "departmentName",
        d."isActive",
        d."createdAt",
        d."updatedAt",
        creator.name as "createdByName",
        updater.name as "updatedByName"
      FROM designations d
      LEFT JOIN departments dept ON d."departmentId" = dept.id
      LEFT JOIN users creator ON d."createdBy" = creator.id
      LEFT JOIN users updater ON d."updatedBy" = updater.id
      ${whereClause}
      ORDER BY d.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(Number(limit), offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM designations d
      LEFT JOIN departments dept ON d."departmentId" = dept.id
      ${whereClause}
    `;

    const [designationsResult, countResult] = await Promise.all([
      query(designationsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: designationsResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching designations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Get designation by ID
export const getDesignationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const designationQuery = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d."departmentId",
        dept.name as "departmentName",
        d."isActive",
        d."createdAt",
        d."updatedAt",
        creator.name as "createdByName",
        updater.name as "updatedByName"
      FROM designations d
      LEFT JOIN departments dept ON d."departmentId" = dept.id
      LEFT JOIN users creator ON d."createdBy" = creator.id
      LEFT JOIN users updater ON d."updatedBy" = updater.id
      WHERE d.id = $1
    `;

    const result = await query(designationQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Create designation
export const createDesignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, departmentId, isActive = true } = req.body;
    const userId = req.user?.id;

    // Check if designation name already exists
    const existingDesignation = await query(
      'SELECT id FROM designations WHERE name = $1',
      [name]
    );

    if (existingDesignation.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Designation name already exists',
        error: { code: 'DUPLICATE_NAME' },
      });
    }

    const createQuery = `
      INSERT INTO designations (name, description, "departmentId", "isActive", "createdBy", "updatedBy")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, "departmentId", "isActive", "createdAt", "updatedAt"
    `;

    const result = await query(createQuery, [
      name,
      description || null,
      departmentId || null,
      isActive,
      userId,
      userId
    ]);

    const newDesignation = result.rows[0];

    logger.info(`Designation created: ${name}`, { designationId: newDesignation.id, userId });

    res.status(201).json({
      success: true,
      data: newDesignation,
      message: 'Designation created successfully',
    });
  } catch (error) {
    logger.error('Error creating designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Update designation
export const updateDesignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, departmentId, isActive } = req.body;
    const userId = req.user?.id;

    // Check if designation exists
    const existingDesignation = await query(
      'SELECT id, name FROM designations WHERE id = $1',
      [id]
    );

    if (existingDesignation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if new name conflicts with existing designation (excluding current one)
    if (name && name !== existingDesignation.rows[0].name) {
      const nameConflict = await query(
        'SELECT id FROM designations WHERE name = $1 AND id != $2',
        [name, id]
      );

      if (nameConflict.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Designation name already exists',
          error: { code: 'DUPLICATE_NAME' },
        });
      }
    }

    const updateQuery = `
      UPDATE designations 
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        "departmentId" = COALESCE($3, "departmentId"),
        "isActive" = COALESCE($4, "isActive"),
        "updatedBy" = $5,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, name, description, "departmentId", "isActive", "createdAt", "updatedAt"
    `;

    const result = await query(updateQuery, [
      name || null,
      description || null,
      departmentId || null,
      isActive !== undefined ? isActive : null,
      userId,
      id
    ]);

    const updatedDesignation = result.rows[0];

    logger.info(`Designation updated: ${updatedDesignation.name}`, { designationId: id, userId });

    res.json({
      success: true,
      data: updatedDesignation,
      message: 'Designation updated successfully',
    });
  } catch (error) {
    logger.error('Error updating designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Delete designation
export const deleteDesignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check if designation exists
    const existingDesignation = await query(
      'SELECT id, name FROM designations WHERE id = $1',
      [id]
    );

    if (existingDesignation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if designation is being used by any users
    const usageCheck = await query(
      'SELECT COUNT(*) as count FROM users WHERE designation = $1',
      [existingDesignation.rows[0].name]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete designation as it is assigned to users',
        error: { code: 'DESIGNATION_IN_USE' },
      });
    }

    await query('DELETE FROM designations WHERE id = $1', [id]);

    logger.info(`Designation deleted: ${existingDesignation.rows[0].name}`, { designationId: id, userId });

    res.json({
      success: true,
      message: 'Designation deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Get active designations (for dropdowns)
export const getActiveDesignations = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.query;

    let whereClause = 'WHERE d."isActive" = true';
    const queryParams: any[] = [];

    if (departmentId) {
      whereClause += ' AND (d."departmentId" = $1 OR d."departmentId" IS NULL)';
      queryParams.push(departmentId);
    }

    const designationsQuery = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d."departmentId",
        dept.name as "departmentName"
      FROM designations d
      LEFT JOIN departments dept ON d."departmentId" = dept.id
      ${whereClause}
      ORDER BY d.name ASC
    `;

    const result = await query(designationsQuery, queryParams);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching active designations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active designations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
