import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

const EXPORT_ROW_LIMIT = 10000;

// Shared WHERE-clause builder for getKYCRates + exportKYCRates so the two
// stay in lockstep. Operates against kyc_rates_view columns
// (client_name, product_name, document_type_name etc.). Page 3 of the
// filter-standardization sweep (2026-05-22).
const buildKYCRatesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const { search, isActive, clientId, productId, documentTypeId } = req.query;
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
  if (documentTypeId) {
    whereConditions.push(`document_type_id = $${paramIndex}`);
    queryParams.push(Number(documentTypeId));
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
      `(client_name ILIKE $${paramIndex} OR product_name ILIKE $${paramIndex} OR document_type_name ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

// GET /api/kyc-rates - List KYC rates with filtering and pagination
export const getKYCRates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'clientName', sortOrder = 'asc' } = req.query;

    const { whereClause, queryParams: values } = buildKYCRatesWhereClause(req);

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM kyc_rates_view ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get rates with pagination
    const offset = (Number(page) - 1) * Number(limit);
    // API contract: sortBy is camelCase; map to snake_case view column.
    const sortColumnMap: Record<string, string> = {
      clientName: 'client_name',
      productName: 'product_name',
      documentTypeName: 'document_type_name',
      amount: 'amount',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 'client_name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const cappedLimit = Math.min(500, Math.max(1, Number(limit) || 20));
    const listRes = await query<Record<string, unknown>>(
      `SELECT * FROM kyc_rates_view
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, cappedLimit, offset]
    );
    const rates = listRes.rows;

    logger.info(`Retrieved ${rates.length} kyc rates from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: req.query.search || '',
      total: totalCount,
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
    logger.error('Error fetching document type rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document type rates',
      error: {
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};

// POST /api/kyc-rates - Create or update document type rate
export const createOrUpdateKYCRate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, documentTypeId, amount, currency = 'INR' } = req.body;

    // Validation
    if (!clientId || !productId || !documentTypeId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: clientId, productId, documentTypeId, and amount are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (Number(amount) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be non-negative',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if client exists
    const clientRes = await query('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (clientRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'CLIENT_NOT_FOUND' },
      });
    }

    // Check if product exists
    const productRes = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: { code: 'PRODUCT_NOT_FOUND' },
      });
    }

    // Check if document type exists
    const docTypeRes = await query('SELECT id FROM document_types WHERE id = $1', [documentTypeId]);
    if (docTypeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
        error: { code: 'DOCUMENT_TYPE_NOT_FOUND' },
      });
    }

    // Check if rate already exists
    const existRes = await query(
      `SELECT id, amount FROM kyc_rates 
       WHERE client_id = $1 AND product_id = $2 AND document_type_id = $3 AND is_active = true`,
      [clientId, productId, documentTypeId]
    );

    await withTransaction(async client => {
      if (existRes.rows.length > 0) {
        // Update existing rate
        const existingRate = existRes.rows[0];
        await client.query(
          `UPDATE kyc_rates 
           SET amount = $1, currency = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [amount, currency, existingRate.id]
        );

        logger.info(`Updated document type rate: ${existingRate.id}`, {
          userId: req.user?.id,
          clientId: Number(clientId),
          productId: Number(productId),
          documentTypeId: Number(documentTypeId),
          oldAmount: existingRate.amount,
          newAmount: amount,
        });
      } else {
        // Create new rate
        const insertRes = await client.query(
          `INSERT INTO kyc_rates 
           (client_id, product_id, document_type_id, amount, currency, is_active, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [clientId, productId, documentTypeId, amount, currency, req.user?.id]
        );

        logger.info(`Created document type rate: ${insertRes.rows[0].id}`, {
          userId: req.user?.id,
          clientId: Number(clientId),
          productId: Number(productId),
          documentTypeId: Number(documentTypeId),
          amount,
        });
      }
    });

    res.json({
      success: true,
      message:
        existRes.rows.length > 0
          ? 'Document type rate updated successfully'
          : 'Document type rate created successfully',
    });
  } catch (error) {
    logger.error('Error creating/updating document type rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update document type rate',
      error: {
        code: 'CREATE_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};

// DELETE /api/kyc-rates/:id - Delete document type rate
export const deleteKYCRate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate ID',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if rate exists
    const existRes = await query('SELECT id FROM kyc_rates WHERE id = $1', [Number(id)]);
    if (existRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type rate not found',
        error: { code: 'RATE_NOT_FOUND' },
      });
    }

    // Soft delete by setting isActive to false
    await query(
      `UPDATE kyc_rates SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [Number(id)]
    );

    logger.info(`Deleted document type rate: ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Document type rate deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting document type rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document type rate',
      error: {
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};

// GET /api/kyc-rates/stats - 5-card stats aggregate. Filter-standardization
// sweep Page 3 (2026-05-22) added canonical total/active/inactive +
// recentlyAddedCount alongside the existing operational signals; legacy
// keys kept for downstream consumers.
export const getKYCRateStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query<{
      total: number;
      active: number;
      inactive: number;
      recentlyAddedCount: number;
      averageRate: string | null;
      totalRates: number;
      totalClients: number;
      totalProducts: number;
      totalDocumentTypes: number;
      minRate: string | null;
      maxRate: string | null;
    }>(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as "recentlyAddedCount",
        COALESCE(AVG(amount) FILTER (WHERE is_active = true), 0)::numeric(10,2) as "averageRate",
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as "totalRates",
        COUNT(DISTINCT CASE WHEN is_active = true THEN client_id END)::int as "totalClients",
        COUNT(DISTINCT CASE WHEN is_active = true THEN product_id END)::int as "totalProducts",
        COUNT(DISTINCT CASE WHEN is_active = true THEN document_type_id END)::int as "totalDocumentTypes",
        COALESCE(MIN(amount) FILTER (WHERE is_active = true), 0)::numeric(10,2) as "minRate",
        COALESCE(MAX(amount) FILTER (WHERE is_active = true), 0)::numeric(10,2) as "maxRate"
      FROM kyc_rates
    `);

    const stats = statsRes.rows[0];

    logger.info('Retrieved kyc rate statistics', { userId: req.user?.id });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching document type rate stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document type rate statistics',
      error: {
        code: 'STATS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};

// GET /api/kyc-rates/export - xlsx download mirroring list filters via the
// shared buildKYCRatesWhereClause helper. Cap EXPORT_ROW_LIMIT rows; every
// user-controlled cell through escapeFormulaRow (CWE-1236). Audit row pre-
// stream. Route MUST stay declared BEFORE /:id (Express matches in order).
export const exportKYCRates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'clientName', sortOrder = 'asc' } = req.query;
    const { whereClause, queryParams, nextParamIndex } = buildKYCRatesWhereClause(req);

    const sortColumnMap: Record<string, string> = {
      clientName: 'client_name',
      productName: 'product_name',
      documentTypeName: 'document_type_name',
      amount: 'amount',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 'client_name';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query<{
      clientName: string;
      productName: string;
      documentTypeName: string;
      documentTypeCategory: string | null;
      amount: string;
      currency: string;
      isActive: boolean;
      createdAt: Date;
    }>(
      `SELECT client_name AS "clientName",
              product_name AS "productName",
              document_type_name AS "documentTypeName",
              document_type_category AS "documentTypeCategory",
              amount,
              currency,
              is_active AS "isActive",
              created_at AS "createdAt"
         FROM kyc_rates_view
         ${whereClause}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${nextParamIndex}`,
      [...queryParams, EXPORT_ROW_LIMIT]
    );

    await createAuditLog({
      action: 'KYC_RATE_EXPORTED',
      entityType: 'KYC_RATE',
      entityId: undefined,
      userId: req.user?.id,
      details: { rowCount: listRes.rows.length, filters: req.query },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('KYC Rates');
    ws.addRow([
      'Client',
      'Product',
      'KYC Document Type',
      'Category',
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
          r.documentTypeName,
          r.documentTypeCategory ?? '',
          r.amount,
          r.currency,
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          r.isActive ? 'ACTIVE' : 'INACTIVE',
        ])
      );
    }

    const filename = `kyc_rates_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buf = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (error) {
    logger.error('Error exporting KYC rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export KYC rates',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
