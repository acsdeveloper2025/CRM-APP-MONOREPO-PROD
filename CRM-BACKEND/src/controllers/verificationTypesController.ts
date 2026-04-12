import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';

// GET /api/verification-types - List verification types with pagination and filters
export const getVerificationTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Build where clause for search
    let whereClause = '';
    const queryParams: QueryParams = [];
    let paramIndex = 1;

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClause = `WHERE COALESCE(name, '') ILIKE $${paramIndex} OR COALESCE(code, '') ILIKE $${paramIndex} OR COALESCE(description, '') ILIKE $${paramIndex}`;
      queryParams.push(searchTerm);
      paramIndex++;
    }

    // Get total count with search filter
    const countQuery = `SELECT COUNT(*)::text as count FROM verification_types ${whereClause}`;
    const countRes = await query<{ count: string }>(countQuery, queryParams);
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // API contract: sortBy is camelCase; map to snake_case DB column.
    const sortColumnMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      category: 'category',
      basePrice: 'base_price',
      estimatedTime: 'estimated_time',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 'name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // M10: secondary ORDER BY id so OFFSET pagination is deterministic
    // when rows share the same sort column value (many verification
    // types share created_at after a batch import).
    const dataQuery = `SELECT id, name, code, description, is_active, created_at, updated_at,
       EXISTS (
         SELECT 1 FROM rates r WHERE r.verification_type_id = verification_types.id AND r.is_active = true
       ) as "hasRates"
       FROM verification_types ${whereClause} ORDER BY ${sortCol} ${sortDir}, id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataParams = [...queryParams, Number(limit), (Number(page) - 1) * Number(limit)];
    const vtRes = await query(dataQuery, dataParams);
    const verificationTypes = vtRes.rows;

    logger.info(`Retrieved ${verificationTypes.length} verification types from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: verificationTypes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving verification types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/verification-types/:id - Get verification type by ID
export const getVerificationTypeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vtRes2 = await query(
      `SELECT id, name, code, description, is_active, created_at, updated_at FROM verification_types WHERE id = $1`,
      [Number(id)]
    );
    const verificationType = vtRes2.rows[0];
    if (!verificationType) {
      return res.status(404).json({
        success: false,
        message: 'Verification type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved verification type ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: verificationType,
    });
  } catch (error) {
    logger.error('Error retrieving verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/verification-types - Create new verification type
export const createVerificationType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code } = req.body;

    // Check if verification type code already exists
    const exRes = await query(`SELECT id FROM verification_types WHERE code = $1`, [code]);
    const existingVerificationType = exRes.rows[0];

    if (existingVerificationType) {
      return res.status(400).json({
        success: false,
        message: 'Verification type code already exists',
        error: { code: 'DUPLICATE_CODE' },
      });
    }

    // Create verification type in database
    const newRes = await query(
      `INSERT INTO verification_types (id, name, code, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [name, code]
    );
    const newVerificationType = newRes.rows[0];

    logger.info(`Created new verification type: ${newVerificationType.id}`, {
      userId: req.user?.id,
      verificationTypeName: name,
      verificationTypeCode: code,
    });

    res.status(201).json({
      success: true,
      data: newVerificationType,
      message: 'Verification type created successfully',
    });
  } catch (error) {
    logger.error('Error creating verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/verification-types/:id - Update verification type
export const updateVerificationType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if verification type exists
    const exRes2 = await query(
      `SELECT id, name, code, description, is_active, created_at, updated_at FROM verification_types WHERE id = $1`,
      [id]
    );
    const existingVerificationType = exRes2.rows[0];

    if (!existingVerificationType) {
      return res.status(404).json({
        success: false,
        message: 'Verification type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for duplicate code if being updated
    if (updateData.code && updateData.code !== existingVerificationType.code) {
      const dupRes = await query(`SELECT id FROM verification_types WHERE code = $1`, [
        updateData.code,
      ]);
      const duplicateVerificationType = dupRes.rows[0];

      if (duplicateVerificationType) {
        return res.status(400).json({
          success: false,
          message: 'Verification type code already exists',
          error: { code: 'DUPLICATE_CODE' },
        });
      }
    }

    // Prepare update data
    const updatePayload: Record<string, unknown> = {};

    if (updateData.name) {
      updatePayload.name = updateData.name;
    }
    if (updateData.code) {
      updatePayload.code = updateData.code;
    }

    // Update verification type
    const sets: string[] = [];
    const vals: QueryParams = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updatePayload)) {
      sets.push(`"${key}" = $${idx++}`);
      vals.push(value as string | number | boolean | Date | number[] | string[]);
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(id);
    const updRes = await query(
      `UPDATE verification_types SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    const updatedVerificationType = updRes.rows[0];

    logger.info(`Updated verification type: ${id}`, {
      userId: req.user?.id,
      verificationTypeId: id,
      updates: Object.keys(updatePayload),
    });

    res.json({
      success: true,
      data: updatedVerificationType,
      message: 'Verification type updated successfully',
    });
  } catch (error) {
    logger.error('Error updating verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/verification-types/:id - Delete verification type
export const deleteVerificationType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if verification type exists
    const exRes3 = await query(
      `SELECT id, name, code, description, is_active, created_at, updated_at FROM verification_types WHERE id = $1`,
      [id]
    );
    const existingVerificationType = exRes3.rows[0];

    if (!existingVerificationType) {
      return res.status(404).json({
        success: false,
        message: 'Verification type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Delete verification type
    await query(`DELETE FROM verification_types WHERE id = $1`, [id]);

    logger.info(`Deleted verification type: ${id}`, {
      userId: req.user?.id,
      verificationTypeId: id,
      verificationTypeName: existingVerificationType.name,
    });

    res.json({
      success: true,
      message: 'Verification type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting verification type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete verification type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/verification-types/stats - Get verification type statistics
export const getVerificationTypeStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get total count
    const totalRes = await query(`SELECT COUNT(*)::int as total FROM verification_types`);
    const total = totalRes.rows[0]?.total || 0;

    // For now, return basic stats since the verification_types table doesn't have isActive or category columns
    const stats = {
      total,
      active: total, // Assuming all verification types are active since no isActive column
      inactive: 0,
      byCategory: {
        OTHER: total, // Default category since no category column
      },
    };

    res.json({
      success: true,
      data: stats,
      message: 'Verification type statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving verification type statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification type statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
