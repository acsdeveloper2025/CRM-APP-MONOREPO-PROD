import { Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';

// GET /api/rates - List rates with comprehensive filtering and pagination
export const getRates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      clientId,
      productId,
      verificationTypeId,
      rateTypeId,
      isActive,
      search,
      sortBy = 'clientName',
      sortOrder = 'asc'
    } = req.query;

    // Build where clause
    const values: any[] = [];
    const whereSql: string[] = [];
    
    if (clientId) {
      values.push(Number(clientId));
      whereSql.push(`"clientId" = $${values.length}`);
    }

    if (productId) {
      values.push(Number(productId));
      whereSql.push(`"productId" = $${values.length}`);
    }

    if (verificationTypeId) {
      values.push(Number(verificationTypeId));
      whereSql.push(`"verificationTypeId" = $${values.length}`);
    }

    if (rateTypeId) {
      values.push(Number(rateTypeId));
      whereSql.push(`"rateTypeId" = $${values.length}`);
    }
    
    if (typeof isActive !== 'undefined') {
      values.push(String(isActive) === 'true');
      whereSql.push(`"isActive" = $${values.length}`);
    }
    
    if (search) {
      values.push(`%${String(search)}%`);
      values.push(`%${String(search)}%`);
      values.push(`%${String(search)}%`);
      values.push(`%${String(search)}%`);
      whereSql.push(`("clientName" ILIKE $${values.length - 3} OR "productName" ILIKE $${values.length - 2} OR "verificationTypeName" ILIKE $${values.length - 1} OR "rateTypeName" ILIKE $${values.length})`);
    }
    
    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM "rateManagementView" ${whereClause}`, 
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get rates with pagination
    const offset = (Number(page) - 1) * Number(limit);
    const allowedSortColumns = ['clientName', 'productName', 'verificationTypeName', 'rateTypeName', 'amount', 'createdAt', 'updatedAt'];
    const sortCol = allowedSortColumns.includes(String(sortBy)) ? String(sortBy) : 'clientName';
    const sortDir = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    const listRes = await query(
      `SELECT * FROM "rateManagementView"
       ${whereClause}
       ORDER BY "${sortCol}" ${sortDir}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, Number(limit), offset]
    );
    const rates = listRes.rows;

    logger.info(`Retrieved ${rates.length} rates from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
      total: totalCount
    });

    res.json({
      success: true,
      data: rates,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rates',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rates/available-for-assignment - Get available rate types for a specific combination
export const getAvailableRateTypesForAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, verificationTypeId } = req.query;

    if (!clientId || !productId || !verificationTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Product ID, and Verification Type ID are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Get rate types that are assigned to this combination but don't have rates yet
    const availableRes = await query(
      `SELECT 
        rt.id as "rateTypeId",
        rt.name as "rateTypeName",
        rt.description as "rateTypeDescription",
        CASE WHEN r.id IS NOT NULL THEN r.amount ELSE NULL END as "currentAmount",
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
       ORDER BY rt.name`,
      [Number(clientId), Number(productId), Number(verificationTypeId)]
    );
    const availableRateTypes = availableRes.rows;

    logger.info(`Retrieved available rate types for assignment`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      availableCount: availableRateTypes.length
    });

    res.json({
      success: true,
      data: availableRateTypes,
    });
  } catch (error) {
    logger.error('Error retrieving available rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/rates - Create or update rate
export const createOrUpdateRate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, verificationTypeId, rateTypeId, amount, currency = 'INR' } = req.body;

    // Validate required fields
    if (!clientId || !productId || !verificationTypeId || !rateTypeId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Product ID, Verification Type ID, Rate Type ID, and amount are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Validate amount
    if (Number(amount) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be non-negative',
        error: { code: 'INVALID_AMOUNT' },
      });
    }

    // Check if rate type is assigned to this combination
    const assignmentRes = await query(
      `SELECT id FROM "rateTypeAssignments"
       WHERE "clientId" = $1 AND "productId" = $2 AND "verificationTypeId" = $3 AND "rateTypeId" = $4 AND "isActive" = true`,
      [Number(clientId), Number(productId), Number(verificationTypeId), Number(rateTypeId)]
    );

    if (!assignmentRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Rate type is not assigned to this client-product-verification type combination',
        error: { code: 'RATE_TYPE_NOT_ASSIGNED' },
      });
    }

    await withTransaction(async (client) => {
      // Check if active rate already exists
      const existingRes = await client.query(
        `SELECT id, amount FROM rates
         WHERE "clientId" = $1 AND "productId" = $2 AND "verificationTypeId" = $3 AND "rateTypeId" = $4 AND "isActive" = true`,
        [Number(clientId), Number(productId), Number(verificationTypeId), Number(rateTypeId)]
      );

      if (existingRes.rows[0]) {
        // Update existing rate
        const existingRate = existingRes.rows[0];
        await client.query(
          `UPDATE rates 
           SET amount = $1, currency = $2, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [amount, currency, existingRate.id]
        );

        logger.info(`Updated existing rate: ${existingRate.id}`, {
          userId: req.user?.id,
          rateId: existingRate.id,
          oldAmount: existingRate.amount,
          newAmount: amount
        });
      } else {
        // Create new rate
        const insertRes = await client.query(
          `INSERT INTO rates ("clientId", "productId", "verificationTypeId", "rateTypeId", amount, currency, "createdBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [Number(clientId), Number(productId), Number(verificationTypeId), Number(rateTypeId), amount, currency, req.user?.id]
        );
        const newRate = insertRes.rows[0];

        logger.info(`Created new rate: ${newRate.id}`, {
          userId: req.user?.id,
          rateId: newRate.id,
          amount,
          clientId,
          productId,
          verificationTypeId,
          rateTypeId
        });
      }
    });

    res.json({
      success: true,
      message: 'Rate saved successfully',
    });
  } catch (error) {
    logger.error('Error creating/updating rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save rate',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/rates/:id - Delete rate
export const deleteRate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if rate exists
    const existRes = await query(`SELECT id FROM rates WHERE id = $1`, [Number(id)]);
    if (!existRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Delete rate (this will also trigger the history entry via trigger)
    await query(`DELETE FROM rates WHERE id = $1`, [Number(id)]);

    logger.info(`Deleted rate: ${id}`, {
      userId: req.user?.id,
      rateId: id
    });

    res.json({
      success: true,
      message: 'Rate deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rate',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rates/stats - Get rate statistics
export const getRateStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN "isActive" = true THEN 1 END)::int as active,
        COUNT(CASE WHEN "isActive" = false THEN 1 END)::int as inactive,
        AVG(amount)::numeric(10,2) as averageAmount,
        MIN(amount)::numeric(10,2) as minAmount,
        MAX(amount)::numeric(10,2) as maxAmount
      FROM rates
    `);
    const stats = statsRes.rows[0];

    res.json({
      success: true,
      data: stats,
      message: 'Rate statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving rate statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
