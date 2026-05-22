import type { Response } from 'express';
import ExcelJS from 'exceljs';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { createAuditLog } from '../utils/auditLogger';
import { escapeFormulaRow } from '../utils/formulaGuard';

// Shared WHERE-clause builder for getDocumentTypes + exportDocumentTypes so
// the two stay in lockstep. Note: this controller's getDocumentTypes uses
// `dt.` table alias for document_types (joins on mapping subqueries) — the
// helper emits clauses with the same alias.
const buildDocumentTypesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: (string | number | boolean)[]; nextParamIndex: number } => {
  const { search, isActive, createdFrom, createdTo } = req.query;
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (search && typeof search === 'string') {
    conditions.push(
      `(COALESCE(dt.name, '') ILIKE $${paramIndex} OR COALESCE(dt.code, '') ILIKE $${paramIndex})`
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (typeof isActive === 'boolean') {
    conditions.push(`dt.is_active = $${paramIndex}`);
    params.push(isActive);
    paramIndex++;
  } else if (isActive === 'true' || isActive === 'false') {
    conditions.push(`dt.is_active = $${paramIndex}`);
    params.push(isActive === 'true');
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    conditions.push(`dt.created_at >= $${paramIndex}`);
    params.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    conditions.push(`dt.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    params.push(createdTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, queryParams: params, nextParamIndex: paramIndex };
};

// GET /api/document-types - List document types with pagination and filters
export const getDocumentTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const {
      whereClause,
      queryParams: params,
      nextParamIndex: paramIndex,
    } = buildDocumentTypesWhereClause(req);

    // API contract: sortBy is camelCase; map to snake_case DB column.
    const sortColumnMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortField: string = sortColumnMap[sortByStr] || 'name';
    const sortDirection: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM document_types dt
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get document types with client and product counts + status.
    const documentTypesQuery = `
      SELECT
        dt.id,
        dt.name,
        dt.code,
        dt.is_active,
        dt.created_at,
        dt.updated_at,
        COALESCE(cdt_count.client_count, 0) as "clientCount",
        COALESCE(pdt_count.product_count, 0) as "productCount"
      FROM document_types dt
      LEFT JOIN (
        SELECT cpd.document_type_id, COUNT(DISTINCT cp.client_id) as client_count
        FROM client_product_documents cpd
        JOIN client_products cp ON cp.id = cpd.client_product_id
        GROUP BY cpd.document_type_id
      ) cdt_count ON dt.id = cdt_count.document_type_id
      LEFT JOIN (
        SELECT cpd.document_type_id, COUNT(DISTINCT cp.product_id) as product_count
        FROM client_product_documents cpd
        JOIN client_products cp ON cp.id = cpd.client_product_id
        GROUP BY cpd.document_type_id
      ) pdt_count ON dt.id = pdt_count.document_type_id
      ${whereClause}
      ORDER BY dt.${sortField} ${sortDirection}, dt.id ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(Number(limit), offset);
    const documentTypesResult = await query(documentTypesQuery, params);

    const response = {
      success: true,
      data: documentTypesResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };

    logger.info(`Retrieved ${documentTypesResult.rows.length} document types`, {
      userId: req.user?.id,
      page: Number(page),
      limit: Number(limit),
      total,
    });

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving document types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/document-types/:id - Get document type by ID
export const getDocumentTypeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    const documentTypeQuery = `
      SELECT 
        dt.id,
        dt.name,
        dt.code,
        dt.created_at,
        dt.updated_at,
        COALESCE(cdt_count.client_count, 0) as "client_count",
        COALESCE(pdt_count.product_count, 0) as "product_count"
      FROM document_types dt
      LEFT JOIN (
        SELECT cpd.document_type_id, COUNT(DISTINCT cp.client_id) as client_count
        FROM client_product_documents cpd
        JOIN client_products cp ON cp.id = cpd.client_product_id
        GROUP BY cpd.document_type_id
      ) cdt_count ON dt.id = cdt_count.document_type_id
      LEFT JOIN (
        SELECT cpd.document_type_id, COUNT(DISTINCT cp.product_id) as product_count
        FROM client_product_documents cpd
        JOIN client_products cp ON cp.id = cpd.client_product_id
        GROUP BY cpd.document_type_id
      ) pdt_count ON dt.id = pdt_count.document_type_id
      WHERE dt.id = $1
    `;

    const result = await query(documentTypeQuery, [Number(id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
        error: { code: 'DOCUMENT_TYPE_NOT_FOUND' },
      });
    }

    logger.info(`Retrieved document type: ${id}`, {
      userId: req.user?.id,
      documentTypeId: id,
    });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error retrieving document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/document-types - Create new document type
export const createDocumentType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code } = req.body;

    // Check if document type code already exists
    const existingResult = await query(`SELECT id FROM document_types WHERE code = $1`, [code]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Document type code already exists',
        error: { code: 'DUPLICATE_CODE' },
      });
    }

    // Create document type
    const createQuery = `
      INSERT INTO document_types (name, code, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await query(createQuery, [name, code, req.user?.id]);

    const newDocumentType = result.rows[0];

    // Create audit log
    await createAuditLog({
      userId: req.user?.id,
      action: 'CREATE',
      entityType: 'DOCUMENT_TYPE',
      entityId: newDocumentType.id.toString(),
      details: { documentTypeName: name, documentTypeCode: code },
    });

    logger.info(`Created new document type: ${newDocumentType.id}`, {
      userId: req.user?.id,
      documentTypeName: name,
      documentTypeCode: code,
    });

    res.status(201).json({
      success: true,
      data: {
        id: newDocumentType.id,
        name: newDocumentType.name,
        code: newDocumentType.code,
        createdAt: newDocumentType.created_at,
        updatedAt: newDocumentType.updated_at,
      },
      message: 'Document type created successfully',
    });
  } catch (error) {
    logger.error('Error creating document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create document type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/document-types/:id - Update document type
export const updateDocumentType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const updateData = req.body;

    // Check if document type exists
    const existingResult = await query(
      `SELECT id, name, description, is_active, created_at, updated_at FROM document_types WHERE id = $1`,
      [Number(id)]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
        error: { code: 'DOCUMENT_TYPE_NOT_FOUND' },
      });
    }

    // Check for duplicate code if code is being updated
    if (updateData.code) {
      const duplicateResult = await query(
        `SELECT id FROM document_types WHERE code = $1 AND id != $2`,
        [updateData.code, Number(id)]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Document type code already exists',
          error: { code: 'DUPLICATE_CODE' },
        });
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      name: 'name',
      code: 'code',
      isActive: 'is_active',
    };

    Object.keys(updateData).forEach(key => {
      if (fieldMappings[key] && updateData[key] !== undefined) {
        updateFields.push(`${fieldMappings[key]} = $${paramIndex}`);
        updateValues.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
        error: { code: 'NO_UPDATE_FIELDS' },
      });
    }

    // Add updated_by and updated_at
    updateFields.push(`updated_by = $${paramIndex}`);
    updateValues.push(req.user!.id);
    paramIndex++;

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add ID for WHERE clause
    updateValues.push(Number(id));

    const updateQuery = `
      UPDATE document_types
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);
    const updatedDocumentType = result.rows[0];

    // Create audit log
    await createAuditLog({
      userId: req.user?.id,
      action: 'UPDATE',
      entityType: 'DOCUMENT_TYPE',
      entityId: id,
      details: {
        updatedFields: Object.keys(updateData),
        documentTypeName: updatedDocumentType.name,
      },
    });

    logger.info(`Updated document type: ${id}`, {
      userId: req.user?.id,
      documentTypeId: id,
      updatedFields: Object.keys(updateData),
    });

    res.json({
      success: true,
      data: {
        id: updatedDocumentType.id,
        name: updatedDocumentType.name,
        code: updatedDocumentType.code,
        createdAt: updatedDocumentType.created_at,
        updatedAt: updatedDocumentType.updated_at,
      },
      message: 'Document type updated successfully',
    });
  } catch (error) {
    logger.error('Error updating document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update document type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/document-types/:id - Delete document type
export const deleteDocumentType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    // Check if document type exists
    const existingResult = await query(
      `SELECT id, name, description, is_active, created_at, updated_at FROM document_types WHERE id = $1`,
      [Number(id)]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
        error: { code: 'DOCUMENT_TYPE_NOT_FOUND' },
      });
    }

    const documentType = existingResult.rows[0];

    // Check if document type is being used
    const usageCheckQueries = [
      `SELECT COUNT(*) as count FROM client_product_documents WHERE document_type_id = $1`,
      `SELECT COUNT(*) as count FROM verification_tasks WHERE document_type_id = $1`,
      `SELECT COUNT(*) as count FROM cases WHERE document_type_id = $1`,
    ];

    let totalUsage = 0;
    for (const usageQuery of usageCheckQueries) {
      try {
        const usageResult = await query(usageQuery, [Number(id)]);
        totalUsage += parseInt(usageResult.rows[0].count);
      } catch (error) {
        // Table might not exist, continue
        logger.warn(`Usage check query failed: ${usageQuery}`, error);
      }
    }

    if (totalUsage > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete document type as it is being used',
        error: {
          code: 'DOCUMENT_TYPE_IN_USE',
          details: { usageCount: totalUsage },
        },
      });
    }

    // Delete document type
    await query(`DELETE FROM document_types WHERE id = $1`, [Number(id)]);

    // Create audit log
    await createAuditLog({
      userId: req.user?.id,
      action: 'DELETE',
      entityType: 'DOCUMENT_TYPE',
      entityId: id,
      details: {
        documentTypeName: documentType.name,
        documentTypeCode: documentType.code,
      },
    });

    logger.info(`Deleted document type: ${id}`, {
      userId: req.user?.id,
      documentTypeId: id,
      documentTypeName: documentType.name,
    });

    res.json({
      success: true,
      message: 'Document type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document type',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/document-types/stats - 5-card stats aggregate for
// DocumentTypesPage shell. Real numbers (the prior stub claimed
// active=total which was wrong as soon as anything was disabled).
// mappedCount = doctypes referenced by at least one client_product
// mapping — surfaces unused doctypes.
export const getDocumentTypeStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as recently_added_count,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM client_product_documents cpd WHERE cpd.document_type_id = document_types.id
        ) THEN 1 END)::int as mapped_count
      FROM document_types
    `);
    const row = statsRes.rows[0] || {};
    const stats = {
      // Canonical 5-card shape — same keys as other Client Mgmt pages.
      total: row.total ?? 0,
      active: row.active ?? 0,
      inactive: row.inactive ?? 0,
      recentlyAddedCount: row.recently_added_count ?? 0,
      mappedCount: row.mapped_count ?? 0,
      // Legacy aliases kept for downstream consumers that haven't
      // migrated yet (see services/documentTypes.ts DocumentTypeStats).
      totalDocumentTypes: row.total ?? 0,
      activeDocumentTypes: row.active ?? 0,
      inactiveDocumentTypes: row.inactive ?? 0,
      governmentIssuedCount: 0,
      requiresVerificationCount: 0,
      documentTypesByCategory: [] as unknown[],
    };

    res.json({
      success: true,
      data: stats,
      message: 'Document type statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving document type statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document type statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/document-types/export - xlsx download mirroring list filters.
const EXPORT_ROW_LIMIT = 10000;

export const exportDocumentTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;
    const {
      whereClause,
      queryParams: params,
      nextParamIndex: paramIndex,
    } = buildDocumentTypesWhereClause(req);

    const sortColumnMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortField = sortColumnMap[sortByStr] || 'name';
    const sortDirection: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query<{
      id: number;
      name: string;
      code: string;
      isActive: boolean;
      createdAt: Date;
      clientCount: number;
      productCount: number;
    }>(
      `SELECT
         dt.id,
         dt.name,
         dt.code,
         dt.is_active,
         dt.created_at,
         COALESCE(cdt_count.client_count, 0) as "clientCount",
         COALESCE(pdt_count.product_count, 0) as "productCount"
       FROM document_types dt
       LEFT JOIN (
         SELECT cpd.document_type_id, COUNT(DISTINCT cp.client_id) as client_count
         FROM client_product_documents cpd
         JOIN client_products cp ON cp.id = cpd.client_product_id
         GROUP BY cpd.document_type_id
       ) cdt_count ON dt.id = cdt_count.document_type_id
       LEFT JOIN (
         SELECT cpd.document_type_id, COUNT(DISTINCT cp.product_id) as product_count
         FROM client_product_documents cpd
         JOIN client_products cp ON cp.id = cpd.client_product_id
         GROUP BY cpd.document_type_id
       ) pdt_count ON dt.id = pdt_count.document_type_id
       ${whereClause}
       ORDER BY dt.${sortField} ${sortDirection}, dt.id ASC
       LIMIT $${paramIndex}`,
      [...params, EXPORT_ROW_LIMIT]
    );
    const rows = listRes.rows;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Document Types');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 20 },
      { header: 'Clients', key: 'clientCount', width: 10 },
      { header: 'Products', key: 'productCount', width: 10 },
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
          clientCount: r.clientCount,
          productCount: r.productCount,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        })
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `document_types_${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    void createAuditLog({
      action: 'DOCUMENT_TYPE_EXPORTED',
      entityType: 'DOCUMENT_TYPE',
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
          sortOrder: sortDirection.toLowerCase(),
        },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    await workbook.xlsx.write(res);
    res.end();
    logger.info(`Document types exported: ${filename}, ${rows.length} rows`);
  } catch (error) {
    logger.error('Error exporting document types:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export document types',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
};

// GET /api/document-types/categories - Get document type categories
export const getDocumentTypeCategories = (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    logger.error('Error retrieving document type categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document type categories',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
