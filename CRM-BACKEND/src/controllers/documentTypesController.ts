import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { createAuditLog } from '../utils/auditLogger';

// GET /api/document-types - List document types with pagination and filters
export const getDocumentTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      isActive,
      isGovernmentIssued,
      requiresVerification,
      sortBy = 'sort_order',
      sortOrder = 'asc',
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (search && typeof search === 'string') {
      conditions.push(
        `(COALESCE(dt.name, '') ILIKE $${paramIndex} OR COALESCE(dt.code, '') ILIKE $${paramIndex} OR COALESCE(dt.description, '') ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`dt.category = $${paramIndex}`);
      params.push(category as string);
      paramIndex++;
    }

    if (isActive !== undefined) {
      conditions.push(`dt.is_active = $${paramIndex}`);
      params.push(typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive));
      paramIndex++;
    }

    if (isGovernmentIssued !== undefined) {
      conditions.push(`dt.is_government_issued = $${paramIndex}`);
      params.push(
        typeof isGovernmentIssued === 'string'
          ? isGovernmentIssued === 'true'
          : Boolean(isGovernmentIssued)
      );
      paramIndex++;
    }

    if (requiresVerification !== undefined) {
      conditions.push(`dt.requires_verification = $${paramIndex}`);
      params.push(
        typeof requiresVerification === 'string'
          ? requiresVerification === 'true'
          : Boolean(requiresVerification)
      );
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort field
    const allowedSortFields = [
      'name',
      'code',
      'category',
      'sort_order',
      'created_at',
      'updated_at',
    ];
    const sortByStr = typeof sortBy === 'string' ? sortBy : 'sort_order';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortField: string = allowedSortFields.includes(sortByStr) ? sortByStr : 'sort_order';
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
        dt.description,
        dt.category,
        dt.is_government_issued as "isGovernmentIssued",
        dt.requires_verification as "requiresVerification",
        dt.validity_period_months as "validityPeriodMonths",
        dt.format_pattern as "formatPattern",
        dt.min_length as "minLength",
        dt.max_length as "maxLength",
        dt.is_active as "isActive",
        dt.sort_order as "sortOrder",
        dt."createdAt",
        dt."updatedAt",
        COALESCE(cdt_count.client_count, 0) as "clientCount",
        COALESCE(pdt_count.product_count, 0) as "productCount"
      FROM "documentTypes" dt
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as client_count
        FROM "clientDocumentTypes"
        WHERE is_active = true
        GROUP BY "documentTypeId"
      ) cdt_count ON dt.id = cdt_count."documentTypeId"
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as product_count
        FROM "productDocumentTypes"
        WHERE is_active = true
        GROUP BY "documentTypeId"
      ) pdt_count ON dt.id = pdt_count."documentTypeId"
      ${whereClause}
      ORDER BY dt.${sortField} ${sortDirection}
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
    const { id } = req.params;

    const documentTypeQuery = `
      SELECT 
        dt.id,
        dt.name,
        dt.code,
        dt.description,
        dt.category,
        dt.is_government_issued as "isGovernmentIssued",
        dt.requires_verification as "requiresVerification",
        dt.validity_period_months as "validityPeriodMonths",
        dt.format_pattern as "formatPattern",
        dt.min_length as "minLength",
        dt.max_length as "maxLength",
        dt.is_active as "isActive",
        dt.sort_order as "sortOrder",
        dt."createdAt",
        dt."updatedAt",
        COALESCE(cdt_count.client_count, 0) as "clientCount",
        COALESCE(pdt_count.product_count, 0) as "productCount"
      FROM "documentTypes" dt
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as client_count
        FROM "clientDocumentTypes"
        WHERE is_active = true
        GROUP BY "documentTypeId"
      ) cdt_count ON dt.id = cdt_count."documentTypeId"
      LEFT JOIN (
        SELECT "documentTypeId", COUNT(*) as product_count
        FROM "productDocumentTypes"
        WHERE is_active = true
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
    const {
      name,
      code,
      description,
      category,
      isGovernmentIssued = true,
      requiresVerification = true,
      validityPeriodMonths,
      formatPattern,
      minLength,
      maxLength,
      sortOrder = 0,
    } = req.body;

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
      INSERT INTO "documentTypes" (
        name, code, description, category, is_government_issued, 
        requires_verification, validity_period_months, format_pattern,
        min_length, max_length, sort_order, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await query(createQuery, [
      name,
      code,
      description,
      category,
      isGovernmentIssued,
      requiresVerification,
      validityPeriodMonths,
      formatPattern,
      minLength,
      maxLength,
      sortOrder,
      req.user?.id,
    ]);

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
        description: newDocumentType.description,
        category: newDocumentType.category,
        isGovernmentIssued: newDocumentType.is_government_issued,
        requiresVerification: newDocumentType.requires_verification,
        validityPeriodMonths: newDocumentType.validity_period_months,
        formatPattern: newDocumentType.format_pattern,
        minLength: newDocumentType.min_length,
        maxLength: newDocumentType.max_length,
        isActive: newDocumentType.is_active,
        sortOrder: newDocumentType.sort_order,
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
    const { id } = req.params;
    const updateData = req.body;

    // Check if document type exists
    const existingResult = await query(`SELECT * FROM "documentTypes" WHERE id = $1`, [Number(id)]);

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

    const fieldMappings: Record<string, string> = {
      name: 'name',
      code: 'code',
      description: 'description',
      category: 'category',
      isGovernmentIssued: 'is_government_issued',
      requiresVerification: 'requires_verification',
      validityPeriodMonths: 'validity_period_months',
      formatPattern: 'format_pattern',
      minLength: 'min_length',
      maxLength: 'max_length',
      isActive: 'is_active',
      sortOrder: 'sort_order',
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
        description: updatedDocumentType.description,
        category: updatedDocumentType.category,
        isGovernmentIssued: updatedDocumentType.is_government_issued,
        requiresVerification: updatedDocumentType.requires_verification,
        validityPeriodMonths: updatedDocumentType.validity_period_months,
        formatPattern: updatedDocumentType.format_pattern,
        minLength: updatedDocumentType.min_length,
        maxLength: updatedDocumentType.max_length,
        isActive: updatedDocumentType.is_active,
        sortOrder: updatedDocumentType.sort_order,
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
    const { id } = req.params;

    // Check if document type exists
    const existingResult = await query(`SELECT * FROM "documentTypes" WHERE id = $1`, [Number(id)]);

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
    // Get basic stats
    const statsQuery = `
      SELECT
        COUNT(*) as total_document_types,
        COUNT(*) FILTER (WHERE is_active = true) as active_document_types,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_document_types,
        COUNT(*) FILTER (WHERE is_government_issued = true) as government_issued_count,
        COUNT(*) FILTER (WHERE requires_verification = true) as requires_verification_count
      FROM "documentTypes"
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    // Get document types by category
    const categoryQuery = `
      SELECT
        category,
        COUNT(*) as count
      FROM "documentTypes"
      WHERE is_active = true
      GROUP BY category
      ORDER BY count DESC
    `;

    const categoryResult = await query(categoryQuery);

    const response = {
      success: true,
      data: {
        totalDocumentTypes: parseInt(stats.total_document_types),
        activeDocumentTypes: parseInt(stats.active_document_types),
        inactiveDocumentTypes: parseInt(stats.inactive_document_types),
        governmentIssuedCount: parseInt(stats.government_issued_count),
        requiresVerificationCount: parseInt(stats.requires_verification_count),
        documentTypesByCategory: categoryResult.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count),
        })),
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
export const getDocumentTypeCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categoriesQuery = `
      SELECT DISTINCT category
      FROM "documentTypes"
      WHERE is_active = true
      ORDER BY category
    `;

    const result = await query(categoriesQuery);
    const categories = result.rows.map(row => row.category);

    res.json({
      success: true,
      data: categories,
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
