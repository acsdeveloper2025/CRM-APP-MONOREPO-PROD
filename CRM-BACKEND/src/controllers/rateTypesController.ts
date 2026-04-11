import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';

// GET /api/rate-types - List rate types with pagination and filters
export const getRateTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      isActive,
    } = req.query;

    // Build where clause
    const values: QueryParams = [];
    const whereSql: string[] = [];

    if (search && typeof search === 'string') {
      values.push(`%${String(search)}%`);
      values.push(`%${String(search)}%`);
      whereSql.push('(name ILIKE $1 OR description ILIKE $2)');
    }

    if (typeof isActive !== 'undefined') {
      values.push(typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive));
      whereSql.push(`is_active = $${values.length}`);
    }

    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM rate_types ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get rate types with pagination
    const offset = (Number(page) - 1) * Number(limit);
    // API contract: sortBy is camelCase; map to snake_case DB column.
    const sortColumnMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 'name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM rate_types
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, Number(limit), offset]
    );
    const rateTypes = listRes.rows;

    logger.info(`Retrieved ${rateTypes.length} rate types from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: rateTypes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-types/:id - Get rate type by ID
export const getRateTypeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rateTypeRes = await query(
      `SELECT id, name, description, is_active, created_at, updated_at FROM rate_types WHERE id = $1`,
      [Number(id)]
    );
    const rateType = rateTypeRes.rows[0];

    if (!rateType) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved rate type ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: rateType,
    });
  } catch (error) {
    logger.error('Error retrieving rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/rate-types - Create new rate type
export const createRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, isActive = true } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Rate type name is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if rate type name already exists
    const dupRes = await query(`SELECT 1 FROM rate_types WHERE name = $1`, [name]);
    if (dupRes.rowCount && dupRes.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Rate type name already exists',
        error: { code: 'DUPLICATE_NAME' },
      });
    }

    // Create rate type in database
    const insertRes = await query(
      `INSERT INTO rate_types (name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, description, is_active, created_at, updated_at`,
      [name, description || null, isActive]
    );
    const newRateType = insertRes.rows[0];

    logger.info(`Created new rate type: ${newRateType.id}`, {
      userId: req.user?.id,
      rateTypeName: name,
      description: description || '',
    });

    res.status(201).json({
      success: true,
      data: newRateType,
      message: 'Rate type created successfully',
    });
  } catch (error) {
    logger.error('Error creating rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-types/available-for-case - Get available rate types for case assignment
export const getAvailableRateTypesForCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, verificationTypeId } = req.query;

    // Validate required parameters
    if (!clientId || !productId || !verificationTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Product ID, and Verification Type ID are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Get rate types that are assigned to this combination and have rates
    const availableRes = await query(
      `SELECT DISTINCT
        rt.id,
        rt.name,
        rt.description,
        rt.is_active,
        r.amount,
        r.currency,
        CASE WHEN r.id IS NOT NULL THEN true ELSE false END as "has_rate"
       FROM rate_type_assignments rta
       JOIN rate_types rt ON rta.rate_type_id = rt.id
       LEFT JOIN rates r ON rta.client_id = r.client_id
         AND rta.product_id = r.product_id
         AND rta.verification_type_id = r.verification_type_id
         AND rta.rate_type_id = r.rate_type_id
         AND r.is_active = true
       WHERE rta.client_id = $1
         AND rta.product_id = $2
         AND rta.verification_type_id = $3
         AND rta.is_active = true
         AND rt.is_active = true
       ORDER BY rt.name ASC`,
      [Number(clientId), Number(productId), Number(verificationTypeId)]
    );

    const availableRateTypes = availableRes.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      amount: row.amount,
      currency: row.currency || 'INR',
      hasRate: row.hasRate,
    }));

    logger.info(`Retrieved ${availableRateTypes.length} available rate types for case assignment`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      rateTypeCount: availableRateTypes.length,
    });

    res.json({
      success: true,
      data: availableRateTypes,
      message: `Found ${availableRateTypes.length} available rate types`,
    });
  } catch (error) {
    logger.error('Error fetching available rate types for case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/rate-types/:id - Update rate type
export const updateRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body as { name?: string; description?: string; isActive?: boolean };

    // Check if rate type exists
    const existingRes = await query(`SELECT id, name FROM rate_types WHERE id = $1`, [Number(id)]);
    const existingRateType = existingRes.rows[0];

    if (!existingRateType) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for duplicate name if being updated
    if (updateData.name && updateData.name !== existingRateType.name) {
      const dupRes = await query(`SELECT 1 FROM rate_types WHERE name = $1`, [updateData.name]);
      if (dupRes.rowCount && dupRes.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Rate type name already exists',
          error: { code: 'DUPLICATE_NAME' },
        });
      }
    }

    // Prepare update data
    const updatePayload: Record<string, unknown> = {};
    if (updateData.name) {
      updatePayload.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      updatePayload.description = updateData.description;
    }
    if (updateData.isActive !== undefined) {
      updatePayload.isActive = updateData.isActive;
    }

    // Build dynamic update
    const sets: string[] = [];
    const vals: QueryParams = [];
    let idx = 1;
    for (const key of Object.keys(updatePayload)) {
      sets.push(`"${key}" = $${idx++}`);
      vals.push(updatePayload[key] as string | number | boolean | Date | number[] | string[]);
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(Number(id));

    const updRes = await query(
      `UPDATE rate_types SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, description, is_active, created_at, updated_at`,
      vals
    );
    const updatedRateType = updRes.rows[0];

    logger.info(`Updated rate type: ${id}`, {
      userId: req.user?.id,
      rateTypeId: id,
      updates: Object.keys(updatePayload),
    });

    res.json({
      success: true,
      data: updatedRateType,
      message: 'Rate type updated successfully',
    });
  } catch (error) {
    logger.error('Error updating rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/rate-types/:id - Delete rate type
export const deleteRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if rate type exists
    const existRes = await query(`SELECT id, name FROM rate_types WHERE id = $1`, [Number(id)]);
    const existingRateType = existRes.rows[0];

    if (!existingRateType) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if rate type is being used in assignments or rates
    const usageRes = await query(
      `SELECT
        (SELECT COUNT(*) FROM rate_type_assignments WHERE rate_type_id = $1) as assignments,
        (SELECT COUNT(*) FROM rates WHERE rate_type_id = $1) as rates`,
      [Number(id)]
    );
    const usage = usageRes.rows[0];

    if (Number(usage.assignments) > 0 || Number(usage.rates) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete rate type that is being used in assignments or rates',
        error: { code: 'RATE_TYPE_IN_USE' },
      });
    }

    // Delete rate type
    await query(`DELETE FROM rate_types WHERE id = $1`, [Number(id)]);

    logger.info(`Deleted rate type: ${id}`, {
      userId: req.user?.id,
      rateTypeId: id,
      rateTypeName: existingRateType.name,
    });

    res.json({
      success: true,
      message: 'Rate type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-types/stats - Get rate type statistics
export const getRateTypeStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive
      FROM rate_types
    `);
    const stats = statsRes.rows[0];

    res.json({
      success: true,
      data: stats,
      message: 'Rate type statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving rate type statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate type statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
