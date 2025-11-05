import type { Response } from 'express';
import { Request } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query, withTransaction } from '../config/database';
import { createAuditLog } from '../utils/auditLogger';

// GET /api/clients/:id/document-types - Get document types mapped to a client
export const getDocumentTypesByClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: clientId } = req.params;
    const { isActive } = req.query as { isActive?: string };

    // Build where clause for active filter
    const whereClause = isActive !== undefined ? 'AND cdt.is_active = $2' : '';
    const params =
      isActive !== undefined ? [Number(clientId), String(isActive) === 'true'] : [Number(clientId)];

    const documentTypesQuery = `
      SELECT DISTINCT 
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
        cdt.is_required as "isRequired",
        cdt.priority,
        cdt.client_specific_rules as "clientSpecificRules"
      FROM "clientDocumentTypes" cdt
      JOIN "documentTypes" dt ON cdt."documentTypeId" = dt.id
      WHERE cdt."clientId" = $1 ${whereClause}
      ORDER BY cdt.priority ASC, dt.sort_order ASC, dt.name ASC
    `;

    const result = await query(documentTypesQuery, params);

    logger.info(`Retrieved ${result.rows.length} document types for client ${clientId}`, {
      userId: req.user?.id,
      clientId,
    });

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error retrieving document types by client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/clients/:id/document-types - Assign document types to a client
export const assignDocumentTypesToClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: clientId } = req.params;
    const { documentTypeIds, isRequired = false } = req.body;

    if (!Array.isArray(documentTypeIds) || documentTypeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Document type IDs array is required',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify client exists
    const clientCheck = await query(`SELECT id FROM clients WHERE id = $1`, [Number(clientId)]);
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'CLIENT_NOT_FOUND' },
      });
    }

    // Verify all document types exist
    const uniqueDocumentTypeIds = Array.from(new Set(documentTypeIds.map(Number)));
    const documentTypeCheck = await query(
      `SELECT id FROM "documentTypes" WHERE id = ANY($1::integer[])`,
      [uniqueDocumentTypeIds]
    );

    if (documentTypeCheck.rows.length !== uniqueDocumentTypeIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more document types not found',
        error: { code: 'DOCUMENT_TYPES_NOT_FOUND' },
      });
    }

    const result = await withTransaction(async client => {
      const insertedMappings = [];

      for (let i = 0; i < uniqueDocumentTypeIds.length; i++) {
        const documentTypeId = uniqueDocumentTypeIds[i];

        try {
          const insertResult = await client.query(
            `INSERT INTO "clientDocumentTypes" (
              "clientId", "documentTypeId", is_required, priority, created_by
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("clientId", "documentTypeId") 
            DO UPDATE SET 
              is_required = EXCLUDED.is_required,
              priority = EXCLUDED.priority,
              is_active = true,
              updated_by = EXCLUDED.created_by,
              "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *`,
            [Number(clientId), documentTypeId, isRequired, i + 1, req.user?.id]
          );

          insertedMappings.push(insertResult.rows[0]);
        } catch (error: any) {
          logger.error(`Error inserting client-document type mapping:`, error);
          throw error;
        }
      }

      return insertedMappings;
    });

    // Create audit log
    await createAuditLog({
      userId: req.user?.id,
      action: 'ASSIGN',
      entityType: 'CLIENT_DOCUMENT_TYPES',
      entityId: clientId,
      details: {
        documentTypeIds: uniqueDocumentTypeIds,
        isRequired,
        mappingCount: result.length,
      },
    });

    logger.info(`Assigned ${result.length} document types to client ${clientId}`, {
      userId: req.user?.id,
      clientId,
      documentTypeIds: uniqueDocumentTypeIds,
    });

    res.status(201).json({
      success: true,
      message: `Successfully assigned ${result.length} document types`,
      data: result,
    });
  } catch (error) {
    logger.error('Error assigning document types to client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign document types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/clients/:clientId/document-types/:documentTypeId - Remove document type from client
export const removeDocumentTypeFromClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, documentTypeId } = req.params;

    // Check if mapping exists
    const existingMapping = await query(
      `SELECT * FROM "clientDocumentTypes" WHERE "clientId" = $1 AND "documentTypeId" = $2`,
      [Number(clientId), Number(documentTypeId)]
    );

    if (existingMapping.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type mapping not found for this client',
        error: { code: 'MAPPING_NOT_FOUND' },
      });
    }

    // Remove the mapping
    await query(
      `DELETE FROM "clientDocumentTypes" WHERE "clientId" = $1 AND "documentTypeId" = $2`,
      [Number(clientId), Number(documentTypeId)]
    );

    // Create audit log
    await createAuditLog({
      userId: req.user?.id,
      action: 'UNASSIGN',
      entityType: 'CLIENT_DOCUMENT_TYPES',
      entityId: clientId,
      details: {
        documentTypeId: Number(documentTypeId),
        removedMapping: existingMapping.rows[0],
      },
    });

    logger.info(`Removed document type ${documentTypeId} from client ${clientId}`, {
      userId: req.user?.id,
      clientId,
      documentTypeId,
    });

    res.json({
      success: true,
      message: 'Document type removed from client successfully',
    });
  } catch (error) {
    logger.error('Error removing document type from client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove document type from client',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/clients/:clientId/document-types/:documentTypeId - Update client document type mapping
export const updateClientDocumentTypeMapping = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, documentTypeId } = req.params;
    const { isRequired, priority, clientSpecificRules } = req.body;

    // Check if mapping exists
    const existingMapping = await query(
      `SELECT * FROM "clientDocumentTypes" WHERE "clientId" = $1 AND "documentTypeId" = $2`,
      [Number(clientId), Number(documentTypeId)]
    );

    if (existingMapping.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type mapping not found for this client',
        error: { code: 'MAPPING_NOT_FOUND' },
      });
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (isRequired !== undefined) {
      updateFields.push(`is_required = $${paramIndex}`);
      updateValues.push(isRequired);
      paramIndex++;
    }

    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}`);
      updateValues.push(priority);
      paramIndex++;
    }

    if (clientSpecificRules !== undefined) {
      updateFields.push(`client_specific_rules = $${paramIndex}`);
      updateValues.push(JSON.stringify(clientSpecificRules));
      paramIndex++;
    }

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

    // Add WHERE clause parameters
    updateValues.push(Number(clientId), Number(documentTypeId));

    const updateQuery = `
      UPDATE "clientDocumentTypes"
      SET ${updateFields.join(', ')}
      WHERE "clientId" = $${paramIndex} AND "documentTypeId" = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);
    const updatedMapping = result.rows[0];

    // Create audit log
    await createAuditLog({
      userId: req.user?.id,
      action: 'UPDATE',
      entityType: 'CLIENT_DOCUMENT_TYPES',
      entityId: clientId,
      details: {
        documentTypeId: Number(documentTypeId),
        updatedFields: Object.keys(req.body),
        previousMapping: existingMapping.rows[0],
      },
    });

    logger.info(`Updated client document type mapping: ${clientId}-${documentTypeId}`, {
      userId: req.user?.id,
      clientId,
      documentTypeId,
      updatedFields: Object.keys(req.body),
    });

    res.json({
      success: true,
      data: {
        id: updatedMapping.id,
        clientId: updatedMapping.clientId,
        documentTypeId: updatedMapping.documentTypeId,
        isRequired: updatedMapping.is_required,
        priority: updatedMapping.priority,
        clientSpecificRules: updatedMapping.client_specific_rules,
        isActive: updatedMapping.is_active,
        createdAt: updatedMapping.createdAt,
        updatedAt: updatedMapping.updatedAt,
      },
      message: 'Client document type mapping updated successfully',
    });
  } catch (error) {
    logger.error('Error updating client document type mapping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client document type mapping',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
