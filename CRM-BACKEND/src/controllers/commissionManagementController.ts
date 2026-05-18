import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth';
import { query } from '../config/database';
import ExcelJS from 'exceljs';
import { logger } from '../utils/logger';
import type {
  CommissionRateType,
  CreateCommissionRateTypeData,
  UpdateCommissionRateTypeData,
  CreateFieldUserCommissionAssignmentData,
} from '../types/commission';
import type { QueryParams } from '../types/database';
import { isExecutionEligibleUser, loadUserCapabilityProfile } from '../security/userCapabilities';
import { requireControllerPermission } from '@/security/controllerAuthorization';
import { createAuditLog } from '../utils/auditLogger';
import {
  appendOperationalScopeConditions,
  resolveDataScope,
  valueAllowedByScope,
} from '@/security/dataScope';

// =====================================================
// COMMISSION RATE TYPES MANAGEMENT
// =====================================================

export const getCommissionRateTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.download')) {
      return;
    }
    const { isActive, search } = req.query;

    let whereClause = '';
    const queryParams: QueryParams = [];
    let paramIndex = 1;

    const conditions: string[] = [];

    if (isActive !== undefined) {
      conditions.push(`crt.is_active = $${paramIndex}`);
      queryParams.push(isActive === 'true');
      paramIndex++;
    }

    if (search && typeof search === 'string') {
      conditions.push(`(rt.name ILIKE $${paramIndex} OR rt.description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(
      `SELECT 
        crt.id,
        crt.rate_type_id as rate_type_id,
        crt.commission_amount as "commissionAmount",
        crt.currency,
        crt.is_active as is_active,
        crt.created_by as created_by,
        crt.created_at as created_at,
        crt.updated_at as updated_at,
        rt.name as rate_type_name
       FROM commission_rate_types crt
       LEFT JOIN rate_types rt ON crt.rate_type_id = rt.id
       ${whereClause}
       ORDER BY crt.created_at DESC`,
      queryParams
    );

    const commissionRateTypes: CommissionRateType[] = result.rows;

    logger.info(`Retrieved ${commissionRateTypes.length} commission rate types`, {
      userId: req.user?.id,
      isActive,
      search,
    });

    res.json({
      success: true,
      data: commissionRateTypes,
      message: `Found ${commissionRateTypes.length} commission rate types`,
    });
  } catch (error) {
    logger.error('Error retrieving commission rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve commission rate types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const createCommissionRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.approve')) {
      return;
    }
    const {
      rateTypeId,
      commissionAmount,
      currency = 'INR',
      isActive = true,
    }: CreateCommissionRateTypeData = req.body;

    // Validate that commission amount is provided
    if (!commissionAmount || commissionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission amount must be provided and greater than 0',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if rate type exists
    const rateTypeCheck = await query('SELECT id FROM rate_types WHERE id = $1', [rateTypeId]);
    if (rateTypeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if commission rate type already exists for this rate type
    const existingCheck = await query(
      'SELECT id FROM commission_rate_types WHERE rate_type_id = $1',
      [rateTypeId]
    );
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
       RETURNING id, rate_type_id as rate_type_id, commission_amount as "commission_amount", 
                 currency, is_active as is_active,
                 created_by as created_by, created_at as created_at, updated_at as updated_at`,
      [rateTypeId, commissionAmount, currency, isActive, req.user?.id]
    );

    const newCommissionRateType = result.rows[0];

    logger.info(`Created commission rate type: ${newCommissionRateType.id}`, {
      userId: req.user?.id,
      rateTypeId,
      commissionAmount,
    });

    // T0-8 (audit 2026-05-17): RBI money-path audit trail.
    void createAuditLog({
      action: 'COMMISSION_RATE_TYPE_CREATED',
      entityType: 'COMMISSION_RATE_TYPE',
      entityId: String(newCommissionRateType.id),
      userId: req.user?.id,
      details: { rateTypeId, commissionAmount, currency, isActive },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
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

export const updateCommissionRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.approve')) {
      return;
    }
    const { id } = req.params;
    const { commissionAmount, currency, isActive }: UpdateCommissionRateTypeData = req.body;

    // Check if commission rate type exists
    const existingCheck = await query('SELECT id FROM commission_rate_types WHERE id = $1', [
      Number(id),
    ]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commission rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: QueryParams = [];
    let paramIndex = 1;

    if (commissionAmount !== undefined) {
      if (commissionAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Commission amount must be greater than 0',
          error: { code: 'VALIDATION_ERROR' },
        });
      }
      updateFields.push(`commission_amount = $${paramIndex}`);
      updateValues.push(commissionAmount);
      paramIndex++;
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

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(Number(id));

    const result = await query(
      `UPDATE commission_rate_types 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, rate_type_id as rate_type_id, commission_amount as "commissionAmount", 
                 currency, is_active as is_active,
                 created_by as created_by, created_at as created_at, updated_at as updated_at`,
      updateValues
    );

    const updatedCommissionRateType = result.rows[0];

    logger.info(`Updated commission rate type: ${id}`, {
      userId: req.user?.id,
      commissionAmount,
      currency,
      isActive,
    });

    // T0-8 (audit 2026-05-17): RBI money-path audit trail.
    void createAuditLog({
      action: 'COMMISSION_RATE_TYPE_UPDATED',
      entityType: 'COMMISSION_RATE_TYPE',
      entityId: String(id),
      userId: req.user?.id,
      details: {
        changedFields: {
          commissionAmount: commissionAmount !== undefined ? commissionAmount : null,
          currency: currency !== undefined ? currency : null,
          isActive: isActive !== undefined ? isActive : null,
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
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

export const deleteCommissionRateType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.approve')) {
      return;
    }
    const { id } = req.params;

    // T0-8 (audit 2026-05-17): capture row BEFORE delete so the audit
    // log shows what was lost (commission_amount, rate_type_id, etc.).
    const existingCheck = await query<{
      id: number;
      rate_type_id: number;
      commission_amount: string;
      currency: string;
      is_active: boolean;
    }>(
      'SELECT id, rate_type_id, commission_amount, currency, is_active FROM commission_rate_types WHERE id = $1',
      [Number(id)]
    );
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commission rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    const priorRow = existingCheck.rows[0];

    // Check if there are any active assignments using this commission rate type
    const assignmentCheck = await query(
      'SELECT id FROM field_user_commission_assignments WHERE rate_type_id = (SELECT rate_type_id FROM commission_rate_types WHERE id = $1) AND is_active = true',
      [Number(id)]
    );

    if (assignmentCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete commission rate type with active assignments',
        error: { code: 'CONSTRAINT_VIOLATION' },
      });
    }

    await query('DELETE FROM commission_rate_types WHERE id = $1', [Number(id)]);

    logger.info(`Deleted commission rate type: ${id}`, {
      userId: req.user?.id,
    });

    // T0-8 (audit 2026-05-17): RBI money-path audit trail. Delete is the
    // MOST important to audit — without this, a removed high-value rate
    // would have zero trail.
    void createAuditLog({
      action: 'COMMISSION_RATE_TYPE_DELETED',
      entityType: 'COMMISSION_RATE_TYPE',
      entityId: String(id),
      userId: req.user?.id,
      details: {
        priorRow: {
          rateTypeId: priorRow.rate_type_id,
          commissionAmount: priorRow.commission_amount,
          currency: priorRow.currency,
          isActive: priorRow.is_active,
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
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
// FIELD USER COMMISSION ASSIGNMENTS
// =====================================================

export const getFieldUserCommissionAssignments = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.download')) {
      return;
    }
    const scope = await resolveDataScope(req as never);
    const { userId, rateTypeId, clientId, isActive, page = 1, limit = 20 } = req.query;

    let whereClause = '';
    const queryParams: QueryParams = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} fuca.user_id = $${paramCount}`;
      queryParams.push(userId as string);
    }

    if (rateTypeId) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} fuca.rate_type_id = $${paramCount}`;
      queryParams.push(Number(rateTypeId));
    }

    if (clientId) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} fuca.client_id = $${paramCount}`;
      queryParams.push(Number(clientId));
    }

    if (isActive !== undefined) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} fuca.is_active = $${paramCount}`;
      queryParams.push(isActive === 'true');
    }

    const scopeConditions: string[] = whereClause ? [whereClause] : [];
    appendOperationalScopeConditions({
      scope,
      conditions: scopeConditions,
      params: queryParams as unknown as Array<string | number | boolean | string[] | number[]>,
      userExpr: 'fuca.user_id',
      clientExpr: 'fuca.client_id',
    });
    whereClause = scopeConditions.join(' AND ');
    paramCount = queryParams.length;

    const offset = (Number(page) - 1) * Number(limit);
    paramCount++;
    queryParams.push(Number(limit));
    paramCount++;
    queryParams.push(offset);

    const assignmentsQuery = `
      SELECT
        fuca.*,
        u.name as user_name,
        u.email as user_email,
        rt.name as rate_type_name,
        c.name as client_name
      FROM field_user_commission_assignments fuca
      LEFT JOIN users u ON fuca.user_id = u.id
      LEFT JOIN rate_types rt ON fuca.rate_type_id = rt.id
      LEFT JOIN clients c ON fuca.client_id = c.id
      ${whereClause ? `WHERE ${whereClause}` : ''}
      ORDER BY fuca.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const assignments = await query(assignmentsQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM field_user_commission_assignments fuca
      ${whereClause ? `WHERE ${whereClause}` : ''}
    `;
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const totalResult = await query(countQuery, countParams);
    const total = parseInt(totalResult.rows[0].total);

    logger.info('Retrieved field user commission assignments', {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      total,
      filters: { userId, rateTypeId, clientId, isActive },
    });

    res.json({
      success: true,
      data: assignments.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving field user commission assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve field user commission assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const createFieldUserCommissionAssignment = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.approve')) {
      return;
    }
    const scope = await resolveDataScope(req as never);
    const {
      userId,
      rateTypeId,
      commissionAmount,
      currency = 'INR',
      clientId,
      effectiveFrom,
      effectiveTo,
    }: CreateFieldUserCommissionAssignmentData = req.body;

    // Validate required fields
    if (!userId || !rateTypeId || !commissionAmount) {
      return res.status(400).json({
        success: false,
        message: 'User ID, rate type ID, and commission amount are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if user exists and is execution-eligible for commission assignment
    const userProfile = await loadUserCapabilityProfile(userId);
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (!isExecutionEligibleUser(userProfile)) {
      return res.status(400).json({
        success: false,
        message: 'User must be execution-eligible to assign commission rates',
        error: { code: 'VALIDATION_ERROR' },
      });
    }
    if (
      !valueAllowedByScope(
        {
          userId: userProfile.id,
          clientId: clientId ?? null,
        },
        scope
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'Assignment target is outside assigned scope',
        error: { code: 'OUT_OF_SCOPE' },
      });
    }

    // Check if rate type exists
    const rateTypeCheck = await query('SELECT id FROM rate_types WHERE id = $1', [rateTypeId]);
    if (rateTypeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rate type not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for existing active assignment for same user, rate type, and client
    const existingCheck = await query(
      `SELECT id FROM field_user_commission_assignments
       WHERE user_id = $1 AND rate_type_id = $2 AND client_id = $3 AND is_active = true`,
      [userId, rateTypeId, clientId || null]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Active commission assignment already exists for this user, rate type, and client combination',
        error: { code: 'DUPLICATE_ASSIGNMENT' },
      });
    }

    // Create field user commission assignment
    const insertQuery = `
      INSERT INTO field_user_commission_assignments
      (user_id, rate_type_id, commission_amount, currency, client_id, effective_from, effective_to, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const newAssignment = await query(insertQuery, [
      userId,
      rateTypeId,
      commissionAmount,
      currency,
      clientId || null,
      effectiveFrom || new Date(),
      effectiveTo || null,
      req.user?.id,
    ]);

    logger.info('Created field user commission assignment', {
      userId: req.user?.id,
      assignmentId: newAssignment.rows[0].id,
      targetUserId: userId,
      rateTypeId,
      commissionAmount,
    });

    // T0-8 (audit 2026-05-17): RBI money-path audit trail.
    void createAuditLog({
      action: 'FIELD_USER_COMMISSION_ASSIGNMENT_CREATED',
      entityType: 'COMMISSION_ASSIGNMENT',
      entityId: String(newAssignment.rows[0].id),
      userId: req.user?.id,
      details: {
        targetUserId: userId,
        rateTypeId,
        commissionAmount,
        currency,
        clientId: clientId || null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    res.status(201).json({
      success: true,
      data: newAssignment.rows[0],
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

export const updateFieldUserCommissionAssignment = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.approve')) {
      return;
    }
    const scope = await resolveDataScope(req as never);
    const { id } = req.params;
    const {
      userId,
      rateTypeId,
      commissionAmount,
      currency = 'INR',
      clientId,
      effectiveFrom,
      effectiveTo,
    }: CreateFieldUserCommissionAssignmentData = req.body;

    // Validate required fields
    if (!userId || !rateTypeId || !commissionAmount) {
      return res.status(400).json({
        success: false,
        message: 'User ID, rate type ID, and commission amount are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if assignment exists
    const existingAssignment = await query(
      'SELECT id, user_id, client_id FROM field_user_commission_assignments WHERE id = $1',
      [Number(id)]
    );

    if (existingAssignment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Field user commission assignment not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    if (
      !valueAllowedByScope(
        {
          userId: existingAssignment.rows[0].userId,
          clientId: existingAssignment.rows[0].clientId ?? null,
        },
        scope
      )
    ) {
      return res.status(404).json({
        success: false,
        message: 'Field user commission assignment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Update the assignment
    const updateQuery = `
      UPDATE field_user_commission_assignments
      SET
        user_id = $1,
        rate_type_id = $2,
        commission_amount = $3,
        currency = $4,
        client_id = $5,
        effective_from = $6,
        effective_to = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    const result = await query(updateQuery, [
      userId,
      rateTypeId,
      commissionAmount,
      currency,
      clientId || null,
      effectiveFrom || new Date().toISOString(),
      effectiveTo || null,
      Number(id),
    ]);

    logger.info('Updated field user commission assignment', {
      userId: req.user?.id,
      assignmentId: id,
      targetUserId: userId,
      rateTypeId,
      commissionAmount,
    });

    // T0-8 (audit 2026-05-17): RBI money-path audit trail.
    void createAuditLog({
      action: 'FIELD_USER_COMMISSION_ASSIGNMENT_UPDATED',
      entityType: 'COMMISSION_ASSIGNMENT',
      entityId: String(id),
      userId: req.user?.id,
      details: {
        targetUserId: userId,
        rateTypeId,
        commissionAmount,
        currency,
        clientId: clientId || null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Field user commission assignment updated successfully',
    });
  } catch (error) {
    logger.error('Error updating field user commission assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update field user commission assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const deleteFieldUserCommissionAssignment = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.approve')) {
      return;
    }
    const scope = await resolveDataScope(req as never);
    const { id } = req.params;

    // T0-8 (audit 2026-05-17): capture full row BEFORE delete so the audit
    // log shows what was lost — including commission_amount, rate_type_id,
    // and the target user. Without this, removed money-flow rows leave no
    // trail.
    const existingAssignment = await query<{
      id: number;
      user_id: string;
      client_id: number | null;
      rate_type_id: number;
      commission_amount: string;
      currency: string;
      effective_from: Date | null;
      effective_to: Date | null;
      is_active: boolean;
    }>(
      `SELECT id, user_id, client_id, rate_type_id, commission_amount, currency,
              effective_from, effective_to, is_active
         FROM field_user_commission_assignments WHERE id = $1`,
      [Number(id)]
    );

    if (existingAssignment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Field user commission assignment not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    const priorRow = existingAssignment.rows[0];
    if (
      !valueAllowedByScope(
        {
          userId: priorRow.user_id,
          clientId: priorRow.client_id ?? null,
        },
        scope
      )
    ) {
      return res.status(404).json({
        success: false,
        message: 'Field user commission assignment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Delete the assignment
    await query('DELETE FROM field_user_commission_assignments WHERE id = $1', [Number(id)]);

    logger.info('Deleted field user commission assignment', {
      userId: req.user?.id,
      assignmentId: id,
    });

    // T0-8 (audit 2026-05-17): RBI money-path audit trail with prior values.
    void createAuditLog({
      action: 'FIELD_USER_COMMISSION_ASSIGNMENT_DELETED',
      entityType: 'COMMISSION_ASSIGNMENT',
      entityId: String(id),
      userId: req.user?.id,
      details: {
        priorRow: {
          targetUserId: priorRow.user_id,
          rateTypeId: priorRow.rate_type_id,
          commissionAmount: priorRow.commission_amount,
          currency: priorRow.currency,
          clientId: priorRow.client_id,
          effectiveFrom: priorRow.effective_from,
          effectiveTo: priorRow.effective_to,
          isActive: priorRow.is_active,
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Field user commission assignment deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting field user commission assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete field user commission assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// =====================================================
// COMMISSION CALCULATIONS
// =====================================================

export const getCommissionCalculations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.download')) {
      return;
    }
    const scope = await resolveDataScope(req as never);
    const {
      userId,
      clientId,
      rateTypeId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    let whereClause = '';
    const queryParams: QueryParams = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} cc.user_id = $${paramCount}`;
      queryParams.push(userId as string);
    }

    if (clientId) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} cc.client_id = $${paramCount}`;
      queryParams.push(Number(clientId));
    }

    if (rateTypeId) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} cc.rate_type_id = $${paramCount}`;
      queryParams.push(Number(rateTypeId));
    }

    if (status) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} cc.status = $${paramCount}`;
      queryParams.push(status as string);
    }

    if (startDate) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} cc.created_at >= $${paramCount}`;
      queryParams.push(startDate as string);
    }

    if (endDate) {
      paramCount++;
      whereClause += `${whereClause ? ' AND' : ''} cc.created_at <= $${paramCount}`;
      queryParams.push(endDate as string);
    }

    const scopeConditions: string[] = whereClause ? [whereClause] : [];
    appendOperationalScopeConditions({
      scope,
      conditions: scopeConditions,
      params: queryParams as unknown as Array<string | number | boolean | string[] | number[]>,
      userExpr: 'cc.user_id',
      clientExpr: 'cc.client_id',
      productExpr: 'cases.product_id',
    });
    whereClause = scopeConditions.join(' AND ');
    paramCount = queryParams.length;

    const offset = (Number(page) - 1) * Number(limit);
    paramCount++;
    queryParams.push(Number(limit));
    paramCount++;
    queryParams.push(offset);

    const calculationsQuery = `
      SELECT
        cc.*,
        u.name as user_name,
        u.email as user_email,
        c.name as client_name,
        rt.name as rate_type_name,
        p.name as product_name,
        cases.customer_name as customer_name,
        cases.case_id as case_number_display,
        vt.task_number,
        vt.task_title,
        vt.verification_outcome,
        vt.completed_at as task_completed_at,
        vtype.name as verification_type_name,
        vt.status as task_status
      FROM commission_calculations cc
      LEFT JOIN users u ON cc.user_id = u.id
      LEFT JOIN clients c ON cc.client_id = c.id
      LEFT JOIN rate_types rt ON cc.rate_type_id = rt.id
      LEFT JOIN cases ON cc.case_id = cases.id
      LEFT JOIN products p ON cases.product_id = p.id
      LEFT JOIN verification_tasks vt ON cc.verification_task_id = vt.id
      LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
      ${whereClause ? `WHERE ${whereClause}` : ''}
      ORDER BY cc.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const calculations = await query(calculationsQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM commission_calculations cc
      LEFT JOIN cases ON cc.case_id = cases.id
      ${whereClause ? `WHERE ${whereClause}` : ''}
    `;
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const totalResult = await query(countQuery, countParams);
    const total = parseInt(totalResult.rows[0].total);

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(*) as total_calculations,
        SUM(cc.calculated_commission) as total_commission,
        COUNT(CASE WHEN cc.status = 'PENDING' THEN 1 END) as pending_count,
        COUNT(CASE WHEN cc.status = 'APPROVED' THEN 1 END) as approved_count,
        COUNT(CASE WHEN cc.status = 'PAID' THEN 1 END) as paid_count
      FROM commission_calculations cc
      LEFT JOIN cases ON cc.case_id = cases.id
      ${whereClause ? `WHERE ${whereClause}` : ''}
    `;
    const summaryResult = await query(summaryQuery, countParams);

    logger.info('Retrieved commission calculations', {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      total,
      filters: { userId, clientId, rateTypeId, status, startDate, endDate },
    });

    res.json({
      success: true,
      data: calculations.rows,
      summary: summaryResult.rows[0],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving commission calculations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve commission calculations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// =====================================================
// AUTO-CALCULATION HELPER FUNCTION
// =====================================================

// 2026-04-28 PE2.b: deleted `autoCalculateCommissionForCase` (zero callers,
// referenced dropped `cases.assigned_to`). The per-task path below
// (`autoCalculateCommissionForTask`) is the live commission flow,
// invoked from verificationTasksController on task completion.
//
// 2026-05-11 L-2 + L-3: deleted `calculateCommissionForCompletedCase` —
// referenced dropped `cases.assigned_to`, INSERTed non-existent `created_by`
// column, and zero FE UI consumers. Path A (per-case commission with NULL
// verification_task_id) is gone; commission is per-task only via the live
// path below.

// Auto-calculate commission when verification task is completed (called internally)
export const autoCalculateCommissionForTask = async (taskId: string): Promise<boolean> => {
  try {
    logger.info(`🧮 Auto-calculating commission for completed verification task: ${taskId}`);

    // Get task details with STRICT status validation
    const taskQuery = `
      SELECT
        vt.id,
        vt.task_number,
        vt.case_id,
        vt.assigned_to as user_id,
        vt.rate_type_id,
        vt.actual_amount as base_amount,
        vt.completed_at as task_completed_at,
        vt.status,
        vt.verification_outcome,
        c.client_id as client_id,
        c.case_id as case_number,
        rt.name as rate_type_name
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN rate_types rt ON vt.rate_type_id = rt.id
      WHERE vt.id = $1 
        AND vt.status = 'COMPLETED'  -- MUST be COMPLETED
        AND vt.status != 'REVOKED'   -- NEVER generate for REVOKED tasks
    `;

    const taskResult = await query(taskQuery, [taskId]);

    if (taskResult.rows.length === 0) {
      logger.info(`⚠️ Task not found, not completed, or revoked: ${taskId}`);
      return false;
    }

    const taskData = taskResult.rows[0];

    // Validate task status is COMPLETED (double-check)
    if (taskData.status !== 'COMPLETED') {
      logger.warn(
        `⚠️ Task ${taskId} status is ${taskData.status}, not COMPLETED. Skipping commission.`
      );
      return false;
    }

    if (!taskData.rateTypeId) {
      logger.info(`⚠️ No rate type assigned for task: ${taskId}`);
      return false;
    }

    if (!taskData.userId) {
      logger.info(`⚠️ No user assigned to task: ${taskId}`);
      return false;
    }

    // Get field user commission assignment
    const assignmentQuery = `
      SELECT
        commission_amount,
        currency,
        is_active
      FROM field_user_commission_assignments
      WHERE user_id = $1
        AND rate_type_id = $2
        AND is_active = true
        AND (client_id IS NULL OR client_id = $3)
        AND effective_from <= CURRENT_TIMESTAMP
        AND (effective_to IS NULL OR effective_to >= CURRENT_TIMESTAMP)
      ORDER BY client_id DESC NULLS LAST
      LIMIT 1
    `;

    const assignmentResult = await query(assignmentQuery, [
      taskData.userId,
      taskData.rateTypeId,
      taskData.clientId,
    ]);

    if (assignmentResult.rows.length === 0) {
      logger.info(
        `⚠️ No commission assignment found for user ${taskData.user_id} and rate type ${taskData.rate_type_id}`
      );
      return false;
    }

    const assignment = assignmentResult.rows[0];

    // Calculate commission
    const commissionAmount = parseFloat(assignment.commissionAmount);
    const baseAmount = parseFloat(taskData.baseAmount) || 0;

    // IDEMPOTENT INSERT: Use ON CONFLICT DO NOTHING for concurrency safety
    // The UNIQUE constraint on verificationTaskId prevents duplicates
    // commission_calculations.id is bigint w/ nextval default — let the sequence fire.
    const insertQuery = `
      INSERT INTO commission_calculations (
        verification_task_id,
        case_id,
        case_number,
        user_id,
        client_id,
        rate_type_id,
        base_amount,
        commission_amount,
        calculated_commission,
        currency,
        calculation_method,
        status,
        case_completed_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (verification_task_id) DO NOTHING
      RETURNING id, commission_amount, currency
    `;

    const insertResult = await query(insertQuery, [
      taskId,
      taskData.caseId,
      taskData.caseNumber,
      taskData.userId,
      taskData.clientId,
      taskData.rateTypeId,
      baseAmount,
      commissionAmount,
      commissionAmount, // calculatedCommission
      assignment.currency,
      'FIXED_AMOUNT',
      'CALCULATED',
      taskData.taskCompletedAt,
    ]);

    // Check if insert was successful or skipped due to conflict
    if (insertResult.rows.length === 0) {
      logger.info(
        `ℹ️ Commission already exists for task: ${taskId}. Skipped duplicate calculation (concurrent request).`
      );
      return true; // Return success - commission exists
    }

    const calculation = insertResult.rows[0];
    logger.info(
      `✅ Commission calculated successfully for task ${taskId}: ${calculation.currency} ${calculation.commission_amount}`
    );

    return true;
  } catch (error) {
    logger.error(`❌ Error auto-calculating commission for task ${taskId}:`, error);
    return false;
  }
};

// =====================================================
// COMMISSION STATISTICS
// =====================================================

export const getCommissionStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.download')) {
      return;
    }
    const scope = await resolveDataScope(req as never);
    const userId = req.user!.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Get commission calculations stats
    const calcConditions: string[] = [];
    const calcParams: Array<string | number | boolean | string[] | number[]> = [];
    appendOperationalScopeConditions({
      scope,
      conditions: calcConditions,
      params: calcParams,
      userExpr: 'cc.user_id',
      clientExpr: 'cc.client_id',
      productExpr: 'cases.product_id',
    });
    const calcWhere = calcConditions.length ? `WHERE ${calcConditions.join(' AND ')}` : '';

    const calculationsStatsQuery = `
      SELECT
        COUNT(*) as total_calculations,
        COUNT(CASE WHEN cc.status = 'PAID' THEN 1 END) as paid_calculations,
        COUNT(CASE WHEN cc.status = 'PENDING' THEN 1 END) as pending_calculations,
        COUNT(CASE WHEN cc.status = 'APPROVED' THEN 1 END) as approved_calculations,
        COUNT(CASE WHEN cc.status = 'REJECTED' THEN 1 END) as rejected_calculations,
        COALESCE(SUM(CASE WHEN cc.status = 'PAID' THEN cc.commission_amount ELSE 0 END), 0) as total_paid_amount,
        COALESCE(SUM(CASE WHEN cc.status = 'PENDING' THEN cc.commission_amount ELSE 0 END), 0) as total_pending_amount,
        COALESCE(AVG(commission_amount), 0) as average_commission
      FROM commission_calculations cc
      LEFT JOIN cases ON cc.case_id = cases.id
      ${calcWhere}
    `;
    const calculationsStats = await query(calculationsStatsQuery, calcParams);
    const stats = calculationsStats.rows[0];

    // Get active field users count
    const assignmentConditions: string[] = [];
    const assignmentParams: Array<string | number | boolean | string[] | number[]> = [];
    appendOperationalScopeConditions({
      scope,
      conditions: assignmentConditions,
      params: assignmentParams,
      userExpr: 'user_id',
      clientExpr: 'client_id',
    });
    const assignmentWhere = assignmentConditions.length
      ? `AND ${assignmentConditions.join(' AND ')}`
      : '';

    const activeUsersQuery = `
      SELECT COUNT(DISTINCT user_id) as active_users
      FROM field_user_commission_assignments
      WHERE is_active = true
      ${assignmentWhere}
    `;
    const activeUsersResult = await query(activeUsersQuery, assignmentParams);
    const activeUsers = activeUsersResult.rows[0]?.activeUsers || 0;

    // Get total assignments count
    const assignmentsQuery = `
      SELECT COUNT(*) as total_assignments
      FROM field_user_commission_assignments
      ${assignmentConditions.length ? `WHERE ${assignmentConditions.join(' AND ')}` : ''}
    `;
    const assignmentsResult = await query(assignmentsQuery, assignmentParams);
    const totalAssignments = assignmentsResult.rows[0]?.totalAssignments || 0;

    // Get top performing user
    const topUserQuery = `
      SELECT u.name as user_name, COUNT(*) as calculation_count
      FROM commission_calculations cc
      LEFT JOIN users u ON cc.user_id = u.id
      LEFT JOIN cases ON cc.case_id = cases.id
      WHERE cc.status = 'PAID'
      ${calcConditions.length ? `AND ${calcConditions.join(' AND ')}` : ''}
      GROUP BY cc.user_id, u.name
      ORDER BY calculation_count DESC
      LIMIT 1
    `;
    const topUserResult = await query(topUserQuery, calcParams);
    const topUser = topUserResult.rows[0]?.userName || null;

    // Get most used rate type
    const topRateTypeQuery = `
      SELECT rt.name as rate_type_name, COUNT(*) as usage_count
      FROM field_user_commission_assignments fuca
      LEFT JOIN rate_types rt ON fuca.rate_type_id = rt.id
      ${
        assignmentConditions.length
          ? `WHERE ${assignmentConditions
              .join(' AND ')
              .replace(/\buserId\b/g, 'fuca.userId')
              .replace(/\bclientId\b/g, 'fuca.clientId')}`
          : ''
      }
      GROUP BY fuca.rate_type_id, rt.name
      ORDER BY usage_count DESC
      LIMIT 1
    `;
    const topRateTypeResult = await query(topRateTypeQuery, assignmentParams);
    const topRateType = topRateTypeResult.rows[0]?.rateTypeName || null;

    // Get total rate types count
    const rateTypesQuery = `
      SELECT COUNT(*) as total_rate_types
      FROM rate_types
      WHERE is_active = true
    `;
    const rateTypesResult = await query(rateTypesQuery);
    const totalRateTypes = rateTypesResult.rows[0]?.totalRateTypes || 0;

    // Get today's stats
    const todayQuery = `
      SELECT
        COUNT(CASE WHEN DATE(cc.created_at) = CURRENT_DATE THEN 1 END) as calculations_today,
        COALESCE(SUM(CASE WHEN DATE(cc.created_at) = CURRENT_DATE THEN cc.commission_amount ELSE 0 END), 0) as commission_today
      FROM commission_calculations cc
      LEFT JOIN cases ON cc.case_id = cases.id
      ${calcWhere}
    `;
    const todayResult = await query(todayQuery, calcParams);
    const todayStats = todayResult.rows[0];

    // Get this week's new assignments
    const thisWeekQuery = `
      SELECT COUNT(*) as new_assignments_week
      FROM field_user_commission_assignments
      WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
      ${assignmentConditions.length ? `AND ${assignmentConditions.join(' AND ')}` : ''}
    `;
    const thisWeekResult = await query(thisWeekQuery, assignmentParams);
    const newAssignmentsWeek = thisWeekResult.rows[0]?.newAssignmentsWeek || 0;

    const commissionStats = {
      // Basic stats
      totalCommissions: parseInt(stats.totalCalculations) || 0,
      totalAmount: parseFloat(stats.totalPaidAmount) + parseFloat(stats.totalPendingAmount) || 0,
      pendingCommissions: parseInt(stats.pendingCalculations) || 0,
      pendingAmount: parseFloat(stats.totalPendingAmount) || 0,
      approvedCommissions: parseInt(stats.approvedCalculations) || 0,
      approvedAmount: 0, // Can be calculated if needed
      paidCommissions: parseInt(stats.paidCalculations) || 0,
      paidAmount: parseFloat(stats.totalPaidAmount) || 0,
      rejectedCommissions: parseInt(stats.rejectedCalculations) || 0,
      rejectedAmount: 0, // Can be calculated if needed
      currency: 'INR',

      // Frontend specific stats
      totalCommissionPaid: parseFloat(stats.totalPaidAmount) || 0,
      totalCommissionPending: parseFloat(stats.totalPendingAmount) || 0,
      activeFieldUsers: parseInt(activeUsers) || 0,
      totalAssignments: parseInt(totalAssignments) || 0,
      averageCommissionPerCase: parseFloat(stats.averageCommission) || 0,
      topPerformingUser: topUser,
      mostUsedRateType: topRateType,
      totalRateTypes: parseInt(totalRateTypes) || 0,
      casesCompletedToday: parseInt(todayStats.calculationsToday) || 0,
      commissionCalculatedToday: parseFloat(todayStats.commissionToday) || 0,
      newAssignmentsThisWeek: parseInt(newAssignmentsWeek) || 0,
      paymentBatchesPending: 0, // Can be implemented when payment batches are added
    };

    logger.info('Retrieved commission statistics', {
      userId,
      totalCalculations: commissionStats.totalCommissions,
      totalPaid: commissionStats.totalCommissionPaid,
      totalPending: commissionStats.totalCommissionPending,
      activeUsers: commissionStats.activeFieldUsers,
      service: 'crm-backend',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: commissionStats,
    });
  } catch (error) {
    logger.error('Error retrieving commission statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      service: 'crm-backend',
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve commission statistics',
    });
  }
};

// GET /api/commission-management/export - Export commissions to Excel
export const exportCommissionsToExcel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req as never, res, 'billing.download')) {
      return;
    }

    // C-5 (audit 2026-05-11): apply operational scope to the export, matching
    // the pattern used by getCommissions/getCommissionStats. Without this, any
    // billing.download user can pull every client's commissions regardless of
    // their client/user/product scope — DPDP / multi-tenant breach.
    const scope = await resolveDataScope(req as never);

    const { status, startDate, endDate } = req.query;
    const conditions: string[] = [];
    const params: Array<string | number | boolean | string[] | number[]> = [];
    appendOperationalScopeConditions({
      scope,
      conditions,
      params,
      userExpr: 'cc.user_id',
      clientExpr: 'cc.client_id',
      productExpr: 'cases.product_id',
    });
    let idx = params.length + 1;

    if (status) {
      conditions.push(`cc.status = $${idx++}`);
      params.push(status as string);
    }
    if (startDate) {
      conditions.push(`cc.created_at >= $${idx++}`);
      params.push(startDate as string);
    }
    if (endDate) {
      conditions.push(`cc.created_at <= $${idx++}`);
      params.push(`${endDate as string} 23:59:59`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `
      SELECT
        cases.case_id as case_number,
        cases.customer_name as customer_name,
        vt.task_number,
        vt.task_title,
        vtype.name as verification_type_name,
        u.name as field_agent_name,
        u.employee_id as field_agent_id,
        c.name as client_name,
        p.name as product_name,
        rt.name as rate_type_name,
        cc.base_amount,
        cc.calculated_commission,
        cc.status as commission_status,
        cc.transaction_id as payment_reference,
        vt.verification_outcome,
        vt.completed_at as task_completed_at,
        cc.created_at
      FROM commission_calculations cc
      LEFT JOIN users u ON cc.user_id = u.id
      LEFT JOIN clients c ON cc.client_id = c.id
      LEFT JOIN rate_types rt ON cc.rate_type_id = rt.id
      LEFT JOIN cases ON cc.case_id = cases.id
      LEFT JOIN products p ON cases.product_id = p.id
      LEFT JOIN verification_tasks vt ON cc.verification_task_id = vt.id
      LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
      ${whereClause}
      ORDER BY cc.created_at DESC
    `,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Commissions');

    worksheet.columns = [
      { header: 'Case #', key: 'caseNumber', width: 12 },
      { header: 'Customer', key: 'customerName', width: 25 },
      { header: 'Task #', key: 'taskNumber', width: 15 },
      { header: 'Task Title', key: 'taskTitle', width: 22 },
      { header: 'Verification Type', key: 'verificationTypeName', width: 20 },
      { header: 'Field Agent', key: 'fieldAgentName', width: 20 },
      { header: 'Agent ID', key: 'fieldAgentId', width: 12 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Product', key: 'productName', width: 18 },
      { header: 'Rate Type', key: 'rateTypeName', width: 15 },
      { header: 'Base Amount', key: 'baseAmount', width: 12 },
      { header: 'Commission Amount', key: 'calculatedCommission', width: 18 },
      { header: 'Status', key: 'commissionStatus', width: 12 },
      { header: 'Payment Reference', key: 'paymentReference', width: 20 },
      { header: 'Verification Outcome', key: 'verificationOutcome', width: 18 },
      { header: 'Task Completed', key: 'taskCompletedAt', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    result.rows.forEach((row: Record<string, unknown>) => {
      worksheet.addRow({
        ...row,
        baseAmount: row.baseAmount ? Number(row.baseAmount) : null,
        calculatedCommission: row.calculatedCommission ? Number(row.calculatedCommission) : null,
        taskCompletedAt: row.taskCompletedAt
          ? new Date(row.taskCompletedAt as string).toLocaleString()
          : '',
        createdAt: row.createdAt ? new Date(row.createdAt as string).toLocaleString() : '',
      });
    });

    worksheet.autoFilter = { from: 'A1', to: `Q${result.rows.length + 1}` };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=commissions_export_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting commissions:', error);
    res.status(500).json({ success: false, message: 'Failed to export commissions' });
  }
};
