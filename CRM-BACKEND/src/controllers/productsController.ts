import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import { createAuditLog } from '@/utils/auditLogger';
import { sendError } from '@/utils/apiResponse';
import { escapeFormulaRow } from '@/utils/formulaGuard';

// Shared WHERE-clause builder for getProducts + exportProducts so the two
// stay in lockstep. Returns the SQL fragment + params, OR null to signal
// "user has zero assigned products — short-circuit with empty result".
const buildProductsWhereClause = (
  req: AuthenticatedRequest
): {
  whereClause: string;
  queryParams: (string | number | boolean | number[])[];
  nextParamIndex: number;
} | null => {
  const { search, isActive, createdFrom, createdTo, productIds: productIdsFilter } = req.query;
  const whereSql: string[] = [];
  const values: (string | number | boolean | number[])[] = [];
  let paramIndex = 1;

  // BACKEND_USER product narrowing (addProductFiltering middleware emits
  // `productIds` as a JSON-stringified array on req.query).
  if (productIdsFilter) {
    try {
      const parsedProductIds = JSON.parse(productIdsFilter as string);
      if (Array.isArray(parsedProductIds)) {
        if (parsedProductIds.length === 0) {
          return null;
        }
        whereSql.push(`id = ANY($${paramIndex}::int[])`);
        values.push(parsedProductIds);
        paramIndex++;
      }
    } catch (error) {
      logger.error('Error parsing productIds filter:', error);
    }
  }

  if (search && typeof search === 'string') {
    whereSql.push(
      `(COALESCE(name, '') ILIKE $${paramIndex} OR COALESCE(code, '') ILIKE $${paramIndex + 1})`
    );
    values.push(`%${search}%`, `%${search}%`);
    paramIndex += 2;
  }

  // isActive validator accepts the express-validator coerced boolean OR a
  // 'true'/'false' string. 'all' (or undefined) → no filter.
  if (typeof isActive === 'boolean') {
    whereSql.push(`is_active = $${paramIndex}`);
    values.push(isActive);
    paramIndex++;
  } else if (isActive === 'true' || isActive === 'false') {
    whereSql.push(`is_active = $${paramIndex}`);
    values.push(isActive === 'true');
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    whereSql.push(`created_at >= $${paramIndex}`);
    values.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    whereSql.push(`created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    values.push(createdTo);
    paramIndex++;
  }

  const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';
  return { whereClause, queryParams: values, nextParamIndex: paramIndex };
};

// GET /api/products - List products with pagination and filters
export const getProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', sortOrder = 'asc' } = req.query;
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);

    const built = buildProductsWhereClause(req);
    if (built === null) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: 0,
          totalPages: 0,
        },
        message: 'No products found - user has no assigned products',
      });
    }
    const { whereClause, queryParams: values } = built;
    const paramIndex = built.nextParamIndex;

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM products ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get products with pagination
    const offset = (safePage - 1) * safeLimit;
    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortCol: string = ['name', 'code', 'createdAt', 'updatedAt'].includes(sortByStr)
      ? sortByStr
      : 'name';
    const sortDir: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const listRes = await query(
      `SELECT id, name, code, description, is_active, created_at, updated_at,
              EXISTS (
                SELECT 1 FROM rates r WHERE r.product_id = products.id AND r.is_active = true
              ) as "hasRates"
       FROM products
       ${whereClause}
       ORDER BY "${sortCol}" ${sortDir}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, safeLimit, offset]
    );
    const products = listRes.rows;

    logger.info(`Retrieved ${products.length} products from database`, {
      userId: req.user?.id,
      page: safePage,
      limit: safeLimit,
      search: search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: products,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    logger.error('Error retrieving products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/products/:id - Get product by ID
export const getProductById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const productRes = await query(
      `SELECT id, name, code, is_active, created_at, updated_at FROM products WHERE id = $1`,
      [Number(id)]
    );
    const product = productRes.rows[0];

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved product ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    logger.error('Error retrieving product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/products - Create new product
export const createProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code } = req.body;

    // Check if product code already exists
    const dupRes = await query(`SELECT 1 FROM products WHERE code = $1`, [code]);
    if (dupRes.rowCount && dupRes.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Product code already exists',
        error: { code: 'DUPLICATE_CODE' },
      });
    }

    // Create product in database
    const insertRes = await query(
      `INSERT INTO products (name, code, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, code, created_at, updated_at`,
      [name, code]
    );
    const newProduct = insertRes.rows[0];

    logger.info(`Created new product: ${newProduct.id}`, {
      userId: req.user?.id,
      productName: name,
      productCode: code,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: newProduct.id?.toString(),
      details: { name: newProduct.name, code: newProduct.code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: newProduct,
      message: 'Product created successfully',
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/products/:id - Update product
export const updateProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const updateData = req.body as { name?: string; code?: string; isActive?: boolean };

    // Check if product exists
    const existingRes = await query(`SELECT id, name, code FROM products WHERE id = $1`, [id]);
    const existingProduct = existingRes.rows[0];

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check for duplicate code if being updated
    if (updateData.code && updateData.code !== existingProduct.code) {
      const dupRes = await query(`SELECT 1 FROM products WHERE code = $1`, [updateData.code]);
      if (dupRes.rowCount && dupRes.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Product code already exists',
          error: { code: 'DUPLICATE_CODE' },
        });
      }
    }

    // Prepare update data
    const updatePayload: Record<string, string | number | boolean> = {};

    if (updateData.name) {
      updatePayload.name = updateData.name;
    }
    if (updateData.code) {
      updatePayload.code = updateData.code;
    }
    if (typeof updateData.isActive === 'boolean') {
      updatePayload.is_active = updateData.isActive;
    }

    // Build dynamic update
    const sets: string[] = [];
    const vals: (string | number | boolean | null)[] = [];
    let idx = 1;
    for (const key of Object.keys(updatePayload)) {
      sets.push(`${key} = $${idx++}`);
      vals.push(updatePayload[key]);
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(id);

    const updRes = await query(
      `UPDATE products
       SET ${sets.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, code, created_at, updated_at`,
      vals
    );
    const updatedProduct = updRes.rows[0];

    logger.info(`Updated product: ${id}`, {
      userId: req.user?.id,
      productId: id,
      updates: Object.keys(updatePayload),
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      details: { updates: updatePayload, name: updatedProduct.name, code: updatedProduct.code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully',
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/products/:id - Delete product
export const deleteProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    // Check if product exists
    const existRes = await query(`SELECT id, name FROM products WHERE id = $1`, [id]);
    const existingProduct = existRes.rows[0];

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Delete product
    await query(`DELETE FROM products WHERE id = $1`, [id]);

    logger.info(`Deleted product: ${id}`, {
      userId: req.user?.id,
      productId: id,
      productName: existingProduct.name,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'DELETE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      details: { name: existingProduct.name },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/clients/:id/products - Get products mapped to a client
export const getProductsByClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = String(req.params.id || '');
    const { isActive } = req.query as { isActive?: string };

    // Build where clause for mapping table
    const values: (number | boolean)[] = [Number(clientId)];
    const activeClause = typeof isActive !== 'undefined' ? 'AND cp.is_active = $2' : '';
    if (typeof isActive !== 'undefined') {
      values.push(typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive));
    }
    const mapRes = await query(
      `SELECT p.id, p.name, p.code, p.created_at, p.updated_at
       FROM client_products cp
       JOIN products p ON p.id = cp.product_id
       WHERE cp.client_id = $1 ${activeClause}
      `,
      values
    );
    const products = mapRes.rows;

    logger.info(`Retrieved ${products.length} products for client ${clientId}`, {
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    logger.error('Error retrieving products by client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/products/stats - Get product statistics
export const getProductStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as recently_added_count,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM rates r WHERE r.product_id = products.id AND r.is_active = true
        ) THEN 1 END)::int as with_rates_count
      FROM products
    `);
    const row = statsRes.rows[0] || {};

    const stats = {
      total: row.total ?? 0,
      active: row.active ?? 0,
      inactive: row.inactive ?? 0,
      recentlyAddedCount: row.recently_added_count ?? 0,
      withRatesCount: row.with_rates_count ?? 0,
      byCategory: {
        // products table has no category column; keep the bucket so
        // downstream FE/MIS that expect this shape doesn't break.
        OTHER: row.total ?? 0,
      },
    };

    res.json({
      success: true,
      data: stats,
      message: 'Product statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving product statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/products/:id/verification-types - Get verification types for a specific product
export const getProductVerificationTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const { isActive } = req.query;

    // Check if product exists
    const productRes = await query(`SELECT id FROM products WHERE id = $1`, [id]);
    if (!productRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Build where clause for active filter
    const whereClause = isActive !== undefined ? 'AND vt.is_active = $2' : '';
    const params =
      isActive !== undefined
        ? [id, typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive)]
        : [id];

    const vtRes = await query(
      `SELECT DISTINCT vt.id, vt.name, vt.code, vt.description, vt.is_active, MIN(cpv.created_at) as assigned_at
       FROM client_product_verifications cpv
       JOIN client_products cp ON cp.id = cpv.client_product_id
       JOIN verification_types vt ON cpv.verification_type_id = vt.id
       WHERE cp.product_id = $1 ${whereClause}
       GROUP BY vt.id, vt.name, vt.code, vt.description, vt.is_active
       ORDER BY vt.name`,
      params
    );

    logger.info(`Retrieved ${vtRes.rows.length} verification types for product ${id}`, {
      userId: req.user?.id,
      productId: id,
    });

    res.json({
      success: true,
      data: vtRes.rows,
    });
  } catch (error) {
    logger.error('Error retrieving product verification types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product verification types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/products/bulk-import - CSV bulk upsert. Headers (camelCase):
//   required: name, code
//   optional: description, isActive, clientCodes (semicolon-separated client
//             codes for the client_products M2M mapping)
// Match key is `code`; existing row → UPDATE, else INSERT. clientCodes when
// present REPLACES the existing mapping for the product (full overwrite).
export const bulkImportProducts = async (
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response
) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded', 'NO_FILE');
    }
    const { parseCSV, validateCSVRow } = await import('@/utils/csvParser');
    const rows = await parseCSV(req.file.buffer);

    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; data: Record<string, unknown>; error: string }>,
    };

    const blankToNull = (v: string | undefined): string | null =>
      typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const validationError = validateCSVRow(row, ['name', 'code']);
        if (validationError) {
          results.failed++;
          results.errors.push({ row: i + 1, data: row, error: validationError });
          continue;
        }

        const name = row.name.trim();
        const code = row.code.trim();
        const description = blankToNull(row.description);
        const isActiveRaw = blankToNull(row.isActive);
        const isActive: boolean | null =
          isActiveRaw === null
            ? null
            : ['true', '1', 'yes', 'y'].includes(isActiveRaw.toLowerCase());

        // Resolve client codes → client ids for the M2M mapping. Unknown
        // codes fail the row outright.
        const clientCodesRaw = blankToNull(row.clientCodes);
        let clientIds: number[] | null = null;
        if (clientCodesRaw !== null) {
          const codes = clientCodesRaw
            .split(';')
            .map(c => c.trim())
            .filter(c => c.length > 0);
          if (codes.length > 0) {
            const r = await query<{ id: number; code: string }>(
              'SELECT id, code FROM clients WHERE code = ANY($1::varchar[]) AND deleted_at IS NULL',
              [codes]
            );
            const found = new Set(r.rows.map(c => c.code));
            const missing = codes.filter(c => !found.has(c));
            if (missing.length > 0) {
              results.failed++;
              results.errors.push({
                row: i + 1,
                data: row,
                error: `clientCodes not found: ${missing.join(', ')}`,
              });
              continue;
            }
            clientIds = r.rows.map(c => c.id);
          } else {
            clientIds = [];
          }
        }

        // Per-row atomicity: product upsert + M2M `client_products` overwrite
        // must succeed or fail together. Without this wrap, a crash between
        // the DELETE and the INSERT loop below would leave the product with
        // no client associations. Counter increments are returned from the
        // tx so a rollback doesn't double-count the row as both succeeded
        // and failed.
        const outcome = await withTransaction(async client => {
          const existing = await client.query<{ id: number }>(
            'SELECT id FROM products WHERE code = $1',
            [code]
          );

          let productId: number;
          let kind: 'created' | 'updated';
          if (existing.rows.length > 0) {
            productId = existing.rows[0].id;
            await client.query(
              `UPDATE products SET
                 name = $1,
                 description = COALESCE($2, description),
                 is_active = COALESCE($3, is_active),
                 updated_at = NOW()
               WHERE code = $4`,
              [name, description, isActive, code]
            );
            kind = 'updated';
          } else {
            const ins = await client.query<{ id: number }>(
              `INSERT INTO products (name, code, description, is_active)
               VALUES ($1, $2, $3, COALESCE($4, true))
               RETURNING id`,
              [name, code, description, isActive]
            );
            productId = ins.rows[0].id;
            kind = 'created';
          }

          // M2M overwrite (only when CSV supplied a clientCodes column).
          if (clientIds !== null) {
            await client.query('DELETE FROM client_products WHERE product_id = $1', [productId]);
            for (const cid of clientIds) {
              await client.query(
                `INSERT INTO client_products (client_id, product_id)
                 VALUES ($1, $2)
                 ON CONFLICT (client_id, product_id) DO NOTHING`,
                [cid, productId]
              );
            }
          }
          return kind;
        });
        if (outcome === 'created') {
          results.created++;
        } else {
          results.updated++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          data: row,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Error importing product at row ${i + 1}:`, error);
      }
    }

    logger.info('Bulk import products completed', { userId: req.user?.id, results });
    await createAuditLog({
      userId: req.user?.id,
      action: 'BULK_IMPORT_PRODUCTS',
      entityType: 'PRODUCT',
      details: {
        total: results.total,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    logger.error('Error in bulk import products:', error);
    return sendError(res, 500, 'Failed to bulk import products', 'INTERNAL_ERROR');
  }
};

// GET /api/products/export - xlsx download mirroring getProducts filters.
// Same scope (addProductFiltering) + same search/isActive/date-range. Hard
// cap at EXPORT_ROW_LIMIT. Every user-controlled cell through escapeFormulaRow.
const EXPORT_ROW_LIMIT = 10000;

export const exportProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;
    const built = buildProductsWhereClause(req);

    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortCol: string = ['name', 'code', 'createdAt', 'updatedAt'].includes(sortByStr)
      ? sortByStr
      : 'name';
    const sortDir: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    let rows: Array<{
      id: number;
      name: string;
      code: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      hasRates: boolean;
    }> = [];

    if (built !== null) {
      const { whereClause, queryParams: values } = built;
      const listRes = await query<{
        id: number;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        hasRates: boolean;
      }>(
        `SELECT id, name, code, description, is_active, created_at,
                EXISTS (
                  SELECT 1 FROM rates r WHERE r.product_id = products.id AND r.is_active = true
                ) as "hasRates"
           FROM products
           ${whereClause}
           ORDER BY "${sortCol}" ${sortDir}
           LIMIT $${built.nextParamIndex}`,
        [...values, EXPORT_ROW_LIMIT]
      );
      rows = listRes.rows;
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Products');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 14 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Has Rates', key: 'hasRates', width: 10 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' },
    };

    for (const r of rows) {
      ws.addRow(
        escapeFormulaRow({
          name: r.name,
          code: r.code,
          description: r.description || '',
          hasRates: r.hasRates ? 'YES' : 'NO',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        })
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `products_${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    void createAuditLog({
      action: 'PRODUCT_EXPORTED',
      entityType: 'PRODUCT',
      entityId: undefined,
      userId: req.user!.id,
      details: {
        rowCount: rows.length,
        filename,
        filters: {
          search: typeof req.query.search === 'string' ? req.query.search : null,
          isActive:
            typeof req.query.isActive === 'string' || typeof req.query.isActive === 'boolean'
              ? String(req.query.isActive)
              : null,
          createdFrom: typeof req.query.createdFrom === 'string' ? req.query.createdFrom : null,
          createdTo: typeof req.query.createdTo === 'string' ? req.query.createdTo : null,
          sortBy: sortByStr,
          sortOrder: sortDir.toLowerCase(),
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    await workbook.xlsx.write(res);
    res.end();
    logger.info(`Products exported: ${filename}, ${rows.length} rows`);
  } catch (error) {
    logger.error('Error exporting products:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export products',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
};
