import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

const EXPORT_ROW_LIMIT = 10000;

// Shared WHERE-clause builder for getRates + exportRates so the two stay in
// lockstep. Operates against rate_management_view columns (client_name,
// product_name, verification_type_name, rate_type_name). Page 4 of the
// filter-standardization sweep (2026-05-22).
const buildRatesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const {
    search,
    isActive,
    clientId,
    productId,
    verificationTypeId,
    rateTypeId,
    createdFrom,
    createdTo,
  } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (clientId) {
    whereConditions.push(`client_id = $${paramIndex}`);
    queryParams.push(Number(clientId));
    paramIndex++;
  }
  if (productId) {
    whereConditions.push(`product_id = $${paramIndex}`);
    queryParams.push(Number(productId));
    paramIndex++;
  }
  if (verificationTypeId) {
    whereConditions.push(`verification_type_id = $${paramIndex}`);
    queryParams.push(Number(verificationTypeId));
    paramIndex++;
  }
  if (rateTypeId) {
    whereConditions.push(`rate_type_id = $${paramIndex}`);
    queryParams.push(Number(rateTypeId));
    paramIndex++;
  }
  if (isActive === 'true' || isActive === 'false') {
    whereConditions.push(`is_active = $${paramIndex}`);
    queryParams.push(isActive === 'true');
    paramIndex++;
  } else if (typeof isActive === 'boolean') {
    whereConditions.push(`is_active = $${paramIndex}`);
    queryParams.push(isActive);
    paramIndex++;
  }
  if (search && typeof search === 'string') {
    whereConditions.push(
      `(client_name ILIKE $${paramIndex} OR product_name ILIKE $${paramIndex} OR verification_type_name ILIKE $${paramIndex} OR rate_type_name ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }
  if (typeof createdFrom === 'string' && createdFrom) {
    whereConditions.push(`created_at >= $${paramIndex}`);
    queryParams.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    whereConditions.push(`created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    queryParams.push(createdTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

const RATES_SORT_COLUMNS: Record<string, string> = {
  clientName: 'client_name',
  productName: 'product_name',
  verificationTypeName: 'verification_type_name',
  rateTypeName: 'rate_type_name',
  amount: 'amount',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// GET /api/rates - List rates with comprehensive filtering and pagination
export const getRates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'clientName', sortOrder = 'asc' } = req.query;
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);

    const { whereClause, queryParams: values } = buildRatesWhereClause(req);

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM rate_management_view ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get rates with pagination
    const offset = (safePage - 1) * safeLimit;
    const sortCol: string =
      RATES_SORT_COLUMNS[typeof sortBy === 'string' ? sortBy : ''] || 'client_name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortDir: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query(
      `SELECT * FROM rate_management_view
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, safeLimit, offset]
    );
    const rates = listRes.rows;

    logger.info(`Retrieved ${rates.length} rates from database`, {
      userId: req.user?.id,
      page: safePage,
      limit: safeLimit,
      search: req.query.search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: rates,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
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
export const getAvailableRateTypesForAssignment = async (
  req: AuthenticatedRequest,
  res: Response
) => {
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
        rt.id as rate_type_id,
        rt.name as rate_type_name,
        rt.description as "rate_type_description",
        CASE WHEN r.id IS NOT NULL THEN r.amount ELSE NULL END as "current_amount",
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
       ORDER BY rt.name`,
      [Number(clientId), Number(productId), Number(verificationTypeId)]
    );
    const availableRateTypes = availableRes.rows;

    logger.info(`Retrieved available rate types for assignment`, {
      userId: req.user?.id,
      clientId,
      productId,
      verificationTypeId,
      availableCount: availableRateTypes.length,
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
    const {
      clientId,
      productId,
      verificationTypeId,
      rateTypeId,
      amount,
      currency = 'INR',
    } = req.body;

    // Validate required fields
    if (!clientId || !productId || !verificationTypeId || !rateTypeId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message:
          'Client ID, Product ID, Verification Type ID, Rate Type ID, and amount are required',
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
      `SELECT id FROM rate_type_assignments
       WHERE client_id = $1 AND product_id = $2 AND verification_type_id = $3 AND rate_type_id = $4 AND is_active = true`,
      [Number(clientId), Number(productId), Number(verificationTypeId), Number(rateTypeId)]
    );

    if (!assignmentRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Rate type is not assigned to this client-product-verification type combination',
        error: { code: 'RATE_TYPE_NOT_ASSIGNED' },
      });
    }

    let auditAction: 'RATE_CREATED' | 'RATE_UPDATED' = 'RATE_CREATED';
    let auditRateId: number | null = null;
    let auditOldAmount: number | null = null;

    await withTransaction(async client => {
      // Check if active rate already exists
      const existingRes = await client.query(
        `SELECT id, amount FROM rates
         WHERE client_id = $1 AND product_id = $2 AND verification_type_id = $3 AND rate_type_id = $4 AND is_active = true`,
        [Number(clientId), Number(productId), Number(verificationTypeId), Number(rateTypeId)]
      );

      if (existingRes.rows[0]) {
        // Update existing rate
        const existingRate = existingRes.rows[0];
        await client.query(
          `UPDATE rates
           SET amount = $1, currency = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [amount, currency, existingRate.id]
        );

        logger.info(`Updated existing rate: ${existingRate.id}`, {
          userId: req.user?.id,
          rateId: existingRate.id,
          oldAmount: existingRate.amount,
          newAmount: amount,
        });

        auditAction = 'RATE_UPDATED';
        auditRateId = existingRate.id;
        auditOldAmount = existingRate.amount;
      } else {
        // Create new rate
        const insertRes = await client.query(
          `INSERT INTO rates (client_id, product_id, verification_type_id, rate_type_id, amount, currency, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            Number(clientId),
            Number(productId),
            Number(verificationTypeId),
            Number(rateTypeId),
            amount,
            currency,
            req.user?.id,
          ]
        );
        const newRate = insertRes.rows[0];

        logger.info(`Created new rate: ${newRate.id}`, {
          userId: req.user?.id,
          rateId: newRate.id,
          amount,
          clientId,
          productId,
          verificationTypeId,
          rateTypeId,
        });

        auditAction = 'RATE_CREATED';
        auditRateId = newRate.id;
      }
    });

    void createAuditLog({
      action: auditAction,
      entityType: 'RATE',
      entityId: auditRateId != null ? String(auditRateId) : undefined,
      userId: req.user?.id,
      details: {
        clientId,
        productId,
        verificationTypeId,
        rateTypeId,
        amount,
        currency,
        oldAmount: auditOldAmount ?? undefined,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
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
      rateId: id,
    });

    void createAuditLog({
      action: 'RATE_DELETED',
      entityType: 'RATE',
      entityId: String(id),
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
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
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as "recentlyAddedCount",
        COALESCE(AVG(amount), 0)::numeric(10,2) as "averageAmount",
        COALESCE(MIN(amount), 0)::numeric(10,2) as "minAmount",
        COALESCE(MAX(amount), 0)::numeric(10,2) as "maxAmount",
        COUNT(DISTINCT client_id)::int as "uniqueClients"
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

// GET /api/rates/export - xlsx download mirroring list filters via the
// shared buildRatesWhereClause helper. Cap EXPORT_ROW_LIMIT; every cell
// through escapeFormulaRow (CWE-1236). Audit row RATE_EXPORTED pre-stream.
// Route MUST stay declared BEFORE /:id (Express matches in order).
export const exportRates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'clientName', sortOrder = 'asc' } = req.query;
    const { whereClause, queryParams, nextParamIndex } = buildRatesWhereClause(req);

    const sortCol = RATES_SORT_COLUMNS[typeof sortBy === 'string' ? sortBy : ''] || 'client_name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query<{
      clientName: string;
      productName: string;
      verificationTypeName: string | null;
      rateTypeName: string | null;
      amount: string;
      currency: string;
      isActive: boolean;
      createdAt: Date;
    }>(
      `SELECT client_name AS "clientName",
              product_name AS "productName",
              verification_type_name AS "verificationTypeName",
              rate_type_name AS "rateTypeName",
              amount,
              currency,
              is_active AS "isActive",
              created_at AS "createdAt"
         FROM rate_management_view
         ${whereClause}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${nextParamIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );

    await createAuditLog({
      action: 'RATE_EXPORTED',
      entityType: 'RATE',
      entityId: undefined,
      userId: req.user?.id,
      details: { rowCount: listRes.rows.length, filters: req.query },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rates');
    ws.addRow([
      'Client',
      'Product',
      'Verification Type',
      'Rate Type',
      'Amount',
      'Currency',
      'Created Date',
      'Status',
    ]);
    for (const r of listRes.rows) {
      ws.addRow(
        escapeFormulaRow([
          r.clientName,
          r.productName,
          r.verificationTypeName ?? '',
          r.rateTypeName ?? '',
          r.amount,
          r.currency,
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          r.isActive ? 'ACTIVE' : 'INACTIVE',
        ])
      );
    }

    const filename = `rates_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buf = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (error) {
    logger.error('Error exporting rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export rates',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
