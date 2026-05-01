import type { Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/config/logger';
import { invalidateAuthContextCache, type AuthenticatedRequest } from '@/middleware/auth';
import { invalidateClientScopeCache } from '@/middleware/clientAccess';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { config } from '@/config';
import { getAssignedProductIds } from '@/middleware/productAccess';
import { isScopedOperationsUser } from '@/security/rbacAccess';
import { createAuditLog } from '@/utils/auditLogger';
import { sendError } from '@/utils/apiResponse';

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

      // Load verification types via client+product junction
      const vtMapRes = await query(
        `SELECT DISTINCT cp.client_id, vt.id, vt.name, vt.code
         FROM client_product_verifications cpv
         JOIN client_products cp ON cp.id = cpv.client_product_id
         JOIN verification_types vt ON cpv.verification_type_id = vt.id
         WHERE cp.client_id = ANY($1::integer[])`,
        [dbClientIds.map(Number)]
      );
      vtMapRes.rows.forEach(r => {
        const arr = vtsByClient.get(r.clientId) || [];
        arr.push({ id: r.id, name: r.name, code: r.code });
        vtsByClient.set(r.clientId, arr);
      });

      // Load document types via client+product junction (DISTINCT across products)
      const dtMapRes = await query(
        `SELECT DISTINCT cp.client_id, dt.id, dt.name, dt.code
         FROM client_product_documents cpd
         JOIN client_products cp ON cp.id = cpd.client_product_id
         JOIN document_types dt ON cpd.document_type_id = dt.id
         WHERE cp.client_id = ANY($1::integer[])`,
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

    // Load verification types via client+product junction
    const vtRes = await query(
      `SELECT DISTINCT vt.id, vt.name, vt.code
       FROM client_product_verifications cpv
       JOIN client_products cp ON cp.id = cpv.client_product_id
       JOIN verification_types vt ON cpv.verification_type_id = vt.id
       WHERE cp.client_id = $1`,
      [Number(id)]
    );

    // Load document types via client+product junction (DISTINCT across products)
    const dtRes = await query(
      `SELECT DISTINCT dt.id, dt.name, dt.code
       FROM client_product_documents cpd
       JOIN client_products cp ON cp.id = cpd.client_product_id
       JOIN document_types dt ON cpd.document_type_id = dt.id
       WHERE cp.client_id = $1`,
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

// GET /api/clients/:clientId/products/:productId/verification-types
// Returns only the VTs mapped to this exact (client, product) tuple.
export const getVerificationTypesForClientProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const clientId = Number(req.params.clientId);
    const productId = Number(req.params.productId);
    const r = await query(
      `SELECT vt.id, vt.name, vt.code, vt.description, vt.is_active
         FROM client_product_verifications cpv
         JOIN client_products cp ON cp.id = cpv.client_product_id
         JOIN verification_types vt ON cpv.verification_type_id = vt.id
        WHERE cp.client_id = $1 AND cp.product_id = $2 AND cpv.is_active = true
        ORDER BY vt.name`,
      [clientId, productId]
    );
    res.json({ success: true, data: r.rows });
  } catch (error) {
    logger.error('Error retrieving VTs for client+product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/clients/:clientId/products/:productId/document-types
// Returns only the DocTypes mapped to this exact (client, product) tuple.
export const getDocumentTypesForClientProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const clientId = Number(req.params.clientId);
    const productId = Number(req.params.productId);
    const r = await query(
      `SELECT dt.id, dt.name, dt.code, dt.category, dt.sort_order, dt.custom_fields,
              cpd.is_mandatory, cpd.display_order
         FROM client_product_documents cpd
         JOIN client_products cp ON cp.id = cpd.client_product_id
         JOIN document_types dt ON cpd.document_type_id = dt.id
        WHERE cp.client_id = $1 AND cp.product_id = $2 AND cpd.is_active = true
        ORDER BY cpd.display_order ASC, dt.name ASC`,
      [clientId, productId]
    );
    res.json({ success: true, data: r.rows });
  } catch (error) {
    logger.error('Error retrieving DocTypes for client+product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document types',
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
      productMappings,
    } = req.body as {
      name: string;
      code: string;
      productIds?: (number | string)[];
      verificationTypeIds?: (number | string)[];
      documentTypeIds?: (number | string)[];
      productMappings?: Array<{
        productId: number;
        verificationTypeIds: number[];
        documentTypeIds: number[];
      }>;
    };

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

      // Insert client_products and capture client_product_id per product for downstream VT/DocType
      const clientProductIdByProduct = new Map<number, number>();
      if (productIds.length > 0) {
        const uniqueProductIds = Array.from(new Set(productIds.map(Number)));
        const prodCheck = await cx.query(`SELECT id FROM products WHERE id = ANY($1::integer[])`, [
          uniqueProductIds,
        ]);
        if (prodCheck.rowCount !== uniqueProductIds.length) {
          throw Object.assign(new Error('One or more products not found'), {
            code: 'PRODUCTS_NOT_FOUND',
          });
        }
        for (const pid of uniqueProductIds) {
          const cpInsert = await cx.query(
            `INSERT INTO client_products (client_id, product_id, is_active, created_at, updated_at)
             VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
            [created.id, Number(pid)]
          );
          clientProductIdByProduct.set(Number(pid), cpInsert.rows[0].id);
        }
      }

      // If productMappings provided (canonical shape), use per-product VTs/DocTypes;
      // otherwise fall back to spreading flat lists across every client_product.
      const useGranularMappings = Array.isArray(productMappings) && productMappings.length > 0;

      if (useGranularMappings) {
        for (const mapping of productMappings) {
          const cpId = clientProductIdByProduct.get(Number(mapping.productId));
          if (!cpId) {
            continue;
          }
          for (const vtId of mapping.verificationTypeIds) {
            await cx.query(
              `INSERT INTO client_product_verifications (client_product_id, verification_type_id, is_active, created_at, updated_at)
               VALUES ($1, $2, true, NOW(), NOW())
               ON CONFLICT (client_product_id, verification_type_id) DO NOTHING`,
              [cpId, Number(vtId)]
            );
          }
          for (const dtId of mapping.documentTypeIds) {
            await cx.query(
              `INSERT INTO client_product_documents (client_product_id, document_type_id, is_active, created_at, updated_at)
               VALUES ($1, $2, true, NOW(), NOW())
               ON CONFLICT (client_product_id, document_type_id) DO NOTHING`,
              [cpId, Number(dtId)]
            );
          }
        }
      } else {
        // Backward-compat: spread flat lists across every client_product
        if (clientProductIdByProduct.size > 0 && verificationTypeIds.length > 0) {
          const uniqueVtIds = Array.from(new Set(verificationTypeIds.map(Number)));
          for (const cpId of clientProductIdByProduct.values()) {
            for (const vtId of uniqueVtIds) {
              await cx.query(
                `INSERT INTO client_product_verifications (client_product_id, verification_type_id, is_active, created_at, updated_at)
                 VALUES ($1, $2, true, NOW(), NOW())
                 ON CONFLICT (client_product_id, verification_type_id) DO NOTHING`,
                [cpId, vtId]
              );
            }
          }
        }
        if (clientProductIdByProduct.size > 0 && documentTypeIds.length > 0) {
          const uniqueDtIds = Array.from(new Set(documentTypeIds.map(Number)));
          const dtCheck = await cx.query(
            `SELECT id FROM document_types WHERE id = ANY($1::integer[])`,
            [uniqueDtIds]
          );
          if (dtCheck.rowCount !== uniqueDtIds.length) {
            throw Object.assign(new Error('One or more document types not found'), {
              code: 'DOCUMENT_TYPES_NOT_FOUND',
            });
          }
          for (const cpId of clientProductIdByProduct.values()) {
            for (const dtId of uniqueDtIds) {
              await cx.query(
                `INSERT INTO client_product_documents (client_product_id, document_type_id, is_active, created_at, updated_at)
                 VALUES ($1, $2, true, NOW(), NOW())
                 ON CONFLICT (client_product_id, document_type_id) DO NOTHING`,
                [cpId, dtId]
              );
            }
          }
        }
      }

      const prodRes2 = await cx.query(
        `SELECT p.id, p.name, p.code FROM client_products cp JOIN products p ON p.id = cp.product_id WHERE cp.client_id = $1`,
        [created.id]
      );

      const vtRes2 = await cx.query(
        `SELECT DISTINCT vt.id, vt.name, vt.code
         FROM client_product_verifications cpv
         JOIN client_products cp ON cp.id = cpv.client_product_id
         JOIN verification_types vt ON cpv.verification_type_id = vt.id
         WHERE cp.client_id = $1`,
        [created.id]
      );

      const dtRes2 = await cx.query(
        `SELECT DISTINCT dt.id, dt.name, dt.code
         FROM client_product_documents cpd
         JOIN client_products cp ON cp.id = cpd.client_product_id
         JOIN document_types dt ON cpd.document_type_id = dt.id
         WHERE cp.client_id = $1`,
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

        // Get current client_products with their ids
        const clientProductsRes = await cx.query(
          `SELECT id, product_id FROM client_products WHERE client_id = $1`,
          [Number(id)]
        );
        const clientProductIds = clientProductsRes.rows.map(row => row.id);

        if (clientProductIds.length > 0) {
          // Remove VT links not in new set across all of this client's products
          await cx.query(
            `DELETE FROM client_product_verifications
              WHERE client_product_id = ANY($1::integer[])
                AND verification_type_id NOT IN (SELECT UNNEST($2::integer[]))`,
            [clientProductIds, vtIds]
          );

          // Add new VT links per (client_product, vt)
          for (const cpId of clientProductIds) {
            for (const vtId of vtIds) {
              await cx.query(
                `INSERT INTO client_product_verifications (client_product_id, verification_type_id, is_active, created_at, updated_at)
                 VALUES ($1, $2, true, NOW(), NOW())
                 ON CONFLICT (client_product_id, verification_type_id) DO NOTHING`,
                [cpId, vtId]
              );
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
        // Resolve all client_products for this client
        const cpRowsRes = await cx.query(`SELECT id FROM client_products WHERE client_id = $1`, [
          Number(id),
        ]);
        const clientProductIds = cpRowsRes.rows.map(r => r.id);
        if (clientProductIds.length > 0) {
          await cx.query(
            `DELETE FROM client_product_documents
              WHERE client_product_id = ANY($1::integer[])
                AND document_type_id <> ALL($2::integer[])`,
            [clientProductIds, dtIds]
          );
          for (const cpId of clientProductIds) {
            for (const dtId of dtIds) {
              await cx.query(
                `INSERT INTO client_product_documents (client_product_id, document_type_id, is_active, created_at, updated_at)
                 VALUES ($1, $2, true, NOW(), NOW())
                 ON CONFLICT (client_product_id, document_type_id) DO NOTHING`,
                [cpId, dtId]
              );
            }
          }
        }
      }

      const prodRes3 = await cx.query(
        `SELECT p.id, p.name, p.code FROM client_products cp JOIN products p ON p.id = cp.product_id WHERE cp.client_id = $1`,
        [Number(id)]
      );

      const vtRes3 = await cx.query(
        `SELECT DISTINCT vt.id, vt.name, vt.code
         FROM client_product_verifications cpv
         JOIN client_products cp ON cp.id = cpv.client_product_id
         JOIN verification_types vt ON cpv.verification_type_id = vt.id
         WHERE cp.client_id = $1`,
        [Number(id)]
      );

      const dtRes3 = await cx.query(
        `SELECT DISTINCT dt.id, dt.name, dt.code
         FROM client_product_documents cpd
         JOIN client_products cp ON cp.id = cpd.client_product_id
         JOIN document_types dt ON cpd.document_type_id = dt.id
         WHERE cp.client_id = $1`,
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

    // Capture users currently assigned to this client BEFORE the delete
    // so we can invalidate their auth+scope caches after the transaction.
    const affectedUsersRes = await query<{ userId: string }>(
      `SELECT DISTINCT user_id FROM user_client_assignments WHERE client_id = $1`,
      [id]
    );

    // Delete client and related records in a transaction
    await withTransaction(async cx => {
      // Delete related records first (foreign keys with NO ACTION or RESTRICT need manual deletion)
      // Order matters: delete child records before parent records
      await cx.query(`DELETE FROM rates WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM document_type_rates WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM rate_type_assignments WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM client_products WHERE client_id = $1`, [id]);

      // (client_product_documents + client_product_verifications cascade-delete via client_products FK)
      await cx.query(`DELETE FROM user_client_assignments WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM commission_calculations WHERE client_id = $1`, [id]);
      await cx.query(`DELETE FROM field_user_commission_assignments WHERE client_id = $1`, [id]);

      // Finally delete the client
      await cx.query(`DELETE FROM clients WHERE id = $1`, [id]);
    });

    // Invalidate scope caches for every user that lost this assignment.
    for (const row of affectedUsersRes.rows) {
      invalidateAuthContextCache(row.userId);
      invalidateClientScopeCache(row.userId);
    }

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
       FROM client_product_verifications cpv
       JOIN client_products cp ON cp.id = cpv.client_product_id
       JOIN verification_types vt ON cpv.verification_type_id = vt.id
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

// POST /api/clients/bulk-import - CSV bulk upsert. Headers (camelCase):
//   required: name, code
//   optional: email, phone, address, gstin, pan, gstinStateCode,
//             billingAddressLine1, billingAddressLine2, billingPincode,
//             billingCity (name), billingState (name), billingCountry (name),
//             tier, isActive
// Branding (logo/stamp/colors) and timestamps stay out — separate flows.
// Match key is `code`; existing row → UPDATE, else INSERT.
export const bulkImportClients = async (
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

    const ALLOWED_TIERS = ['STARTER', 'GROWTH', 'ENTERPRISE'];
    const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9A-Z]$/;
    const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    const PINCODE_RE = /^[1-9][0-9]{5}$/;
    const STATE_CODE_RE = /^[0-9]{2}$/;

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
        const email = blankToNull(row.email);
        const phone = blankToNull(row.phone);
        const address = blankToNull(row.address);
        const gstin = blankToNull(row.gstin)?.toUpperCase() ?? null;
        const pan = blankToNull(row.pan)?.toUpperCase() ?? null;
        const gstinStateCode = blankToNull(row.gstinStateCode);
        const billingAddressLine1 = blankToNull(row.billingAddressLine1);
        const billingAddressLine2 = blankToNull(row.billingAddressLine2);
        const billingPincode = blankToNull(row.billingPincode);
        const tier = blankToNull(row.tier)?.toUpperCase() ?? null;
        const isActiveRaw = blankToNull(row.isActive);

        // CSV-side validation surfaces clear errors before relying on
        // the table's CHECK constraints (which fail with cryptic Postgres errors).
        if (gstin !== null && !GSTIN_RE.test(gstin)) {
          results.failed++;
          results.errors.push({ row: i + 1, data: row, error: `Invalid GSTIN: ${gstin}` });
          continue;
        }
        if (pan !== null && !PAN_RE.test(pan)) {
          results.failed++;
          results.errors.push({ row: i + 1, data: row, error: `Invalid PAN: ${pan}` });
          continue;
        }
        if (gstinStateCode !== null && !STATE_CODE_RE.test(gstinStateCode)) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: `Invalid gstinStateCode: ${gstinStateCode} (must be 2 digits)`,
          });
          continue;
        }
        if (gstin !== null && gstinStateCode !== null && gstin.substring(0, 2) !== gstinStateCode) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: `gstinStateCode (${gstinStateCode}) does not match GSTIN prefix (${gstin.substring(0, 2)})`,
          });
          continue;
        }
        if (billingPincode !== null && !PINCODE_RE.test(billingPincode)) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: `Invalid billingPincode: ${billingPincode}`,
          });
          continue;
        }
        if (tier !== null && !ALLOWED_TIERS.includes(tier)) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: `Invalid tier: ${tier}. Must be one of ${ALLOWED_TIERS.join(', ')}`,
          });
          continue;
        }
        const isActive: boolean | null =
          isActiveRaw === null
            ? null
            : ['true', '1', 'yes', 'y'].includes(isActiveRaw.toLowerCase());

        // FK lookups by NAME — country/state/city must already exist
        // (auto-create removed across location imports for the same reason).
        let billingCountryId: number | null = null;
        if (blankToNull(row.billingCountry)) {
          const r = await query<{ id: number }>(
            'SELECT id FROM countries WHERE LOWER(name) = LOWER($1)',
            [row.billingCountry.trim()]
          );
          if (r.rows.length === 0) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              data: row,
              error: `billingCountry "${row.billingCountry}" not found.`,
            });
            continue;
          }
          billingCountryId = r.rows[0].id;
        }

        let billingStateId: number | null = null;
        if (blankToNull(row.billingState)) {
          const stateName = row.billingState.trim();
          const r = billingCountryId
            ? await query<{ id: number }>(
                'SELECT id FROM states WHERE LOWER(name) = LOWER($1) AND country_id = $2',
                [stateName, billingCountryId]
              )
            : await query<{ id: number }>('SELECT id FROM states WHERE LOWER(name) = LOWER($1)', [
                stateName,
              ]);
          if (r.rows.length === 0) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              data: row,
              error: `billingState "${stateName}" not found.`,
            });
            continue;
          }
          billingStateId = r.rows[0].id;
        }

        let billingCityId: number | null = null;
        if (blankToNull(row.billingCity)) {
          const cityName = row.billingCity.trim();
          const r = billingStateId
            ? await query<{ id: number }>(
                'SELECT id FROM cities WHERE LOWER(name) = LOWER($1) AND state_id = $2',
                [cityName, billingStateId]
              )
            : await query<{ id: number }>('SELECT id FROM cities WHERE LOWER(name) = LOWER($1)', [
                cityName,
              ]);
          if (r.rows.length === 0) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              data: row,
              error: `billingCity "${cityName}" not found.`,
            });
            continue;
          }
          billingCityId = r.rows[0].id;
        }

        const existing = await query<{ id: number }>(
          'SELECT id FROM clients WHERE code = $1 AND deleted_at IS NULL',
          [code]
        );

        if (existing.rows.length > 0) {
          await query(
            `UPDATE clients SET
               name = $1,
               email = COALESCE($2, email),
               phone = COALESCE($3, phone),
               address = COALESCE($4, address),
               gstin = COALESCE($5, gstin),
               pan = COALESCE($6, pan),
               gstin_state_code = COALESCE($7, gstin_state_code),
               billing_address_line1 = COALESCE($8, billing_address_line1),
               billing_address_line2 = COALESCE($9, billing_address_line2),
               billing_pincode = COALESCE($10, billing_pincode),
               billing_country_id = COALESCE($11, billing_country_id),
               billing_state_id = COALESCE($12, billing_state_id),
               billing_city_id = COALESCE($13, billing_city_id),
               tier = COALESCE($14, tier),
               is_active = COALESCE($15, is_active),
               updated_at = NOW()
             WHERE code = $16 AND deleted_at IS NULL`,
            [
              name,
              email,
              phone,
              address,
              gstin,
              pan,
              gstinStateCode,
              billingAddressLine1,
              billingAddressLine2,
              billingPincode,
              billingCountryId,
              billingStateId,
              billingCityId,
              tier,
              isActive,
              code,
            ]
          );
          results.updated++;
        } else {
          await query(
            `INSERT INTO clients (
               name, code, email, phone, address, gstin, pan, gstin_state_code,
               billing_address_line1, billing_address_line2, billing_pincode,
               billing_country_id, billing_state_id, billing_city_id, tier, is_active
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               COALESCE($16, true)
             )`,
            [
              name,
              code,
              email,
              phone,
              address,
              gstin,
              pan,
              gstinStateCode,
              billingAddressLine1,
              billingAddressLine2,
              billingPincode,
              billingCountryId,
              billingStateId,
              billingCityId,
              tier,
              isActive,
            ]
          );
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          data: row,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Error importing client at row ${i + 1}:`, error);
      }
    }

    logger.info('Bulk import clients completed', { userId: req.user?.id, results });
    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    logger.error('Error in bulk import clients:', error);
    return sendError(res, 500, 'Failed to bulk import clients', 'INTERNAL_ERROR');
  }
};
