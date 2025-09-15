import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/config/logger';
import { query } from '@/config/database';
import type {
  CommissionRateType,
  CreateCommissionRateTypeData,
  UpdateCommissionRateTypeData,
  FieldUserCommissionAssignment,
  CreateFieldUserCommissionAssignmentData,
  UpdateFieldUserCommissionAssignmentData,
  CommissionCalculation,
  CreateCommissionCalculationData,
  UpdateCommissionCalculationData,
  CommissionPaymentBatch,
  CreateCommissionPaymentBatchData,
  UpdateCommissionPaymentBatchData,
  CommissionQuery,
  CommissionStats,
  CommissionSummary,
  BulkCommissionOperation,
  CommissionCalculationInput,
  CommissionCalculationResult
} from '@/types/commission';

// =====================================================
// COMMISSION RATE TYPES MANAGEMENT
// =====================================================

// GET /api/commission-management/rate-types - Get all commission rate types
export const getCommissionRateTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isActive, search } = req.query;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      whereConditions.push(`crt.is_active = $${paramIndex}`);
      queryParams.push(isActive === 'true');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(rt.name ILIKE $${paramIndex} OR rt.description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
        crt.id,
        crt.rate_type_id as "rateTypeId",
        crt.commission_amount as "commissionAmount",

        crt.currency,
        crt.is_active as "isActive",
        crt.created_by as "createdBy",
        crt.created_at as "createdAt",
        crt.updated_at as "updatedAt",
        rt.name as "rateTypeName"
       FROM commission_rate_types crt
       JOIN "rateTypes" rt ON crt.rate_type_id = rt.id
       ${whereClause}
       ORDER BY rt.name ASC`,
      queryParams
    );

    res.json({
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} commission rate types`,
    });
  } catch (error) {
    logger.error('Error fetching commission rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commission-management/rate-types - Create commission rate type
export const createCommissionRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rateTypeId, commissionAmount, currency = 'INR', isActive = true }: CreateCommissionRateTypeData = req.body;

    // Validate required fields
    if (!rateTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Rate type ID is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Validate that commission amount is provided
    if (!commissionAmount || commissionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission amount must be provided and greater than 0',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if rate type exists
    const rateTypeCheck = await query('SELECT id FROM "rateTypes" WHERE id = $1', [rateTypeId]);
    if (rateTypeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if commission rate type already exists for this rate type
    const existingCheck = await query('SELECT id FROM commission_rate_types WHERE rate_type_id = $1', [rateTypeId]);
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate type already exists for this rate type',
        error: { code: 'DUPLICATE_ENTRY' },
      });
    }

    // Create commission rate type
    const result = await query(
      `INSERT INTO commission_rate_types (rate_type_id, commission_amount, currency, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, rate_type_id as "rateTypeId", commission_amount as "commissionAmount",
                 currency, is_active as "isActive",
                 created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"`,
      [rateTypeId, commissionAmount, currency, isActive, req.user?.id]
    );

    const newCommissionRateType = result.rows[0];

    logger.info(`Created commission rate type: ${newCommissionRateType.id}`, {
      userId: req.user?.id,
      rateTypeId,
      commissionAmount,

    });

    res.status(201).json({
      success: true,
      data: newCommissionRateType,
      message: 'Commission rate type created successfully',
    });
  } catch (error) {
    logger.error('Error creating commission rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create commission rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/commission-management/rate-types/:id - Update commission rate type
export const updateCommissionRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { commissionAmount, currency, isActive }: UpdateCommissionRateTypeData = req.body;

    // Check if commission rate type exists
    const existingCheck = await query('SELECT id FROM commission_rate_types WHERE id = $1', [Number(id)]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commission rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Validate that either amount or percentage is provided, not both (if both are provided)
    if (commissionAmount !== undefined && commissionPercentage !== undefined) {
      if ((commissionAmount && commissionPercentage) || (!commissionAmount && !commissionPercentage)) {
        return res.status(400).json({
          success: false,
          message: 'Either commission amount or commission percentage must be provided, not both',
          error: { code: 'VALIDATION_ERROR' },
        });
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (commissionAmount !== undefined) {
      updateFields.push(`commission_amount = $${paramIndex}`);
      updateValues.push(commissionAmount);
      paramIndex++;
      // Clear percentage if amount is set
      updateFields.push(`commission_percentage = NULL`);
    }

    if (commissionPercentage !== undefined) {
      updateFields.push(`commission_percentage = $${paramIndex}`);
      updateValues.push(commissionPercentage);
      paramIndex++;
      // Clear amount if percentage is set
      updateFields.push(`commission_amount = NULL`);
    }

    if (currency !== undefined) {
      updateFields.push(`currency = $${paramIndex}`);
      updateValues.push(currency);
      paramIndex++;
    }

    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(isActive);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(Number(id));

    const result = await query(
      `UPDATE commission_rate_types 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, rate_type_id as "rateTypeId", commission_amount as "commissionAmount", 
                 commission_percentage as "commissionPercentage", currency, is_active as "isActive",
                 created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"`,
      updateValues
    );

    const updatedCommissionRateType = result.rows[0];

    logger.info(`Updated commission rate type: ${id}`, {
      userId: req.user?.id,
      commissionRateTypeId: id,
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      data: updatedCommissionRateType,
      message: 'Commission rate type updated successfully',
    });
  } catch (error) {
    logger.error('Error updating commission rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update commission rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/commission-management/rate-types/:id - Delete commission rate type
export const deleteCommissionRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if commission rate type exists
    const existingCheck = await query('SELECT id FROM commission_rate_types WHERE id = $1', [Number(id)]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commission rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if commission rate type is being used in assignments
    const usageCheck = await query(
      'SELECT COUNT(*) as count FROM field_user_commission_assignments WHERE rate_type_id = (SELECT rate_type_id FROM commission_rate_types WHERE id = $1)',
      [Number(id)]
    );

    if (Number(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete commission rate type that is being used in field user assignments',
        error: { code: 'IN_USE' },
      });
    }

    // Delete commission rate type
    await query('DELETE FROM commission_rate_types WHERE id = $1', [Number(id)]);

    logger.info(`Deleted commission rate type: ${id}`, {
      userId: req.user?.id,
      commissionRateTypeId: id
    });

    res.json({
      success: true,
      message: 'Commission rate type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting commission rate type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete commission rate type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// =====================================================
// FIELD USER COMMISSION ASSIGNMENTS MANAGEMENT
// =====================================================

// GET /api/commission-management/field-user-assignments - Get field user commission assignments
export const getFieldUserCommissionAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, rateTypeId, clientId, isActive, search } = req.query;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereConditions.push(`fuca.user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }

    if (rateTypeId) {
      whereConditions.push(`fuca.rate_type_id = $${paramIndex}`);
      queryParams.push(Number(rateTypeId));
      paramIndex++;
    }

    if (clientId) {
      whereConditions.push(`fuca.client_id = $${paramIndex}`);
      queryParams.push(Number(clientId));
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereConditions.push(`fuca.is_active = $${paramIndex}`);
      queryParams.push(isActive === 'true');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR rt.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT
        fuca.id,
        fuca.user_id as "userId",
        fuca.rate_type_id as "rateTypeId",
        fuca.commission_amount as "commissionAmount",
        fuca.commission_percentage as "commissionPercentage",
        fuca.currency,
        fuca.client_id as "clientId",
        fuca.is_active as "isActive",
        fuca.effective_from as "effectiveFrom",
        fuca.effective_to as "effectiveTo",
        fuca.created_by as "createdBy",
        fuca.created_at as "createdAt",
        fuca.updated_at as "updatedAt",
        u.name as "userName",
        u.email as "userEmail",
        rt.name as "rateTypeName",
        c.name as "clientName"
       FROM field_user_commission_assignments fuca
       JOIN users u ON fuca.user_id = u.id
       JOIN "rateTypes" rt ON fuca.rate_type_id = rt.id
       LEFT JOIN clients c ON fuca.client_id = c.id
       ${whereClause}
       ORDER BY u.name ASC, rt.name ASC, c.name ASC NULLS FIRST`,
      queryParams
    );

    res.json({
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} field user commission assignments`,
    });
  } catch (error) {
    logger.error('Error fetching field user commission assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch field user commission assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commission-management/field-user-assignments - Create field user commission assignment
export const createFieldUserCommissionAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      userId,
      rateTypeId,
      commissionAmount,
      currency = 'INR',
      clientId,
      effectiveFrom = new Date().toISOString(),
      effectiveTo
    }: CreateFieldUserCommissionAssignmentData = req.body;

    // Validate required fields
    if (!userId || !rateTypeId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Rate type ID are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Validate that either amount or percentage is provided, not both
    if ((commissionAmount && commissionPercentage) || (!commissionAmount && !commissionPercentage)) {
      return res.status(400).json({
        success: false,
        message: 'Either commission amount or commission percentage must be provided, not both',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if user exists and is a field user
    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if rate type exists
    const rateTypeCheck = await query('SELECT id FROM "rateTypes" WHERE id = $1', [rateTypeId]);
    if (rateTypeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if client exists (if provided)
    if (clientId) {
      const clientCheck = await query('SELECT id FROM clients WHERE id = $1', [clientId]);
      if (clientCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client not found',
          error: { code: 'NOT_FOUND' },
        });
      }
    }

    // Check for overlapping assignments
    const overlapCheck = await query(
      `SELECT id FROM field_user_commission_assignments
       WHERE user_id = $1 AND rate_type_id = $2 AND client_id IS NOT DISTINCT FROM $3
       AND is_active = true
       AND (effective_to IS NULL OR effective_to > $4)
       AND effective_from <= $5`,
      [userId, rateTypeId, clientId || null, effectiveFrom, effectiveTo || '9999-12-31']
    );

    if (overlapCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Overlapping commission assignment already exists for this user, rate type, and client combination',
        error: { code: 'OVERLAPPING_ASSIGNMENT' },
      });
    }

    // Create field user commission assignment
    const result = await query(
      `INSERT INTO field_user_commission_assignments
       (user_id, rate_type_id, commission_amount, commission_percentage, currency, client_id, effective_from, effective_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id as "userId", rate_type_id as "rateTypeId", commission_amount as "commissionAmount",
                 commission_percentage as "commissionPercentage", currency, client_id as "clientId", is_active as "isActive",
                 effective_from as "effectiveFrom", effective_to as "effectiveTo", created_by as "createdBy",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [userId, rateTypeId, commissionAmount || null, commissionPercentage || null, currency, clientId || null, effectiveFrom, effectiveTo || null, req.user?.id]
    );

    const newAssignment = result.rows[0];

    logger.info(`Created field user commission assignment: ${newAssignment.id}`, {
      userId: req.user?.id,
      assignmentUserId: userId,
      rateTypeId,
      clientId,
      commissionAmount,
      commissionPercentage
    });

    res.status(201).json({
      success: true,
      data: newAssignment,
      message: 'Field user commission assignment created successfully',
    });
  } catch (error) {
    logger.error('Error creating field user commission assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create field user commission assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// =====================================================
// COMMISSION CALCULATION UTILITIES
// =====================================================

// Helper function to calculate commission
export const calculateCommission = (input: CommissionCalculationInput): CommissionCalculationResult => {
  const { baseAmount, commissionAmount, commissionPercentage, calculationMethod } = input;

  if (calculationMethod === 'FIXED_AMOUNT' && commissionAmount !== undefined) {
    return {
      calculatedCommission: commissionAmount,
      calculationMethod: 'FIXED_AMOUNT',
      appliedRate: commissionAmount
    };
  } else if (calculationMethod === 'PERCENTAGE' && commissionPercentage !== undefined) {
    const calculated = (baseAmount * commissionPercentage) / 100;
    return {
      calculatedCommission: Math.round(calculated * 100) / 100, // Round to 2 decimal places
      calculationMethod: 'PERCENTAGE',
      appliedRate: commissionPercentage
    };
  } else {
    throw new Error('Invalid calculation method or missing commission data');
  }
};

// Function to automatically calculate commission when case is completed
export const calculateCommissionForCompletedCase = async (
  caseId: string,
  caseNumber: number,
  userId: string,
  clientId: number,
  rateTypeId: number,
  baseAmount: number,
  caseCompletedAt: string
): Promise<CommissionCalculation | null> => {
  try {
    // Get active commission assignment for this user, rate type, and client
    const assignmentResult = await query(
      `SELECT
        commission_amount,
        commission_percentage,
        currency
       FROM field_user_commission_assignments
       WHERE user_id = $1
       AND rate_type_id = $2
       AND (client_id = $3 OR client_id IS NULL)
       AND is_active = true
       AND effective_from <= $4
       AND (effective_to IS NULL OR effective_to > $4)
       ORDER BY client_id NULLS LAST, effective_from DESC
       LIMIT 1`,
      [userId, rateTypeId, clientId, caseCompletedAt]
    );

    if (assignmentResult.rows.length === 0) {
      logger.warn(`No commission assignment found for user ${userId}, rate type ${rateTypeId}, client ${clientId}`);
      return null;
    }

    const assignment = assignmentResult.rows[0];
    const { commission_amount, commission_percentage, currency } = assignment;

    // Determine calculation method
    const calculationMethod = commission_amount ? 'FIXED_AMOUNT' : 'PERCENTAGE';

    // Calculate commission
    const calculationResult = calculateCommission({
      baseAmount,
      commissionAmount: commission_amount,
      commissionPercentage: commission_percentage,
      calculationMethod
    });

    // Create commission calculation record
    const commissionData: CreateCommissionCalculationData = {
      caseId,
      caseNumber,
      userId,
      clientId,
      rateTypeId,
      baseAmount,
      commissionAmount: commission_amount,
      commissionPercentage: commission_percentage,
      calculatedCommission: calculationResult.calculatedCommission,
      currency: currency || 'INR',
      calculationMethod,
      caseCompletedAt,
      notes: `Auto-calculated commission for completed case ${caseNumber}`
    };

    // Insert commission calculation
    const result = await query(
      `INSERT INTO commission_calculations
       (case_id, case_number, user_id, client_id, rate_type_id, base_amount, commission_amount,
        commission_percentage, calculated_commission, currency, calculation_method, case_completed_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, case_id as "caseId", case_number as "caseNumber", user_id as "userId",
                 client_id as "clientId", rate_type_id as "rateTypeId", base_amount as "baseAmount",
                 commission_amount as "commissionAmount", commission_percentage as "commissionPercentage",
                 calculated_commission as "calculatedCommission", currency, calculation_method as "calculationMethod",
                 status, case_completed_at as "caseCompletedAt", notes, created_at as "createdAt", updated_at as "updatedAt"`,
      [
        caseId, caseNumber, userId, clientId, rateTypeId, baseAmount,
        commission_amount || null, commission_percentage || null,
        calculationResult.calculatedCommission, currency || 'INR', calculationMethod,
        caseCompletedAt, commissionData.notes
      ]
    );

    const newCommission = result.rows[0];

    logger.info(`Auto-calculated commission for completed case: ${caseId}`, {
      commissionId: newCommission.id,
      userId,
      caseNumber,
      baseAmount,
      calculatedCommission: calculationResult.calculatedCommission,
      calculationMethod
    });

    return newCommission;
  } catch (error) {
    logger.error('Error calculating commission for completed case:', error);
    throw error;
  }
};

// GET /api/commission-management/calculations - Get commission calculations
export const getCommissionCalculations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      userId,
      clientId,
      rateTypeId,
      status,
      dateFrom,
      dateTo,
      search,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    }: CommissionQuery = req.query;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereConditions.push(`cc.user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }

    if (clientId) {
      whereConditions.push(`cc.client_id = $${paramIndex}`);
      queryParams.push(Number(clientId));
      paramIndex++;
    }

    if (rateTypeId) {
      whereConditions.push(`cc.rate_type_id = $${paramIndex}`);
      queryParams.push(Number(rateTypeId));
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`cc.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (dateFrom) {
      whereConditions.push(`cc.case_completed_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`cc.case_completed_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR rt.name ILIKE $${paramIndex} OR cc.case_number::text ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate sort parameters
    const validSortFields = ['createdAt', 'caseCompletedAt', 'calculatedCommission', 'status'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const result = await query(
      `SELECT
        cc.id,
        cc.case_id as "caseId",
        cc.case_number as "caseNumber",
        cc.user_id as "userId",
        cc.client_id as "clientId",
        cc.rate_type_id as "rateTypeId",
        cc.base_amount as "baseAmount",
        cc.commission_amount as "commissionAmount",
        cc.commission_percentage as "commissionPercentage",
        cc.calculated_commission as "calculatedCommission",
        cc.currency,
        cc.calculation_method as "calculationMethod",
        cc.status,
        cc.case_completed_at as "caseCompletedAt",
        cc.approved_by as "approvedBy",
        cc.approved_at as "approvedAt",
        cc.paid_by as "paidBy",
        cc.paid_at as "paidAt",
        cc.payment_method as "paymentMethod",
        cc.transaction_id as "transactionId",
        cc.rejection_reason as "rejectionReason",
        cc.notes,
        cc.created_at as "createdAt",
        cc.updated_at as "updatedAt",
        u.name as "userName",
        u.email as "userEmail",
        c.name as "clientName",
        rt.name as "rateTypeName",
        approver.name as "approvedByName",
        payer.name as "paidByName"
       FROM commission_calculations cc
       JOIN users u ON cc.user_id = u.id
       JOIN clients c ON cc.client_id = c.id
       JOIN "rateTypes" rt ON cc.rate_type_id = rt.id
       LEFT JOIN users approver ON cc.approved_by = approver.id
       LEFT JOIN users payer ON cc.paid_by = payer.id
       ${whereClause}
       ORDER BY cc.${safeSortBy === 'createdAt' ? 'created_at' :
                     safeSortBy === 'caseCompletedAt' ? 'case_completed_at' :
                     safeSortBy === 'calculatedCommission' ? 'calculated_commission' : 'status'} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), Number(offset)]
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM commission_calculations cc
       JOIN users u ON cc.user_id = u.id
       JOIN clients c ON cc.client_id = c.id
       JOIN "rateTypes" rt ON cc.rate_type_id = rt.id
       ${whereClause}`,
      queryParams
    );

    const total = Number(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        pages: Math.ceil(total / Number(limit))
      },
      message: `Found ${result.rows.length} commission calculations`,
    });
  } catch (error) {
    logger.error('Error fetching commission calculations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission calculations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
