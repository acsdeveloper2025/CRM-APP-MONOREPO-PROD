import { Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';

// GET /api/rate-types - List rate types with pagination and filters
export const getRateTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      sortBy = 'name', 
      sortOrder = 'asc',
      isActive
    } = req.query;

    // Build where clause
    const values: any[] = [];
    const whereSql: string[] = [];
    
    if (search) {
      values.push(`%${String(search)}%`);
      values.push(`%${String(search)}%`);
      whereSql.push('(name ILIKE $1 OR description ILIKE $2)');
    }
    
    if (typeof isActive !== 'undefined') {
      values.push(String(isActive) === 'true');
      whereSql.push(`"isActive" = $${values.length}`);
    }
    
    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "rateTypes" ${whereClause}`, values);
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get rate types with pagination
    const offset = (Number(page) - 1) * Number(limit);
    const sortCol = ['name', 'description', 'isActive', 'createdAt', 'updatedAt'].includes(String(sortBy)) ? String(sortBy) : 'name';
    const sortDir = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    const listRes = await query(
      `SELECT id, name, description, "isActive", "createdAt", "updatedAt"
       FROM "rateTypes"
       ${whereClause}
       ORDER BY "${sortCol}" ${sortDir}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, Number(limit), offset]
    );
    const rateTypes = listRes.rows;

    logger.info(`Retrieved ${rateTypes.length} rate types from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
      total: totalCount
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
      `SELECT id, name, description, "isActive", "createdAt", "updatedAt" FROM "rateTypes" WHERE id = $1`,
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
    const dupRes = await query(`SELECT 1 FROM rateTypes WHERE name = $1`, [name]);
    if (dupRes.rowCount && dupRes.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Rate type name already exists',
        error: { code: 'DUPLICATE_NAME' },
      });
    }

    // Create rate type in database
    const insertRes = await query(
      `INSERT INTO "rateTypes" (name, description, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, description, "isActive", "createdAt", "updatedAt"`,
      [name, description || null, isActive]
    );
    const newRateType = insertRes.rows[0];

    logger.info(`Created new rate type: ${newRateType.id}`, { 
      userId: req.user?.id,
      rateTypeName: name,
      description: description || ''
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
        rt."isActive",
        r.amount,
        r.currency,
        CASE WHEN r.id IS NOT NULL THEN true ELSE false END as "hasRate"
       FROM "rateTypeAssignments" rta
       JOIN "rateTypes" rt ON rta."rateTypeId" = rt.id
       LEFT JOIN rates r ON rta."clientId" = r."clientId"
         AND rta."productId" = r."productId"
         AND rta."verificationTypeId" = r."verificationTypeId"
         AND rta."rateTypeId" = r."rateTypeId"
         AND r."isActive" = true
       WHERE rta."clientId" = $1
         AND rta."productId" = $2
         AND rta."verificationTypeId" = $3
         AND rta."isActive" = true
         AND rt."isActive" = true
       ORDER BY rt.name ASC`,
      [Number(clientId), Number(productId), Number(verificationTypeId)]
    );

    const availableRateTypes = availableRes.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      amount: row.amount,
      currency: row.currency || 'INR',
      hasRate: row.hasRate,
    }));

    logger.info(`Retrieved ${availableRateTypes.length} available rate types for case assignment`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      rateTypeCount: availableRateTypes.length
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
    const existingRes = await query(`SELECT id, name FROM "rateTypes" WHERE id = $1`, [Number(id)]);
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
      const dupRes = await query(`SELECT 1 FROM "rateTypes" WHERE name = $1`, [updateData.name]);
      if (dupRes.rowCount && dupRes.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Rate type name already exists',
          error: { code: 'DUPLICATE_NAME' },
        });
      }
    }

    // Prepare update data
    const updatePayload: any = {};
    if (updateData.name) updatePayload.name = updateData.name;
    if (updateData.description !== undefined) updatePayload.description = updateData.description;
    if (updateData.isActive !== undefined) updatePayload.isActive = updateData.isActive;

    // Build dynamic update
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const key of Object.keys(updatePayload)) {
      sets.push(`"${key}" = $${idx++}`);
      vals.push((updatePayload as any)[key]);
    }
    sets.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    vals.push(Number(id));

    const updRes = await query(
      `UPDATE "rateTypes" SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, description, "isActive", "createdAt", "updatedAt"`,
      vals
    );
    const updatedRateType = updRes.rows[0];

    logger.info(`Updated rate type: ${id}`, {
      userId: req.user?.id,
      rateTypeId: id,
      updates: Object.keys(updatePayload)
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
    const existRes = await query(`SELECT id, name FROM "rateTypes" WHERE id = $1`, [Number(id)]);
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
        (SELECT COUNT(*) FROM "rateTypeAssignments" WHERE "rateTypeId" = $1) as assignments,
        (SELECT COUNT(*) FROM rates WHERE "rateTypeId" = $1) as rates`,
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
    await query(`DELETE FROM "rateTypes" WHERE id = $1`, [Number(id)]);

    logger.info(`Deleted rate type: ${id}`, { 
      userId: req.user?.id,
      rateTypeId: id,
      rateTypeName: existingRateType.name
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
        COUNT(CASE WHEN "isActive" = true THEN 1 END)::int as active,
        COUNT(CASE WHEN "isActive" = false THEN 1 END)::int as inactive
      FROM "rateTypes"
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
