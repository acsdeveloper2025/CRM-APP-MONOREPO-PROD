import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { createAuditLog } from '@/utils/auditLogger';

// GET /api/products - List products with pagination and filters
export const getProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      productIds: productIdsFilter,
    } = req.query;

    // Build where clause and parameters
    const values: (string | number | number[])[] = [];
    const whereSql: string[] = [];
    let paramIndex = 1;

    // Apply product filtering for BACKEND_USER users
    if (productIdsFilter) {
      try {
        const parsedProductIds = JSON.parse(productIdsFilter as string);
        if (Array.isArray(parsedProductIds)) {
          if (parsedProductIds.length === 0) {
            // User has no product assignments, return empty result
            return res.json({
              success: true,
              data: [],
              pagination: {
                page: Number(page),
                limit: Number(limit),
                total: 0,
                totalPages: 0,
              },
              message: 'No products found - user has no assigned products',
            });
          }
          whereSql.push(`id = ANY($${paramIndex}::int[])`);
          values.push(parsedProductIds);
          paramIndex++;
        }
      } catch (error) {
        logger.error('Error parsing productIds filter:', error);
      }
    }

    // Add search filter if provided
    if (search && typeof search === 'string') {
      whereSql.push(
        `(COALESCE(name, '') ILIKE $${paramIndex} OR COALESCE(code, '') ILIKE $${paramIndex + 1})`
      );
      values.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM products ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get products with pagination
    const offset = (Number(page) - 1) * Number(limit);
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
      [...values, Number(limit), offset]
    );
    const products = listRes.rows;

    logger.info(`Retrieved ${products.length} products from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
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
      `SELECT id, name, code, created_at, updated_at FROM products WHERE id = $1`,
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
    const updateData = req.body as { name?: string; code?: string };

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
    // Get total count
    const totalRes = await query(`SELECT COUNT(*)::int as total FROM products`);
    const total = totalRes.rows[0]?.total || 0;

    // For now, return basic stats since the products table doesn't have isActive or category columns
    const stats = {
      total,
      active: total, // Assuming all products are active since no isActive column
      inactive: 0,
      byCategory: {
        OTHER: total, // Default category since no category column
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
