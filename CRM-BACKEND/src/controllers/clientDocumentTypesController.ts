import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query, withTransaction } from '../config/database';
import { createAuditLog } from '../utils/auditLogger';

// GET /api/clients/:id/document-types - Aggregate doc types across all client's products
// (post-migration: doc types are scoped to client+product tuple)
export const getDocumentTypesByClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = String(req.params.id || '');
    const { isActive } = req.query as { isActive?: string };

    const whereClause = isActive !== undefined ? 'AND cpd.is_active = $2' : '';
    const params =
      isActive !== undefined ? [Number(clientId), String(isActive) === 'true'] : [Number(clientId)];

    const documentTypesQuery = `
      SELECT DISTINCT
        dt.id,
        dt.name,
        dt.code,
        BOOL_OR(cpd.is_mandatory) as "isRequired",
        MIN(cpd.display_order) as priority
      FROM client_product_documents cpd
      JOIN client_products cp ON cp.id = cpd.client_product_id
      JOIN document_types dt ON cpd.document_type_id = dt.id
      WHERE cp.client_id = $1 ${whereClause}
      GROUP BY dt.id, dt.name, dt.code
      ORDER BY priority ASC, dt.name ASC
    `;

    const result = await query(documentTypesQuery, params);

    logger.info(`Retrieved ${result.rows.length} document types for client ${clientId}`, {
      userId: req.user?.id,
      clientId,
    });

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error retrieving document types by client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/clients/:id/document-types - Assign document types under a (client, product)
// Body: { productId, documentTypeIds[], isRequired? }
export const assignDocumentTypesToClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = String(req.params.id || '');
    const { productId, documentTypeIds, isRequired = false } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId is required (document types are scoped to client+product)',
        error: { code: 'PRODUCT_ID_REQUIRED' },
      });
    }
    if (!Array.isArray(documentTypeIds) || documentTypeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Document type IDs array is required',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Resolve client_product_id
    const cpRes = await query(
      `SELECT id FROM client_products WHERE client_id = $1 AND product_id = $2`,
      [Number(clientId), Number(productId)]
    );
    if (cpRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client+product mapping not found — assign the product to client first',
        error: { code: 'CLIENT_PRODUCT_NOT_FOUND' },
      });
    }
    const clientProductId = cpRes.rows[0].id;

    const uniqueDocumentTypeIds = Array.from(new Set(documentTypeIds.map(Number)));
    const documentTypeCheck = await query(
      `SELECT id FROM document_types WHERE id = ANY($1::integer[])`,
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
        const insertResult = await client.query(
          `INSERT INTO client_product_documents (client_product_id, document_type_id, is_mandatory, display_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           ON CONFLICT (client_product_id, document_type_id)
           DO UPDATE SET is_mandatory = EXCLUDED.is_mandatory,
                         display_order = EXCLUDED.display_order,
                         is_active = true,
                         updated_at = NOW()
           RETURNING *`,
          [clientProductId, documentTypeId, isRequired, i + 1]
        );
        insertedMappings.push(insertResult.rows[0]);
      }
      return insertedMappings;
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'ASSIGN',
      entityType: 'CLIENT_PRODUCT_DOCUMENTS',
      entityId: clientId,
      details: {
        productId: Number(productId),
        documentTypeIds: uniqueDocumentTypeIds,
        isRequired,
        mappingCount: result.length,
      },
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

// DELETE /api/clients/:clientId/products/:productId/document-types/:documentTypeId
export const removeDocumentTypeFromClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = String(req.params.clientId || '');
    const documentTypeId = String(req.params.documentTypeId || '');
    const queryProductId = typeof req.query.productId === 'string' ? req.query.productId : '';
    const productId = String(req.params.productId || queryProductId || '');

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId is required',
        error: { code: 'PRODUCT_ID_REQUIRED' },
      });
    }

    const cpRes = await query(
      `SELECT id FROM client_products WHERE client_id = $1 AND product_id = $2`,
      [Number(clientId), Number(productId)]
    );
    if (cpRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client+product mapping not found',
        error: { code: 'CLIENT_PRODUCT_NOT_FOUND' },
      });
    }
    const clientProductId = cpRes.rows[0].id;

    const deleteRes = await query(
      `DELETE FROM client_product_documents WHERE client_product_id = $1 AND document_type_id = $2 RETURNING *`,
      [clientProductId, Number(documentTypeId)]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type mapping not found',
        error: { code: 'MAPPING_NOT_FOUND' },
      });
    }

    await createAuditLog({
      userId: req.user?.id,
      action: 'UNASSIGN',
      entityType: 'CLIENT_PRODUCT_DOCUMENTS',
      entityId: clientId,
      details: {
        productId: Number(productId),
        documentTypeId: Number(documentTypeId),
      },
    });

    res.json({ success: true, message: 'Document type removed successfully' });
  } catch (error) {
    logger.error('Error removing document type from client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove document type from client',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/clients/:clientId/products/:productId/document-types/:documentTypeId
export const updateClientDocumentTypeMapping = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = String(req.params.clientId || '');
    const documentTypeId = String(req.params.documentTypeId || '');
    const productId = String(req.params.productId || req.body.productId || '');
    const { isRequired, priority } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId is required',
        error: { code: 'PRODUCT_ID_REQUIRED' },
      });
    }

    const cpRes = await query(
      `SELECT id FROM client_products WHERE client_id = $1 AND product_id = $2`,
      [Number(clientId), Number(productId)]
    );
    if (cpRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client+product mapping not found',
        error: { code: 'CLIENT_PRODUCT_NOT_FOUND' },
      });
    }
    const clientProductId = cpRes.rows[0].id;

    const updateFields: string[] = [];
    const values: (string | number | boolean)[] = [];
    let idx = 1;
    if (isRequired !== undefined) {
      updateFields.push(`is_mandatory = $${idx++}`);
      values.push(Boolean(isRequired));
    }
    if (priority !== undefined) {
      updateFields.push(`display_order = $${idx++}`);
      values.push(Number(priority));
    }
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
        error: { code: 'NO_UPDATE_FIELDS' },
      });
    }
    updateFields.push(`updated_at = NOW()`);
    values.push(clientProductId, Number(documentTypeId));

    const updateQuery = `
      UPDATE client_product_documents
      SET ${updateFields.join(', ')}
      WHERE client_product_id = $${idx++} AND document_type_id = $${idx}
      RETURNING *
    `;
    const result = await query(updateQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type mapping not found',
        error: { code: 'MAPPING_NOT_FOUND' },
      });
    }
    const m = result.rows[0];

    await createAuditLog({
      userId: req.user?.id,
      action: 'UPDATE',
      entityType: 'CLIENT_PRODUCT_DOCUMENTS',
      entityId: clientId,
      details: {
        productId: Number(productId),
        documentTypeId: Number(documentTypeId),
        updatedFields: Object.keys(req.body),
      },
    });

    res.json({
      success: true,
      data: {
        id: m.id,
        clientProductId: m.client_product_id,
        documentTypeId: m.document_type_id,
        isRequired: m.is_mandatory,
        priority: m.display_order,
        isActive: m.is_active,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      },
      message: 'Mapping updated successfully',
    });
  } catch (error) {
    logger.error('Error updating client document type mapping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mapping',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
