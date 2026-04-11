import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';

// GET /api/document-type-rates - List document type rates with filtering and pagination
export const getDocumentTypeRates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      clientId,
      productId,
      documentTypeId,
      isActive,
      search,
      sortBy = 'clientName',
      sortOrder = 'asc',
    } = req.query;

    // Build where clause
    const values: QueryParams = [];
    const whereSql: string[] = [];

    if (clientId) {
      values.push(Number(clientId));
      whereSql.push(`client_id = $${values.length}`);
    }

    if (productId) {
      values.push(Number(productId));
      whereSql.push(`product_id = $${values.length}`);
    }

    if (documentTypeId) {
      values.push(Number(documentTypeId));
      whereSql.push(`document_type_id = $${values.length}`);
    }

    if (typeof isActive !== 'undefined') {
      values.push(typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive));
      whereSql.push(`is_active = $${values.length}`);
    }

    if (search && typeof search === 'string') {
      values.push(`%${search}%`);
      values.push(`%${search}%`);
      values.push(`%${search}%`);
      whereSql.push(
        `(client_name ILIKE $${values.length - 2} OR product_name ILIKE $${values.length - 1} OR document_type_name ILIKE $${values.length})`
      );
    }

    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM document_type_rates_view ${whereClause}`,
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

    const listRes = await query<Record<string, unknown>>(
      `SELECT * FROM document_type_rates_view
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, Number(limit), offset]
    );
    const rates = listRes.rows;

    logger.info(`Retrieved ${rates.length} document type rates from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
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

// POST /api/document-type-rates - Create or update document type rate
export const createOrUpdateDocumentTypeRate = async (req: AuthenticatedRequest, res: Response) => {
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
    const docTypeRes = await query('SELECT id FROM kyc_document_types WHERE id = $1', [
      documentTypeId,
    ]);
    if (docTypeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
        error: { code: 'DOCUMENT_TYPE_NOT_FOUND' },
      });
    }

    // Check if rate already exists
    const existRes = await query(
      `SELECT id, amount FROM document_type_rates 
       WHERE client_id = $1 AND product_id = $2 AND document_type_id = $3 AND is_active = true`,
      [clientId, productId, documentTypeId]
    );

    await withTransaction(async client => {
      if (existRes.rows.length > 0) {
        // Update existing rate
        const existingRate = existRes.rows[0];
        await client.query(
          `UPDATE document_type_rates 
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
          `INSERT INTO document_type_rates 
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

// DELETE /api/document-type-rates/:id - Delete document type rate
export const deleteDocumentTypeRate = async (req: AuthenticatedRequest, res: Response) => {
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
    const existRes = await query('SELECT id FROM document_type_rates WHERE id = $1', [Number(id)]);
    if (existRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type rate not found',
        error: { code: 'RATE_NOT_FOUND' },
      });
    }

    // Soft delete by setting isActive to false
    await query(
      `UPDATE document_type_rates SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
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

// GET /api/document-type-rates/stats - Get statistics
export const getDocumentTypeRateStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT 
        COUNT(*)::int as "total_rates",
        COUNT(DISTINCT client_id)::int as "total_clients",
        COUNT(DISTINCT product_id)::int as "total_products",
        COUNT(DISTINCT document_type_id)::int as "total_document_types",
        COALESCE(AVG(amount), 0)::numeric(10,2) as "average_rate",
        COALESCE(MIN(amount), 0)::numeric(10,2) as "min_rate",
        COALESCE(MAX(amount), 0)::numeric(10,2) as "max_rate"
      FROM document_type_rates
      WHERE is_active = true
    `);

    const stats = statsRes.rows[0];

    logger.info('Retrieved document type rate statistics', { userId: req.user?.id });

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
