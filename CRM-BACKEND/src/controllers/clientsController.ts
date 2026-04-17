import type { Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { config } from '@/config';
import { getAssignedProductIds } from '@/middleware/productAccess';
import { isScopedOperationsUser } from '@/security/rbacAccess';
import { createAuditLog } from '@/utils/auditLogger';

interface DatabaseError extends Error {
  code?: string;
  details?: unknown;
}

// GET /api/clients - List clients with pagination and filters
export const getClients = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Get client filter from middleware
    const clientFilter = (req as AuthenticatedRequest & { clientFilter?: unknown }).clientFilter;

    logger.info('getClients controller called', {
      userId: req.user?.id,
      scopedOpsUser: isScopedOperationsUser(req.user),
      query: req.query,
      clientFilter,
      clientFilterType: typeof clientFilter,
    });

    // Build where clause and parameters
    const whereConditions: string[] = [];
    const queryParams: QueryParams = [];
    let paramIndex = 1;

    // Apply client filtering for BACKEND_USER users
    if (clientFilter !== undefined) {
      if (Array.isArray(clientFilter)) {
        if (clientFilter.length === 0) {
          // User has no client assignments, return empty result
          return res.json({
            success: true,
            data: [],
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total: 0,
              totalPages: 0,
            },
            message: 'No clients found - user has no assigned clients',
          });
        }
        whereConditions.push(`id = ANY($${paramIndex}::int[])`);
        queryParams.push(clientFilter);
        paramIndex++;
        logger.info('Applied client filter', { clientFilter, whereConditions });
      } else {
        logger.error('clientFilter is not an array:', { clientFilter, type: typeof clientFilter });
        return res.status(400).json({
          success: false,
          message: 'Invalid client filter format',
          error: { code: 'INVALID_CLIENT_FILTER' },
        });
      }
    }

    // Add search filter if provided
    if (search) {
      whereConditions.push(
        `(COALESCE(name, '') ILIKE $${paramIndex} OR COALESCE(code, '') ILIKE $${paramIndex})`
      );
      queryParams.push(
        `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
      );
      paramIndex += 1;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM clients ${whereClause}`,
      queryParams
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Get clients with pagination
    const offset = (Number(page) - 1) * Number(limit);
    // Safe column mapping — prevents SQL injection by only allowing known column names
    const SORT_COLUMNS: Record<string, string> = {
      name: '"name"',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortByStr =
      typeof sortBy === 'string' || typeof sortBy === 'number' ? String(sortBy) : 'name';
    const safeSortCol = SORT_COLUMNS[sortByStr] || SORT_COLUMNS.name;
    const sortOrderStr =
      typeof sortOrder === 'string' || typeof sortOrder === 'number' ? String(sortOrder) : 'asc';
    const sortDir = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const clientsRes = await query(
      `SELECT id, name, code, logo_url, stamp_url, primary_color, header_color,
              created_at, updated_at
       FROM clients
       ${whereClause}
       ORDER BY ${safeSortCol} ${sortDir}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );
    const dbClients = clientsRes.rows;

    // Load mappings and cases
    const dbClientIds = dbClients.map(c => c.id);
    const productsByClient = new Map<string, Record<string, unknown>[]>();
    const vtsByClient = new Map<string, Record<string, unknown>[]>();
    const dtsByClient = new Map<string, Record<string, unknown>[]>();
    const casesByClient = new Map<string, Record<string, unknown>[]>();
    if (dbClientIds.length > 0) {
      const prodMapRes = await query(
        `SELECT cp.client_id, p.id, p.name, p.code
         FROM client_products cp JOIN products p ON p.id = cp.product_id
         WHERE cp.client_id = ANY($1::integer[])`,
        [dbClientIds.map(Number)]
      );
      prodMapRes.rows.forEach(r => {
        const arr = productsByClient.get(r.clientId) || [];
        arr.push({ id: r.id, name: r.name, code: r.code });
        productsByClient.set(r.clientId, arr);
      });

      // Load verification types through product relationships
      const vtMapRes = await query(
        `SELECT DISTINCT cp.client_id, vt.id, vt.name, vt.code
         FROM client_products cp
         JOIN product_verification_types pvt ON cp.product_id = pvt.product_id
         JOIN verification_types vt ON pvt.verification_type_id = vt.id
         WHERE cp.client_id = ANY($1::integer[])`,
        [dbClientIds.map(Number)]
      );
      vtMapRes.rows.forEach(r => {
        const arr = vtsByClient.get(r.clientId) || [];
        arr.push({ id: r.id, name: r.name, code: r.code });
        vtsByClient.set(r.clientId, arr);
      });

      // Load document types through client relationships
      const dtMapRes = await query(
        `SELECT cdt.client_id, dt.id, dt.name, dt.code
         FROM client_document_types cdt
         JOIN document_types dt ON cdt.document_type_id = dt.id
         WHERE cdt.client_id = ANY($1::integer[])`,
        [dbClientIds.map(Number)]
      );
      dtMapRes.rows.forEach(r => {
        const arr = dtsByClient.get(r.clientId) || [];
        arr.push({ id: r.id, name: r.name, code: r.code });
        dtsByClient.set(r.clientId, arr);
      });

      const casesRes = await query(
        `SELECT case_id, status, client_id FROM cases WHERE client_id = ANY($1::integer[])`,
        [dbClientIds.map(Number)]
      );
      casesRes.rows.forEach(r => {
        const arr = casesByClient.get(r.clientId) || [];
        arr.push({ id: r.caseId, caseId: r.caseId, status: r.status });
        casesByClient.set(r.clientId, arr);
      });
    }

    // Transform data to match expected format
    const transformedClients = dbClients.map(client => ({
      ...client,
      products: productsByClient.get(client.id) || [],
      verificationTypes: vtsByClient.get(client.id) || [],
      documentTypes: dtsByClient.get(client.id) || [],
      cases: casesByClient.get(client.id) || [],
    }));

    logger.info(`Retrieved ${dbClients.length} clients from database`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      search: search || '',
      total: totalCount,
    });

    res.json({
      success: true,
      data: transformedClients,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve clients',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/clients/:id - Get client by ID
export const getClientById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const baseRes = await query(
      `SELECT id, name, code, logo_url, stamp_url, primary_color, header_color,
              created_at, updated_at
       FROM clients WHERE id = $1`,
      [Number(id)]
    );
    const client = baseRes.rows[0];
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const prodRes = await query(
      `SELECT p.id, p.name, p.code FROM client_products cp JOIN products p ON p.id = cp.product_id WHERE cp.client_id = $1`,
      [Number(id)]
    );

    // Load verification types through product relationships
    const vtRes = await query(
      `SELECT DISTINCT vt.id, vt.name, vt.code
       FROM client_products cp
       JOIN product_verification_types pvt ON cp.product_id = pvt.product_id
       JOIN verification_types vt ON pvt.verification_type_id = vt.id
       WHERE cp.client_id = $1`,
      [Number(id)]
    );

    // Load document types through client relationships
    const dtRes = await query(
      `SELECT dt.id, dt.name, dt.code
       FROM client_document_types cdt
       JOIN document_types dt ON cdt.document_type_id = dt.id
       WHERE cdt.client_id = $1`,
      [Number(id)]
    );

    const casesRes2 = await query(`SELECT case_id, status FROM cases WHERE client_id = $1`, [
      Number(id),
    ]);

    // Transform response data
    const responseData = {
      ...client,
      products: prodRes.rows,
      verificationTypes: vtRes.rows,
      documentTypes: dtRes.rows,
      cases: casesRes2.rows,
    };

    logger.info(`Retrieved client ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('Error retrieving client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve client',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/clients - Create new client
export const createClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      code,
      productIds = [],
      verificationTypeIds = [],
      documentTypeIds = [],
    } = req.body;

    // Check if client code already exists
    const dupRes = await query(`SELECT 1 FROM clients WHERE code = $1`, [code]);
    if (dupRes.rowCount && dupRes.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Client code already exists',
        error: { code: 'DUPLICATE_CODE' },
      });
    }

    // Verify products exist if provided
    if (productIds.length > 0) {
      const prodCheck = await query(`SELECT id FROM products WHERE id = ANY($1::integer[])`, [
        productIds.map(Number),
      ]);
      if (prodCheck.rowCount !== productIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more products not found',
          error: { code: 'PRODUCTS_NOT_FOUND' },
        });
      }
    }

    // Verify verification types exist if provided
    if (verificationTypeIds.length > 0) {
      const vtCheck = await query(
        `SELECT id FROM verification_types WHERE id = ANY($1::integer[])`,
        [verificationTypeIds.map(Number)]
      );
      if (vtCheck.rowCount !== verificationTypeIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more verification types not found',
          error: { code: 'VERIFICATION_TYPES_NOT_FOUND' },
        });
      }
    }

    // Verify document types exist if provided
    if (documentTypeIds.length > 0) {
      const dtCheck = await query(`SELECT id FROM document_types WHERE id = ANY($1::integer[])`, [
        documentTypeIds.map(Number),
      ]);
      if (dtCheck.rowCount !== documentTypeIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more document types not found',
          error: { code: 'DOCUMENT_TYPES_NOT_FOUND' },
        });
      }
    }

    // Create client and relationships in a transaction
    const newClient = await withTransaction(async cx => {
      // Create client (id is auto-generated SERIAL)
      const clientIns = await cx.query(
        `INSERT INTO clients (name, code, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, name, code, created_at, updated_at`,
        [name, code]
      );
      const created = clientIns.rows[0];

      if (productIds.length > 0) {
        const uniqueProductIds = Array.from(new Set(productIds.map(Number)));
        // Verify products
        const prodCheck = await cx.query(`SELECT id FROM products WHERE id = ANY($1::integer[])`, [
          uniqueProductIds,
        ]);
        if (prodCheck.rowCount !== uniqueProductIds.length) {
          throw Object.assign(new Error('One or more products not found'), {
            code: 'PRODUCTS_NOT_FOUND',
          });
        }
        for (const pid of uniqueProductIds) {
          await cx.query(
            `INSERT INTO client_products (client_id, product_id, is_active, created_at, updated_at) VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [created.id, Number(pid)]
          );
        }
      }

      // Create product-verification type relationships if both are provided
      if (productIds.length > 0 && verificationTypeIds.length > 0) {
        const uniqueProductIds = Array.from(new Set(productIds));
        const uniqueVerificationTypeIds = Array.from(new Set(verificationTypeIds));

        for (const productId of uniqueProductIds) {
          for (const verificationTypeId of uniqueVerificationTypeIds) {
            // Check if relationship already exists
            const existingRel = await cx.query(
              `SELECT id FROM product_verification_types WHERE product_id = $1 AND verification_type_id = $2`,
              [productId, verificationTypeId]
            );
            if (existingRel.rowCount === 0) {
              await cx.query(
                `INSERT INTO product_verification_types (product_id, verification_type_id, is_active, created_at, updated_at)
                 VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [productId, verificationTypeId]
              );
            }
          }
        }
      }

      // Create client-document type relationships if provided
      if (documentTypeIds.length > 0) {
        const uniqueDocumentTypeIds = Array.from(new Set(documentTypeIds.map(Number)));
        // Verify document types
        const dtCheck = await cx.query(
          `SELECT id FROM document_types WHERE id = ANY($1::integer[])`,
          [uniqueDocumentTypeIds]
        );
        if (dtCheck.rowCount !== uniqueDocumentTypeIds.length) {
          throw Object.assign(new Error('One or more document types not found'), {
            code: 'DOCUMENT_TYPES_NOT_FOUND',
          });
        }
        for (const dtId of uniqueDocumentTypeIds) {
          await cx.query(
            `INSERT INTO client_document_types (client_id, document_type_id, "is_active", created_at, updated_at) VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [created.id, Number(dtId)]
          );
        }
      }

      // Load includes
      const prodRes2 = await cx.query(
        `SELECT p.id, p.name, p.code FROM client_products cp JOIN products p ON p.id = cp.product_id WHERE cp.client_id = $1`,
        [created.id]
      );

      // Load verification types through product relationships
      const vtRes2 = await cx.query(
        `SELECT DISTINCT vt.id, vt.name, vt.code
         FROM client_products cp
         JOIN product_verification_types pvt ON cp.product_id = pvt.product_id
         JOIN verification_types vt ON pvt.verification_type_id = vt.id
         WHERE cp.client_id = $1`,
        [created.id]
      );

      // Load document types through client relationships
      const dtRes2 = await cx.query(
        `SELECT dt.id, dt.name, dt.code
         FROM client_document_types cdt
         JOIN document_types dt ON cdt.document_type_id = dt.id
         WHERE cdt.client_id = $1`,
        [created.id]
      );

      return {
        ...created,
        clientProducts: prodRes2.rows,
        clientVerificationTypes: vtRes2.rows,
        clientDocumentTypes: dtRes2.rows,
      };
    });

    // Transform response data
    const responseData = {
      ...newClient,
      products: newClient.clientProducts,
      verificationTypes: newClient.clientVerificationTypes,
      documentTypes: newClient.clientDocumentTypes,
    };

    logger.info(`Created new client: ${newClient.id}`, {
      userId: req.user?.id,
      clientName: name,
      clientCode: code,
      productCount: productIds.length,
      verificationTypeCount: verificationTypeIds.length,
      documentTypeCount: documentTypeIds.length,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'CREATE_CLIENT',
      entityType: 'CLIENT',
      entityId: newClient.id?.toString(),
      details: { name: newClient.name, code: newClient.code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: responseData,
      message: 'Client created successfully',
    });
  } catch (error: unknown) {
    const err = error as DatabaseError;
    if (err?.code === 'PRODUCTS_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        message: 'One or more products not found',
        error: { code: 'PRODUCTS_NOT_FOUND' },
      });
    }

    if (err?.code === 'VERIFICATION_TYPES_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        message: 'One or more verification types not found',
        error: { code: 'VERIFICATION_TYPES_NOT_FOUND' },
      });
    }

    if (err?.code === 'DOCUMENT_TYPES_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        message: 'One or more document types not found',
        error: { code: 'DOCUMENT_TYPES_NOT_FOUND' },
      });
    }

    logger.error('Error creating client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/clients/:id - Update client
export const updateClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body as {
      name?: string;
      code?: string;
      productIds?: unknown[];
      verificationTypeIds?: unknown[];
      documentTypeIds?: unknown[];
      primaryColor?: string | null;
      headerColor?: string | null;
    };

    // Hex color validation (#RGB, #RRGGBB, or explicit null to clear).
    const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const validateColorField = (value: unknown, fieldName: string): true | string => {
      if (value === null || value === undefined) {
        return true;
      }
      if (typeof value !== 'string') {
        return `${fieldName} must be a string or null`;
      }
      if (value === '') {
        return true;
      }
      if (!COLOR_PATTERN.test(value)) {
        return `${fieldName} must be a hex color like #FF9800 or #F90`;
      }
      return true;
    };
    const primaryColorCheck = validateColorField(updateData.primaryColor, 'primaryColor');
    if (primaryColorCheck !== true) {
      return res
        .status(400)
        .json({ success: false, message: primaryColorCheck, error: { code: 'INVALID_COLOR' } });
    }
    const headerColorCheck = validateColorField(updateData.headerColor, 'headerColor');
    if (headerColorCheck !== true) {
      return res
        .status(400)
        .json({ success: false, message: headerColorCheck, error: { code: 'INVALID_COLOR' } });
    }

    const normalizeIdArray = (values: unknown[]): { normalized: number[]; invalid: boolean } => {
      const normalized: number[] = [];
      for (const value of values) {
        if (value === null || value === undefined || value === '') {
          continue;
        }
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isInteger(num) || num <= 0) {
          return { normalized: [], invalid: true };
        }
        normalized.push(num);
      }
      return { normalized, invalid: false };
    };

    const normalizedProductIds = Array.isArray(updateData.productIds)
      ? normalizeIdArray(updateData.productIds)
      : null;
    if (normalizedProductIds?.invalid) {
      return res.status(400).json({
        success: false,
        message: 'productIds must contain only positive integer IDs',
        error: { code: 'INVALID_PRODUCT_IDS' },
      });
    }

    const normalizedVerificationTypeIds = Array.isArray(updateData.verificationTypeIds)
      ? normalizeIdArray(updateData.verificationTypeIds)
      : null;
    if (normalizedVerificationTypeIds?.invalid) {
      return res.status(400).json({
        success: false,
        message: 'verificationTypeIds must contain only positive integer IDs',
        error: { code: 'INVALID_VERIFICATION_TYPE_IDS' },
      });
    }

    const normalizedDocumentTypeIds = Array.isArray(updateData.documentTypeIds)
      ? normalizeIdArray(updateData.documentTypeIds)
      : null;
    if (normalizedDocumentTypeIds?.invalid) {
      return res.status(400).json({
        success: false,
        message: 'documentTypeIds must contain only positive integer IDs',
        error: { code: 'INVALID_DOCUMENT_TYPE_IDS' },
      });
    }

    // Check if client exists
    const existRes = await query(`SELECT id, code FROM clients WHERE id = $1`, [id]);
    const existingClient = existRes.rows[0];
    if (!existingClient) {
      return res
        .status(404)
        .json({ success: false, message: 'Client not found', error: { code: 'NOT_FOUND' } });
    }

    // Check for duplicate code if being updated
    if (updateData.code && updateData.code !== existingClient.code) {
      const dupRes2 = await query(`SELECT 1 FROM clients WHERE code = $1`, [updateData.code]);
      if (dupRes2.rowCount && dupRes2.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Client code already exists',
          error: { code: 'DUPLICATE_CODE' },
        });
      }
    }

    const result = await withTransaction(async cx => {
      // Update base fields
      const updates: string[] = [];
      const vals: QueryParams = [];
      let i = 1;
      if (updateData.name) {
        updates.push(`name = $${i++}`);
        vals.push(updateData.name);
      }
      if (updateData.code) {
        updates.push(`code = $${i++}`);
        vals.push(updateData.code);
      }
      // Explicit `in updateData` checks so callers can clear a color by
      // sending null; a missing key leaves the column untouched.
      if ('primaryColor' in updateData) {
        updates.push(`primary_color = $${i++}`);
        vals.push(updateData.primaryColor === '' ? null : (updateData.primaryColor ?? null));
      }
      if ('headerColor' in updateData) {
        updates.push(`header_color = $${i++}`);
        vals.push(updateData.headerColor === '' ? null : (updateData.headerColor ?? null));
      }
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      vals.push(id);
      await cx.query(`UPDATE clients SET ${updates.join(', ')} WHERE id = $${i}`, vals);

      // Sync product mappings if provided
      if (normalizedProductIds) {
        const ids = Array.from(new Set(normalizedProductIds.normalized));
        if (ids.length > 0) {
          const prodCheck = await cx.query(
            `SELECT id FROM products WHERE id = ANY($1::integer[])`,
            [ids]
          );
          if (prodCheck.rowCount !== ids.length) {
            throw Object.assign(new Error('One or more products not found'), {
              code: 'PRODUCTS_NOT_FOUND',
            });
          }
        }
        await cx.query(
          `DELETE FROM client_products WHERE client_id = $1 AND product_id <> ALL($2::integer[])`,
          [Number(id), ids]
        );
        for (const pid of ids) {
          // Check if relationship already exists
          const existingRel = await cx.query(
            `SELECT id FROM client_products WHERE client_id = $1 AND product_id = $2`,
            [Number(id), pid]
          );
          if (existingRel.rowCount === 0) {
            await cx.query(
              `INSERT INTO client_products (client_id, product_id, is_active, created_at)
               VALUES ($1, $2, true, CURRENT_TIMESTAMP)`,
              [Number(id), pid]
            );
          }
        }
      }

      // Sync verification type mappings through products if provided
      if (normalizedVerificationTypeIds) {
        const vtIds = Array.from(new Set(normalizedVerificationTypeIds.normalized));
        if (vtIds.length > 0) {
          const vtCheck = await cx.query(
            `SELECT id FROM verification_types WHERE id = ANY($1::integer[])`,
            [vtIds]
          );
          if (vtCheck.rowCount !== vtIds.length) {
            throw Object.assign(new Error('One or more verification types not found'), {
              code: 'VERIFICATION_TYPES_NOT_FOUND',
            });
          }
        }

        // Get current products for this client
        const clientProductsRes = await cx.query(
          `SELECT product_id FROM client_products WHERE client_id = $1`,
          [Number(id)]
        );
        const productIds = clientProductsRes.rows.map(row => row.productId);

        if (productIds.length > 0) {
          // Remove existing product-verification type relationships for this client's products
          await cx.query(
            `DELETE FROM product_verification_types WHERE product_id = ANY($1::integer[]) AND verification_type_id NOT IN (SELECT UNNEST($2::integer[]))`,
            [productIds, vtIds]
          );

          // Add new product-verification type relationships
          for (const productId of productIds) {
            for (const vtId of vtIds) {
              // Check if relationship already exists
              const existingRel = await cx.query(
                `SELECT id FROM product_verification_types WHERE product_id = $1 AND verification_type_id = $2`,
                [productId, vtId]
              );
              if (existingRel.rowCount === 0) {
                await cx.query(
                  `INSERT INTO product_verification_types (product_id, verification_type_id, is_active, created_at, updated_at)
                   VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                  [productId, vtId]
                );
              }
            }
          }
        }
      }

      // Sync document type mappings if provided
      if (normalizedDocumentTypeIds) {
        const dtIds = Array.from(new Set(normalizedDocumentTypeIds.normalized));
        if (dtIds.length > 0) {
          const dtCheck = await cx.query(
            `SELECT id FROM document_types WHERE id = ANY($1::integer[])`,
            [dtIds]
          );
          if (dtCheck.rowCount !== dtIds.length) {
            throw Object.assign(new Error('One or more document types not found'), {
              code: 'DOCUMENT_TYPES_NOT_FOUND',
            });
          }
        }
        await cx.query(
          `DELETE FROM client_document_types WHERE client_id = $1 AND document_type_id <> ALL($2::integer[])`,
          [Number(id), dtIds]
        );
        for (const dtId of dtIds) {
          await cx.query(
            `INSERT INTO client_document_types (client_id, document_type_id, "is_active", created_at)
             VALUES ($1, $2, true, CURRENT_TIMESTAMP)
             ON CONFLICT (client_id, document_type_id) DO NOTHING`,
            [Number(id), dtId]
          );
        }
      }

      // Load includes
      const prodRes3 = await cx.query(
        `SELECT p.id, p.name, p.code FROM client_products cp JOIN products p ON p.id = cp.product_id WHERE cp.client_id = $1`,
        [Number(id)]
      );

      // Load verification types through product relationships
      const vtRes3 = await cx.query(
        `SELECT DISTINCT vt.id, vt.name, vt.code
         FROM client_products cp
         JOIN product_verification_types pvt ON cp.product_id = pvt.product_id
         JOIN verification_types vt ON pvt.verification_type_id = vt.id
         WHERE cp.client_id = $1`,
        [Number(id)]
      );

      // Load document types through client relationships
      const dtRes3 = await cx.query(
        `SELECT dt.id, dt.name, dt.code
         FROM client_document_types cdt
         JOIN document_types dt ON cdt.document_type_id = dt.id
         WHERE cdt.client_id = $1`,
        [Number(id)]
      );

      return {
        id,
        clientProducts: prodRes3.rows,
        clientVerificationTypes: vtRes3.rows,
        clientDocumentTypes: dtRes3.rows,
      } as Record<string, unknown>;
    });

    const responseData = {
      ...result,
      products: result.clientProducts,
      verificationTypes: result.clientVerificationTypes,
      documentTypes: result.clientDocumentTypes,
    };

    logger.info(`Updated client: ${id}`, {
      userId: req.user?.id,
      clientId: id,
      updates: Object.keys(updateData),
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'UPDATE_CLIENT',
      entityType: 'CLIENT',
      entityId: id?.toString(),
      details: { updates: Object.keys(updateData) },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, data: responseData, message: 'Client updated successfully' });
  } catch (error: unknown) {
    const err = error as DatabaseError;
    if (err?.code === 'PRODUCTS_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        message: 'One or more products not found',
        error: { code: 'PRODUCTS_NOT_FOUND' },
      });
    }

    if (err?.code === 'VERIFICATION_TYPES_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        message: 'One or more verification types not found',
        error: { code: 'VERIFICATION_TYPES_NOT_FOUND' },
      });
    }

    if (err?.code === 'DOCUMENT_TYPES_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        message: 'One or more document types not found',
        error: { code: 'DOCUMENT_TYPES_NOT_FOUND' },
      });
    }

    logger.error('Error updating client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/clients/:id - Delete client
export const deleteClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const existRes2 = await query(`SELECT id, name FROM clients WHERE id = $1`, [id]);
    const existingClient = existRes2.rows[0];

    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if client has associated cases
    const casesRes = await query(`SELECT COUNT(*)::int as count FROM cases WHERE client_id = $1`, [
      id,
    ]);
    const caseCount = casesRes.rows[0]?.count || 0;

    if (caseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete client. This client has ${caseCount} associated case(s). Please delete or reassign the cases first.`,
        error: {
          code: 'HAS_DEPENDENCIES',
          details: {
            dependencyType: 'cases',
            count: caseCount,
          },
        },
      });
    }

    // Check if client has any cases (cannot delete if cases exist)
    const casesCheck = await query(`SELECT COUNT(*) as count FROM cases WHERE client_id = $1`, [
      id,
    ]);

    if (parseInt(casesCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete client with existing cases. Please delete or reassign all cases first.',
        error: {
          code: 'CLIENT_HAS_CASES',
          caseCount: casesCheck.rows[0].count,
        },
      });
    }

    // Delete client and related records in a transaction
    await withTransaction(async cx => {
      // Delete related records first (foreign keys with NO ACTION or RESTRICT need manual deletion)
      // Order matters: delete child records before parent records
      await cx.query(`DELETE FROM rates WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM document_type_rates WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM rate_type_assignments WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM client_products WHERE client_id = $1`, [id]);

      // These have CASCADE but we delete them explicitly for clarity
      await cx.query(`DELETE FROM client_document_types WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM user_client_assignments WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM commission_calculations WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM field_user_commission_assignments WHERE client_id = $1`, [id]);

      // Finally delete the client
      await cx.query(`DELETE FROM clients WHERE id = $1`, [id]);
    });

    logger.info(`Deleted client: ${id}`, {
      userId: req.user?.id,
      clientId: id,
      clientName: existingClient.name,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'DELETE_CLIENT',
      entityType: 'CLIENT',
      entityId: id?.toString(),
      details: { name: existingClient.name },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/clients/:id/products - Get products for a specific client
export const getClientProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.query;

    // Check if client exists
    const clientRes = await query(`SELECT id FROM clients WHERE id = $1`, [id]);
    if (!clientRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const filters: string[] = [];
    const params: (number | boolean | number[])[] = [Number(id)];
    let paramIndex = 2;

    if (isActive !== undefined) {
      const isActiveStr =
        typeof isActive === 'string' || typeof isActive === 'number' ? String(isActive) : 'false';
      filters.push(`cp.is_active = $${paramIndex}`);
      params.push(isActiveStr === 'true');
      paramIndex++;
    }

    if (req.user?.id && isScopedOperationsUser(req.user)) {
      const assignedProductIds = await getAssignedProductIds(req.user.id);
      if (!assignedProductIds || assignedProductIds.length === 0) {
        return res.json({
          success: true,
          data: [],
        });
      }
      filters.push(`p.id = ANY($${paramIndex}::int[])`);
      params.push(assignedProductIds);
      paramIndex++;
    }

    const whereClause = filters.length > 0 ? ` AND ${filters.join(' AND ')}` : '';

    const productsRes = await query(
      `SELECT p.id, p.name, p.code, p.description, cp.created_at as assigned_at
       FROM client_products cp
       JOIN products p ON p.id = cp.product_id
       WHERE cp.client_id = $1${whereClause}
       ORDER BY p.name`,
      params
    );

    logger.info(`Retrieved ${productsRes.rows.length} products for client ${id}`, {
      userId: req.user?.id,
      clientId: id,
    });

    res.json({
      success: true,
      data: productsRes.rows,
    });
  } catch (error) {
    logger.error('Error retrieving client products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve client products',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/clients/:id/verification-types - Get verification types for a specific client
export const getClientVerificationTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.query;

    // Check if client exists
    const clientRes = await query(`SELECT id FROM clients WHERE id = $1`, [id]);
    if (!clientRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Build where clause for active filter
    const whereClause = isActive !== undefined ? 'AND vt.is_active = $2' : '';
    const isActiveStr2 =
      typeof isActive === 'string' || typeof isActive === 'number' ? String(isActive) : 'false';
    const params = isActive !== undefined ? [Number(id), isActiveStr2 === 'true'] : [Number(id)];

    const vtRes = await query(
      `SELECT DISTINCT vt.id, vt.name, vt.code, vt.description, vt.is_active
       FROM client_products cp
       JOIN product_verification_types pvt ON cp.product_id = pvt.product_id
       JOIN verification_types vt ON pvt.verification_type_id = vt.id
       WHERE cp.client_id = $1 ${whereClause}
       ORDER BY vt.name`,
      params
    );

    logger.info(`Retrieved ${vtRes.rows.length} verification types for client ${id}`, {
      userId: req.user?.id,
      clientId: id,
    });

    res.json({
      success: true,
      data: vtRes.rows,
    });
  } catch (error) {
    logger.error('Error retrieving client verification types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve client verification types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// Branding asset uploads (logo + stamp)
// ---------------------------------------------------------------------------

type BrandingAssetKind = 'logo' | 'stamp';

const BRANDING_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const BRANDING_EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function safeUnlink(absPath: string): Promise<void> {
  try {
    await fs.unlink(absPath);
  } catch (err) {
    // Tolerate ENOENT - the old file is already gone, which is what we wanted.
    const code = (err as { code?: string } | null)?.code;
    if (code !== 'ENOENT') {
      logger.warn('Failed to unlink branding asset', { absPath, err });
    }
  }
}

function resolveBrandingDiskPath(storedUrl: string): string {
  if (!storedUrl) {
    return '';
  }
  if (path.isAbsolute(storedUrl)) {
    return storedUrl;
  }
  if (storedUrl.startsWith('/')) {
    return path.join(process.cwd(), storedUrl);
  }
  return path.resolve(config.uploadPath, storedUrl);
}

async function handleBrandingUpload(
  req: AuthenticatedRequest,
  res: Response,
  kind: BrandingAssetKind
) {
  try {
    const { id } = req.params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client id',
        error: { code: 'INVALID_CLIENT_ID' },
      });
    }

    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
        error: { code: 'FILE_REQUIRED' },
      });
    }
    if (!BRANDING_ALLOWED_MIME.has(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported image type. Allowed: PNG, JPEG, WEBP, SVG',
        error: { code: 'UNSUPPORTED_MIME' },
      });
    }

    const column = kind === 'logo' ? 'logo_url' : 'stamp_url';
    // Locate the client and capture any previous asset so we can delete
    // it on disk after we atomically replace the DB column.
    const existingRes = await query<{
      id: number;
      logoUrl: string | null;
      stampUrl: string | null;
    }>(`SELECT id, logo_url, stamp_url FROM clients WHERE id = $1`, [clientId]);
    if (!existingRes.rows[0]) {
      return res
        .status(404)
        .json({ success: false, message: 'Client not found', error: { code: 'NOT_FOUND' } });
    }
    const existing = existingRes.rows[0];
    const priorUrl = kind === 'logo' ? existing.logoUrl : existing.stampUrl;

    // /uploads/branding/clients/<clientId>/<kind>_<timestamp>.<ext>
    const ext = BRANDING_EXT_BY_MIME[file.mimetype] ?? path.extname(file.originalname) ?? '.png';
    const relDir = path.join('branding', 'clients', String(clientId));
    const absDir = path.resolve(config.uploadPath, relDir);
    const filename = `${kind}_${Date.now()}${ext}`;
    const absPath = path.join(absDir, filename);
    const publicUrl = `/${path
      .join(path.basename(config.uploadPath) || 'uploads', relDir, filename)
      .replace(/\\+/g, '/')
      .replace(/^\/+/, '')}`;

    await ensureDirectory(absDir);
    await fs.writeFile(absPath, file.buffer);

    await query(`UPDATE clients SET ${column} = $1, updated_at = NOW() WHERE id = $2`, [
      `/${publicUrl.replace(/^\/+/, '')}`,
      clientId,
    ]);

    if (priorUrl && priorUrl !== `/${publicUrl.replace(/^\/+/, '')}`) {
      await safeUnlink(resolveBrandingDiskPath(priorUrl));
    }

    logger.info('Updated client branding asset', {
      clientId,
      kind,
      bytes: file.size,
      url: `/${publicUrl.replace(/^\/+/, '')}`,
    });

    return res.json({
      success: true,
      data: { url: `/${publicUrl.replace(/^\/+/, '')}` },
      message: `${kind === 'logo' ? 'Logo' : 'Stamp'} updated successfully`,
    });
  } catch (error) {
    logger.error(`Error uploading client ${kind}:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to upload ${kind}`,
      error: { code: 'INTERNAL_ERROR' },
    });
  }
}

async function handleBrandingDelete(
  req: AuthenticatedRequest,
  res: Response,
  kind: BrandingAssetKind
) {
  try {
    const { id } = req.params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client id',
        error: { code: 'INVALID_CLIENT_ID' },
      });
    }

    const column = kind === 'logo' ? 'logo_url' : 'stamp_url';
    const existingRes = await query<{ id: number; url: string | null }>(
      `SELECT id, ${column} AS url FROM clients WHERE id = $1`,
      [clientId]
    );
    if (!existingRes.rows[0]) {
      return res
        .status(404)
        .json({ success: false, message: 'Client not found', error: { code: 'NOT_FOUND' } });
    }
    const priorUrl = existingRes.rows[0].url;

    await query(`UPDATE clients SET ${column} = NULL, updated_at = NOW() WHERE id = $1`, [
      clientId,
    ]);

    if (priorUrl) {
      await safeUnlink(resolveBrandingDiskPath(priorUrl));
    }

    return res.json({ success: true, message: `${kind === 'logo' ? 'Logo' : 'Stamp'} removed` });
  } catch (error) {
    logger.error(`Error deleting client ${kind}:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to remove ${kind}`,
      error: { code: 'INTERNAL_ERROR' },
    });
  }
}

export const uploadClientLogo = (req: AuthenticatedRequest, res: Response) =>
  handleBrandingUpload(req, res, 'logo');
export const uploadClientStamp = (req: AuthenticatedRequest, res: Response) =>
  handleBrandingUpload(req, res, 'stamp');
export const deleteClientLogo = (req: AuthenticatedRequest, res: Response) =>
  handleBrandingDelete(req, res, 'logo');
export const deleteClientStamp = (req: AuthenticatedRequest, res: Response) =>
  handleBrandingDelete(req, res, 'stamp');
