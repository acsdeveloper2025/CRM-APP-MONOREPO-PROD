import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { parseTemplateUpload } from '@/services/templateImportService';

// ---------------------------------------------------------------------------
// GET /api/case-data-templates — List templates with pagination and filters
// ---------------------------------------------------------------------------
export const getTemplates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      clientId,
      productId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const whereConditions: string[] = [];
    const queryParams: QueryParams = [];
    let paramIndex = 1;

    if (clientId) {
      whereConditions.push(`t.client_id = $${paramIndex++}`);
      queryParams.push(Number(clientId));
    }

    if (productId) {
      whereConditions.push(`t.product_id = $${paramIndex++}`);
      queryParams.push(Number(productId));
    }

    if (isActive !== undefined) {
      whereConditions.push(`t.is_active = $${paramIndex++}`);
      queryParams.push(isActive === 'true');
    }

    if (search && typeof search === 'string' && search.trim()) {
      whereConditions.push(
        `(t.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`
      );
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM case_data_templates t
       JOIN clients c ON c.id = t.client_id
       JOIN products p ON p.id = t.product_id
       ${whereClause}`,
      queryParams
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Sort mapping — camelCase API → snake_case DB
    const sortColumnMap: Record<string, string> = {
      name: 't.name',
      clientName: 'c.name',
      productName: 'p.name',
      version: 't.version',
      createdAt: 't.created_at',
      updatedAt: 't.updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 't.created_at';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const dataRes = await query(
      `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
              t.created_at, t.updated_at,
              c.name AS client_name, p.name AS product_name,
              (SELECT COUNT(*)::int FROM case_data_template_fields f WHERE f.template_id = t.id AND f.is_active = true) AS field_count
       FROM case_data_templates t
       JOIN clients c ON c.id = t.client_id
       JOIN products p ON p.id = t.product_id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}, t.id ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), (Number(page) - 1) * Number(limit)]
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error listing case data templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list case data templates',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/case-data-templates/by-config?clientId=X&productId=Y
// ---------------------------------------------------------------------------
export const getTemplateByConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId } = req.query;

    if (!clientId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'clientId and productId are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const tplRes = await query(
      `SELECT id, client_id, product_id, name, version, is_active, created_at, updated_at
       FROM case_data_templates
       WHERE client_id = $1 AND product_id = $2 AND is_active = true
       ORDER BY version DESC LIMIT 1`,
      [Number(clientId), Number(productId)]
    );

    const template = tplRes.rows[0];
    if (!template) {
      return res.json({ success: true, data: null });
    }

    // Fetch fields
    const fieldsRes = await query(
      `SELECT id, field_key, field_label, field_type, is_required, display_order,
              section, placeholder, default_value, validation_rules, options, is_active
       FROM case_data_template_fields
       WHERE template_id = $1 AND is_active = true
       ORDER BY display_order ASC, id ASC`,
      [template.id]
    );

    res.json({
      success: true,
      data: { ...template, fields: fieldsRes.rows },
    });
  } catch (error) {
    logger.error('Error fetching template by config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/case-data-templates/:id — Get template with fields
// ---------------------------------------------------------------------------
export const getTemplateById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tplRes = await query(
      `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
              t.created_at, t.updated_at,
              c.name AS client_name, p.name AS product_name
       FROM case_data_templates t
       JOIN clients c ON c.id = t.client_id
       JOIN products p ON p.id = t.product_id
       WHERE t.id = $1`,
      [Number(id)]
    );

    const template = tplRes.rows[0];
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const fieldsRes = await query(
      `SELECT id, field_key, field_label, field_type, is_required, display_order,
              section, placeholder, default_value, validation_rules, options, is_active
       FROM case_data_template_fields
       WHERE template_id = $1
       ORDER BY display_order ASC, id ASC`,
      [template.id]
    );

    res.json({
      success: true,
      data: { ...template, fields: fieldsRes.rows },
    });
  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/case-data-templates — Create template with fields
// ---------------------------------------------------------------------------
export const createTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, name, fields } = req.body;
    const userId = req.user!.id;

    // Check client exists
    const clientRes = await query(`SELECT id FROM clients WHERE id = $1`, [Number(clientId)]);
    if (!clientRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Client not found',
        error: { code: 'CLIENT_NOT_FOUND' },
      });
    }

    // Check product exists
    const productRes = await query(`SELECT id FROM products WHERE id = $1`, [Number(productId)]);
    if (!productRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Product not found',
        error: { code: 'PRODUCT_NOT_FOUND' },
      });
    }

    // Check no active template already exists for this combo
    const existingRes = await query(
      `SELECT id FROM case_data_templates WHERE client_id = $1 AND product_id = $2 AND is_active = true`,
      [Number(clientId), Number(productId)]
    );
    if (existingRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'An active template already exists for this client-product combination',
        error: { code: 'DUPLICATE_TEMPLATE' },
      });
    }

    const result = await withTransaction(async client => {
      // Insert template
      const tplRes = await client.query(
        `INSERT INTO case_data_templates (client_id, product_id, name, version, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, 1, true, $4, NOW(), NOW())
         RETURNING *`,
        [Number(clientId), Number(productId), name, userId]
      );
      const template = tplRes.rows[0];

      // Insert fields
      const insertedFields = [];
      if (Array.isArray(fields) && fields.length > 0) {
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          const fieldRes = await client.query(
            `INSERT INTO case_data_template_fields
               (template_id, field_key, field_label, field_type, is_required, display_order,
                section, placeholder, default_value, validation_rules, options, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
             RETURNING *`,
            [
              template.id,
              f.fieldKey,
              f.fieldLabel,
              f.fieldType,
              f.isRequired || false,
              f.displayOrder ?? i,
              f.section || null,
              f.placeholder || null,
              f.defaultValue || null,
              JSON.stringify(f.validationRules || {}),
              JSON.stringify(f.options || []),
            ]
          );
          insertedFields.push(fieldRes.rows[0]);
        }
      }

      return { ...template, fields: insertedFields };
    });

    logger.info(`Created case data template: ${result.id}`, {
      userId,
      clientId,
      productId,
      fieldCount: fields?.length || 0,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Template created successfully',
    });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/case-data-templates/:id — Update template
