import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';

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
      isActive,
    } = req.query;

    // Build where clause
    const values: QueryParams = [];
    const whereSql: string[] = [];

    if (clientId) {
      values.push(clientId as string);
      whereSql.push(`client_id = $${values.length}`);
    }

    if (productId) {
      values.push(productId as string);
      whereSql.push(`product_id = $${values.length}`);
    }

    if (verificationTypeId) {
      values.push(verificationTypeId as string);
      whereSql.push(`verification_type_id = $${values.length}`);
    }

    if (rateTypeId) {
      values.push(rateTypeId as string);
      whereSql.push(`rate_type_id = $${values.length}`);
    }

    if (typeof isActive !== 'undefined') {
      values.push(typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive));
      whereSql.push(`rta.is_active = $${values.length}`);
    }

    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM rate_type_assignment_view rta ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get assignments with pagination
    const offset = (Number(page) - 1) * Number(limit);

    const listRes = await query(
      `SELECT * FROM rate_type_assignment_view rta
       ${whereClause}
       ORDER BY client_name, product_name, verification_type_name, rate_type_name
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, Number(limit), offset]
    );
    const assignments = listRes.rows;

    logger.info(`Retrieved ${assignments.length} rate type assignments from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
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
        rt.id as rate_type_id,
        rt.name as rate_type_name,
        rt.description as "rateTypeDescription",
        CASE WHEN rta.id IS NOT NULL THEN true ELSE false END as "isAssigned",
        rta.id as assignment_id,
        rta.is_active as "assignmentActive"
       FROM rate_types rt
       LEFT JOIN rate_type_assignments rta ON rt.id = rta.rate_type_id 
         AND rta.client_id = $1 
         AND rta.product_id = $2 
         AND rta.verification_type_id = $3
       WHERE rt.is_active = true
       ORDER BY rt.name`,
      [Number(clientId), Number(productId), Number(verificationTypeId)]
    );
    const assignments = assignmentsRes.rows;

    logger.info(`Retrieved rate type assignments for combination`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      assignmentCount: assignments.length,
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
        message:
          'Client ID, Product ID, Verification Type ID, and Rate Type IDs array are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    await withTransaction(async client => {
      // First, remove all existing assignments for this combination
      await client.query(
        `DELETE FROM rate_type_assignments 
         WHERE client_id = $1 AND product_id = $2 AND verification_type_id = $3`,
        [clientId, productId, verificationTypeId]
      );

      // Then, add new assignments
      if (rateTypeIds.length > 0) {
        const values: string[] = [];
        const params: QueryParams = [];
        let paramIndex = 1;

        for (const rateTypeId of rateTypeIds) {
          values.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          );
          params.push(clientId, productId, verificationTypeId, rateTypeId);
          paramIndex += 4;
        }

        await client.query(
          `INSERT INTO rate_type_assignments (client_id, product_id, verification_type_id, rate_type_id, is_active, created_at, updated_at)
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
      rateTypeCount: rateTypeIds.length,
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
      `SELECT id FROM rate_type_assignments 
       WHERE client_id = $1 AND product_id = $2 AND verification_type_id = $3 AND rate_type_id = $4`,
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
      `INSERT INTO rate_type_assignments (client_id, product_id, verification_type_id, rate_type_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, client_id, product_id, verification_type_id, rate_type_id, is_active, created_at, updated_at`,
      [clientId, productId, verificationTypeId, rateTypeId, isActive]
    );
    const newAssignment = insertRes.rows[0];

    logger.info(`Created rate type assignment: ${newAssignment.id}`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      rateTypeId,
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
    const existRes = await query(`SELECT id FROM rate_type_assignments WHERE id = $1`, [
      Number(id),
    ]);
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
       JOIN rate_type_assignments rta ON r.client_id = rta.client_id 
         AND r.product_id = rta.product_id 
         AND r.verification_type_id = rta.verification_type_id 
         AND r.rate_type_id = rta.rate_type_id
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
    await query(`DELETE FROM rate_type_assignments WHERE id = $1`, [Number(id)]);

    logger.info(`Deleted rate type assignment: ${id}`, {
      userId: req.user?.id,
      assignmentId: id,
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
