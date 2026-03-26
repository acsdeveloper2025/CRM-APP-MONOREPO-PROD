import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { createAuditLog } from '../utils/auditLogger';

// GET /api/document-types - List document types with pagination and filters
export const getDocumentTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (search && typeof search === 'string') {
      conditions.push(
        `(COALESCE(dt.name, '') ILIKE $${paramIndex} OR COALESCE(dt.code, '') ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort field
    const allowedSortFields = ['name', 'code', 'createdAt', 'updatedAt'];
    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortField: string = allowedSortFields.includes(sortByStr) ? sortByStr : 'name';
    const sortDirection: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "documentTypes" dt
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get document types with client and product counts
    const documentTypesQuery = `
      SELECT 
        dt.id,
        dt.name,
        dt.code,
        dt."createdAt",
        dt."updatedAt",
        COALESCE(cdt_count.client_count, 0) as "clientCount",
        COALESCE(pdt_count.product_count, 0) as "productCount"
      FROM "documentTypes" dt
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as client_count
        FROM "clientDocumentTypes"
        GROUP BY "documentTypeId"
      ) cdt_count ON dt.id = cdt_count."documentTypeId"
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as product_count
        FROM "productDocumentTypes"
        GROUP BY "documentTypeId"
      ) pdt_count ON dt.id = pdt_count."documentTypeId"
      ${whereClause}
      ORDER BY dt."${sortField}" ${sortDirection}
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
        dt."createdAt",
        dt."updatedAt",
        COALESCE(cdt_count.client_count, 0) as "clientCount",
        COALESCE(pdt_count.product_count, 0) as "productCount"
      FROM "documentTypes" dt
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as client_count
        FROM "clientDocumentTypes"
        GROUP BY "documentTypeId"
      ) cdt_count ON dt.id = cdt_count."documentTypeId"
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as product_count
        FROM "productDocumentTypes"
        GROUP BY "documentTypeId"
      ) pdt_count ON dt.id = pdt_count."documentTypeId"
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
    const existingResult = await query(`SELECT id FROM "documentTypes" WHERE code = $1`, [code]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Document type code already exists',
        error: { code: 'DUPLICATE_CODE' },
      });
    }

    // Create document type
    const createQuery = `
      INSERT INTO "documentTypes" (name, code, created_by)
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
        createdAt: newDocumentType.createdAt,
        updatedAt: newDocumentType.updatedAt,
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
    const existingResult = await query(`SELECT id, name, description, "isActive", "createdAt", "updatedAt" FROM "documentTypes" WHERE id = $1`, [Number(id)]);

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
        `SELECT id FROM "documentTypes" WHERE code = $1 AND id != $2`,
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

    const fieldMappings: Record<string, string> = { name: 'name', code: 'code' };

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
    updateValues.push(req.user?.id);
    paramIndex++;

    updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    // Add ID for WHERE clause
    updateValues.push(Number(id));

    const updateQuery = `
      UPDATE "documentTypes"
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
        createdAt: updatedDocumentType.createdAt,
        updatedAt: updatedDocumentType.updatedAt,
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
    const existingResult = await query(`SELECT id, name, description, "isActive", "createdAt", "updatedAt" FROM "documentTypes" WHERE id = $1`, [Number(id)]);

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
      `SELECT COUNT(*) as count FROM "clientDocumentTypes" WHERE "documentTypeId" = $1`,
      `SELECT COUNT(*) as count FROM "productDocumentTypes" WHERE "documentTypeId" = $1`,
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
    await query(`DELETE FROM "documentTypes" WHERE id = $1`, [Number(id)]);

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

// GET /api/document-types/stats - Get document type statistics
export const getDocumentTypeStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsQuery = `SELECT COUNT(*) as total_document_types FROM "documentTypes"`;
    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    const response = {
      success: true,
      data: {
        totalDocumentTypes: parseInt(stats.total_document_types),
        activeDocumentTypes: parseInt(stats.total_document_types),
        inactiveDocumentTypes: 0,
        governmentIssuedCount: 0,
        requiresVerificationCount: 0,
        documentTypesByCategory: [],
      },
    };

    logger.info('Retrieved document type statistics', {
      userId: req.user?.id,
      totalDocumentTypes: response.data.totalDocumentTypes,
    });

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving document type statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document type statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
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
