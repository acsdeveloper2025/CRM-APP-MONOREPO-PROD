import { Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';

// GET /api/rate-type-assignments - List rate type assignments with filters
export const getRateTypeAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      clientId,
      productId,
      verificationTypeId,
      rateTypeId,
      isActive
    } = req.query;

    // Build where clause
    const values: any[] = [];
    const whereSql: string[] = [];
    
    if (clientId) {
      values.push(clientId);
      whereSql.push(`"clientId" = $${values.length}`);
    }
    
    if (productId) {
      values.push(productId);
      whereSql.push(`"productId" = $${values.length}`);
    }
    
    if (verificationTypeId) {
      values.push(verificationTypeId);
      whereSql.push(`"verificationTypeId" = $${values.length}`);
    }
    
    if (rateTypeId) {
      values.push(rateTypeId);
      whereSql.push(`"rateTypeId" = $${values.length}`);
    }
    
    if (typeof isActive !== 'undefined') {
      values.push(String(isActive) === 'true');
      whereSql.push(`rta."isActive" = $${values.length}`);
    }
    
    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM "rateTypeAssignmentView" rta ${whereClause}`, 
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get assignments with pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    const listRes = await query(
      `SELECT * FROM "rateTypeAssignmentView" rta
       ${whereClause}
       ORDER BY "clientName", "productName", "verificationTypeName", "rateTypeName"
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, Number(limit), offset]
    );
    const assignments = listRes.rows;

    logger.info(`Retrieved ${assignments.length} rate type assignments from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      total: totalCount
    });

    res.json({
      success: true,
      data: assignments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving rate type assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate type assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/rate-type-assignments/by-combination - Get assignments for specific client-product-verification type combination
export const getAssignmentsByCombination = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, verificationTypeId } = req.query;

    if (!clientId || !productId || !verificationTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Product ID, and Verification Type ID are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Get all rate types and their assignment status for this combination
    const assignmentsRes = await query(
      `SELECT 
        rt.id as "rateTypeId",
        rt.name as "rateTypeName",
        rt.description as "rateTypeDescription",
        CASE WHEN rta.id IS NOT NULL THEN true ELSE false END as "isAssigned",
        rta.id as "assignmentId",
        rta."isActive" as "assignmentActive"
       FROM "rateTypes" rt
       LEFT JOIN "rateTypeAssignments" rta ON rt.id = rta."rateTypeId" 
         AND rta."clientId" = $1 
         AND rta."productId" = $2 
         AND rta."verificationTypeId" = $3
       WHERE rt."isActive" = true
       ORDER BY rt.name`,
      [clientId, productId, verificationTypeId]
    );
    const assignments = assignmentsRes.rows;

    logger.info(`Retrieved rate type assignments for combination`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      assignmentCount: assignments.length
    });

    res.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    logger.error('Error retrieving assignments by combination:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/rate-type-assignments/bulk-assign - Bulk assign/unassign rate types to combination
export const bulkAssignRateTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, verificationTypeId, rateTypeIds } = req.body;

    if (!clientId || !productId || !verificationTypeId || !Array.isArray(rateTypeIds)) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Product ID, Verification Type ID, and Rate Type IDs array are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    await withTransaction(async (client) => {
      // First, remove all existing assignments for this combination
      await client.query(
        `DELETE FROM "rateTypeAssignments" 
         WHERE "clientId" = $1 AND "productId" = $2 AND "verificationTypeId" = $3`,
        [clientId, productId, verificationTypeId]
      );

      // Then, add new assignments
      if (rateTypeIds.length > 0) {
        const values: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        for (const rateTypeId of rateTypeIds) {
          values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
          params.push(clientId, productId, verificationTypeId, rateTypeId);
          paramIndex += 4;
        }

        await client.query(
          `INSERT INTO "rateTypeAssignments" ("clientId", "productId", "verificationTypeId", "rateTypeId", "isActive", "createdAt", "updatedAt")
           VALUES ${values.join(', ')}`,
          params
        );
      }
    });

    logger.info(`Bulk assigned rate types for combination`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      rateTypeCount: rateTypeIds.length
    });

    res.json({
      success: true,
      message: 'Rate types assigned successfully',
    });
  } catch (error) {
    logger.error('Error bulk assigning rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/rate-type-assignments - Create single rate type assignment
export const createRateTypeAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, verificationTypeId, rateTypeId, isActive = true } = req.body;

    // Validate required fields
    if (!clientId || !productId || !verificationTypeId || !rateTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Product ID, Verification Type ID, and Rate Type ID are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if assignment already exists
    const existingRes = await query(
      `SELECT id FROM "rateTypeAssignments" 
       WHERE "clientId" = $1 AND "productId" = $2 AND "verificationTypeId" = $3 AND "rateTypeId" = $4`,
      [clientId, productId, verificationTypeId, rateTypeId]
    );

    if (existingRes.rowCount && existingRes.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Rate type assignment already exists for this combination',
        error: { code: 'DUPLICATE_ASSIGNMENT' },
      });
    }

    // Create assignment
    const insertRes = await query(
      `INSERT INTO "rateTypeAssignments" ("clientId", "productId", "verificationTypeId", "rateTypeId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, "clientId", "productId", "verificationTypeId", "rateTypeId", "isActive", "createdAt", "updatedAt"`,
      [clientId, productId, verificationTypeId, rateTypeId, isActive]
    );
    const newAssignment = insertRes.rows[0];

    logger.info(`Created rate type assignment: ${newAssignment.id}`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      rateTypeId
    });

    res.status(201).json({
      success: true,
      data: newAssignment,
      message: 'Rate type assignment created successfully',
    });
  } catch (error) {
    logger.error('Error creating rate type assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rate type assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/rate-type-assignments/:id - Delete rate type assignment
export const deleteRateTypeAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if assignment exists
    const existRes = await query(`SELECT id FROM "rateTypeAssignments" WHERE id = $1`, [Number(id)]);
    if (!existRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Rate type assignment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if assignment is being used in rates
    const usageRes = await query(
      `SELECT COUNT(*) as count FROM rates r
       JOIN "rateTypeAssignments" rta ON r."clientId" = rta."clientId" 
         AND r."productId" = rta."productId" 
         AND r."verificationTypeId" = rta."verificationTypeId" 
         AND r."rateTypeId" = rta."rateTypeId"
       WHERE rta.id = $1`,
      [Number(id)]
    );
    const usage = usageRes.rows[0];

    if (Number(usage.count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete rate type assignment that has associated rates',
        error: { code: 'ASSIGNMENT_IN_USE' },
      });
    }

    // Delete assignment
    await query(`DELETE FROM "rateTypeAssignments" WHERE id = $1`, [Number(id)]);

    logger.info(`Deleted rate type assignment: ${id}`, {
      userId: req.user?.id,
      assignmentId: id
    });

    res.json({
      success: true,
      message: 'Rate type assignment deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting rate type assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rate type assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