// If entries reference it, create new version. Otherwise update in place.
// ---------------------------------------------------------------------------
export const updateTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, fields } = req.body;
    const userId = req.user!.id;

    // The existence check + entry-count check must be inside the same
    // transaction as the update, and must hold an exclusive lock on the
    // template row. Otherwise a concurrent saveEntry can create the
    // first entry between "count = 0" and the in-place DELETE/INSERT of
    // fields, silently rewriting the schema under that just-saved row.
    // saveInstance takes a FOR SHARE lock on the active template, so a
    // FOR UPDATE here will block / be blocked by concurrent saves as
    // required.
    const result = await withTransaction(async client => {
      const existingRes = await client.query(
        `SELECT * FROM case_data_templates WHERE id = $1 FOR UPDATE`,
        [Number(id)]
      );
      const existing = existingRes.rows[0];
      if (!existing) {
        return { error: 'NOT_FOUND' as const };
      }

      const entryCountRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM case_data_entries WHERE template_id = $1`,
        [Number(id)]
      );
      const hasEntries = Number(entryCountRes.rows[0]?.count || 0) > 0;

      if (hasEntries) {
        // Create new version — deactivate old, create new
        await client.query(
          `UPDATE case_data_templates SET is_active = false, updated_at = NOW(), updated_by = $1 WHERE id = $2`,
          [userId, Number(id)]
        );

        const newVersionRes = await client.query(
          `INSERT INTO case_data_templates (client_id, product_id, name, version, is_active, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
           RETURNING *`,
          [
            existing.clientId,
            existing.productId,
            name || existing.name,
            existing.version + 1,
            userId,
          ]
        );
        const newTemplate = newVersionRes.rows[0];

        // Insert new fields
        const insertedFields = [];
        if (Array.isArray(fields) && fields.length > 0) {
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const fieldRes = await client.query(
              `INSERT INTO case_data_template_fields
                 (template_id, field_key, field_label, field_type, is_required, display_order,
                  section, placeholder, default_value, validation_rules, options, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
               RETURNING *`,
              [
                newTemplate.id,
                f.fieldKey,
                f.fieldLabel,
                f.fieldType,
                f.isRequired || false,
                f.displayOrder ?? i,
                f.section || null,
                f.placeholder || null,
                f.defaultValue || null,
                JSON.stringify(f.validationRules || {}),
                JSON.stringify(f.options || []),
              ]
            );
            insertedFields.push(fieldRes.rows[0]);
          }
        }

        return { ...newTemplate, fields: insertedFields, newVersion: true };
      } else {
        // Update in place — no entries reference it
        if (name) {
          await client.query(
            `UPDATE case_data_templates SET name = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3`,
            [name, userId, Number(id)]
          );
        }

        // Replace fields: delete old, insert new
        if (Array.isArray(fields)) {
          await client.query(`DELETE FROM case_data_template_fields WHERE template_id = $1`, [
            Number(id),
          ]);

          const insertedFields = [];
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const fieldRes = await client.query(
              `INSERT INTO case_data_template_fields
                 (template_id, field_key, field_label, field_type, is_required, display_order,
                  section, placeholder, default_value, validation_rules, options, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
               RETURNING *`,
              [
                Number(id),
                f.fieldKey,
                f.fieldLabel,
                f.fieldType,
                f.isRequired || false,
                f.displayOrder ?? i,
                f.section || null,
                f.placeholder || null,
                f.defaultValue || null,
                JSON.stringify(f.validationRules || {}),
                JSON.stringify(f.options || []),
              ]
            );
            insertedFields.push(fieldRes.rows[0]);
          }

          // Re-fetch template
          const updatedTplRes = await client.query(
            `SELECT * FROM case_data_templates WHERE id = $1`,
            [Number(id)]
          );
          return { ...updatedTplRes.rows[0], fields: insertedFields, newVersion: false };
        }

        const updatedTplRes = await client.query(
          `SELECT * FROM case_data_templates WHERE id = $1`,
          [Number(id)]
        );
        const updatedFieldsRes = await client.query(
          `SELECT * FROM case_data_template_fields WHERE template_id = $1 ORDER BY display_order ASC, id ASC`,
          [Number(id)]
        );
        return { ...updatedTplRes.rows[0], fields: updatedFieldsRes.rows, newVersion: false };
      }
    });

    if ('error' in result && result.error === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const successResult = result as { newVersion: boolean; version: number };
    logger.info(`Updated case data template: ${id}`, {
      userId,
      newVersion: successResult.newVersion,
    });

    res.json({
      success: true,
      data: result,
      message: successResult.newVersion
        ? `Template updated as new version ${successResult.version}`
        : 'Template updated successfully',
    });
  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/case-data-templates/:id — Deactivate template
// ---------------------------------------------------------------------------
export const deleteTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existingRes = await query(`SELECT id FROM case_data_templates WHERE id = $1`, [
      Number(id),
    ]);
    if (!existingRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    await query(
      `UPDATE case_data_templates SET is_active = false, updated_at = NOW(), updated_by = $1 WHERE id = $2`,
      [userId, Number(id)]
    );

    logger.info(`Deactivated case data template: ${id}`, { userId });

    res.json({
      success: true,
      message: 'Template deactivated successfully',
    });
  } catch (error) {
    logger.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/case-data-templates/parse-upload
// Parses an uploaded .xlsx or .csv into a draft field list for the
// import-preview UI. Does NOT write to the database — the admin reviews
// the preview, adjusts types / options / required flags, then the normal
// create-template endpoint is called to persist.
//
// Body (multipart/form-data):
//   file       — the .xlsx or .csv
//   clientId   — integer, required
//   productId  — integer, required
//
// Guards:
//   - Auth + case_data_template.manage (applied at the route layer).
//   - 2 MB file size cap (multer).
//   - Rejects if a template already exists for (clientId, productId) — per
//     the Sprint 4 spec, upload creates only; admin must use the manual
//     editor to update existing templates.
// ---------------------------------------------------------------------------
export const parseUpload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = Number((req.body as { clientId?: string }).clientId);
    const productId = Number((req.body as { productId?: string }).productId);
    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        error: { code: 'NO_FILE' },
      });
    }
    if (!Number.isInteger(clientId) || clientId < 1) {
      return res.status(400).json({
        success: false,
        message: 'clientId must be a positive integer',
        error: { code: 'INVALID_CLIENT_ID' },
      });
    }
    if (!Number.isInteger(productId) || productId < 1) {
      return res.status(400).json({
        success: false,
        message: 'productId must be a positive integer',
        error: { code: 'INVALID_PRODUCT_ID' },
      });
    }

    // If an active template already exists for the (client, product)
    // pair, parsing still proceeds — we just surface its id + version to
    // the caller. The frontend uses that hint to either call the normal
    // create endpoint (new template) or the update endpoint (which
    // triggers the existing versioning path — new version if entries
    // exist, in-place field replacement otherwise). See Sprint 4 Q6
    // replacement: user reversed the create-only decision.
    const existingRes = await query<{ id: number; version: number }>(
      `SELECT id, version FROM case_data_templates
        WHERE client_id = $1 AND product_id = $2 AND is_active = true
        LIMIT 1`,
      [clientId, productId]
    );
    const existing = existingRes.rows[0] ?? null;

    const parsed = await parseTemplateUpload({
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
    });

    if ('error' in parsed) {
      return res.status(400).json({
        success: false,
        message: parsed.error.message,
        error: { code: parsed.error.code },
      });
    }

    logger.info('Parsed template upload', {
      userId: req.user?.id,
      clientId,
      productId,
      filename: file.originalname,
      fieldCount: parsed.result.fields.length,
      rowCount: parsed.result.rowCount,
    });

    return res.json({
      success: true,
      data: {
        clientId,
        productId,
        sheetName: parsed.result.sheetName ?? null,
        rowCount: parsed.result.rowCount,
        fields: parsed.result.fields,
        // null → no existing template; non-null → the caller should
        // POST to the update endpoint for this id instead of creating
        // a fresh row (preserves the versioning path from Sprint 1).
        existingTemplateId: existing?.id ?? null,
        existingTemplateVersion: existing?.version ?? null,
      },
    });
  } catch (error) {
    logger.error('Error parsing template upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to parse upload',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
