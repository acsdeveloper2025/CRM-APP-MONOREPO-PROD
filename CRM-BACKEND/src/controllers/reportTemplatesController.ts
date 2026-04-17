import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { reportTemplateRenderer } from '@/services/reportTemplateRenderer';
import { buildReportContext, ReportCaseNotFoundError } from '@/services/reportContextBuilder';
import { convertPdfToTemplate, PdfConversionInputError } from '@/services/pdfToTemplateConverter';

// Hard cap on the raw HTML size a template can hold. A real RCU report
// template (header + 10 sections + loops + CSS) is usually 20-40 KB. 512 KB
// is generous for any realistic future expansion and keeps JSON payloads
// bounded so the admin UI never has to stream the body.
const MAX_HTML_BYTES = 512 * 1024;

// Mirrors the page_size CHECK constraint in migration 025.
const ALLOWED_PAGE_SIZES = new Set(['A4', 'LETTER', 'LEGAL']);
const ALLOWED_PAGE_ORIENTATIONS = new Set(['portrait', 'landscape']);

interface ReportTemplateRow {
  id: number;
  clientId: number;
  productId: number;
  name: string;
  version: number;
  isActive: boolean;
  htmlContent: string;
  pageSize: string;
  pageOrientation: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReportTemplateListRow extends ReportTemplateRow {
  clientName: string;
  productName: string;
  generatedCount: string;
}

// ---------------------------------------------------------------------------
// GET /api/report-templates — list with pagination and filters
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

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM report_templates t
       JOIN clients c ON c.id = t.client_id
       JOIN products p ON p.id = t.product_id
       ${whereClause}`,
      queryParams
    );
    const totalCount = Number(countRes.rows[0]?.count ?? 0);

    const sortColumnMap: Record<string, string> = {
      name: 't.name',
      clientName: 'c.name',
      productName: 'p.name',
      version: 't.version',
      createdAt: 't.created_at',
      updatedAt: 't.updated_at',
    };
    const sortCol = sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] ?? 't.created_at';
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(500, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // htmlContent is intentionally omitted from the list payload to keep
    // the response light - the admin list only shows metadata.
    const dataRes = await query<ReportTemplateListRow>(
      `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
              t.page_size, t.page_orientation,
              t.created_by, t.updated_by, t.created_at, t.updated_at,
              c.name AS client_name, p.name AS product_name,
              (SELECT COUNT(*)::text FROM generated_reports gr WHERE gr.template_id = t.id) AS generated_count
       FROM report_templates t
       JOIN clients c ON c.id = t.client_id
       JOIN products p ON p.id = t.product_id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...queryParams, limitNum, offset]
    );

    return res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    logger.error('Error listing report templates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list report templates',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/report-templates/by-config?clientId=X&productId=Y
// Returns the active template for the pair, or { data: null } if none.
// ---------------------------------------------------------------------------
export const getTemplateByConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId } = req.query;

    const result = await query<ReportTemplateRow>(
      `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
              t.html_content, t.page_size, t.page_orientation,
              t.created_by, t.updated_by, t.created_at, t.updated_at
       FROM report_templates t
       WHERE t.client_id = $1 AND t.product_id = $2 AND t.is_active = true
       ORDER BY t.version DESC
       LIMIT 1`,
      [Number(clientId), Number(productId)]
    );

    return res.json({ success: true, data: result.rows[0] ?? null });
  } catch (error) {
    logger.error('Error fetching template by config:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/report-templates/:id
// ---------------------------------------------------------------------------
export const getTemplateById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query<ReportTemplateListRow>(
      `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
              t.html_content, t.page_size, t.page_orientation,
              t.created_by, t.updated_by, t.created_at, t.updated_at,
              c.name AS client_name, p.name AS product_name,
              (SELECT COUNT(*)::text FROM generated_reports gr WHERE gr.template_id = t.id) AS generated_count
       FROM report_templates t
       JOIN clients c ON c.id = t.client_id
       JOIN products p ON p.id = t.product_id
       WHERE t.id = $1`,
      [Number(id)]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Report template not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching report template:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/report-templates/validate
// Dry-run compile the Handlebars template. Returns { valid, error? }.
// ---------------------------------------------------------------------------
export const validateTemplate = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { htmlContent } = req.body as { htmlContent?: unknown };
    if (typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'htmlContent is required',
        error: { code: 'HTML_REQUIRED' },
      });
    }
    if (Buffer.byteLength(htmlContent, 'utf8') > MAX_HTML_BYTES) {
      return res.status(400).json({
        success: false,
        message: `htmlContent exceeds max size of ${MAX_HTML_BYTES} bytes`,
        error: { code: 'HTML_TOO_LARGE' },
      });
    }
    const result = reportTemplateRenderer.validate(htmlContent);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error validating report template:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/report-templates
// ---------------------------------------------------------------------------
export const createTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, productId, name, htmlContent, pageSize, pageOrientation } = req.body as {
      clientId?: unknown;
      productId?: unknown;
      name?: unknown;
      htmlContent?: unknown;
      pageSize?: unknown;
      pageOrientation?: unknown;
    };
    const userId = req.user!.id;

    // Validate page-size / orientation here (in addition to validators in the
    // route file) so the controller is safe even if someone adds a direct
    // caller path that skips validation middleware.
    const finalPageSize = typeof pageSize === 'string' ? pageSize : 'A4';
    const finalPageOrientation = typeof pageOrientation === 'string' ? pageOrientation : 'portrait';
    if (!ALLOWED_PAGE_SIZES.has(finalPageSize)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page size',
        error: { code: 'INVALID_PAGE_SIZE' },
      });
    }
    if (!ALLOWED_PAGE_ORIENTATIONS.has(finalPageOrientation)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page orientation',
        error: { code: 'INVALID_PAGE_ORIENTATION' },
      });
    }

    if (typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'htmlContent is required',
        error: { code: 'HTML_REQUIRED' },
      });
    }
    if (Buffer.byteLength(htmlContent, 'utf8') > MAX_HTML_BYTES) {
      return res.status(400).json({
        success: false,
        message: `htmlContent exceeds max size of ${MAX_HTML_BYTES} bytes`,
        error: { code: 'HTML_TOO_LARGE' },
      });
    }

    // Compile-check the template - bad Handlebars should never be persisted.
    const validation = reportTemplateRenderer.validate(htmlContent);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Invalid template: ${validation.error ?? 'compile error'}`,
        error: { code: 'TEMPLATE_COMPILE_ERROR', detail: validation.error },
      });
    }

    const clientRes = await query<{ id: number }>(`SELECT id FROM clients WHERE id = $1`, [
      Number(clientId),
    ]);
    if (!clientRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Client not found',
        error: { code: 'CLIENT_NOT_FOUND' },
      });
    }

    const productRes = await query<{ id: number }>(`SELECT id FROM products WHERE id = $1`, [
      Number(productId),
    ]);
    if (!productRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Product not found',
        error: { code: 'PRODUCT_NOT_FOUND' },
      });
    }

    const result = await withTransaction(async client => {
      // App-level duplicate check. The real enforcer is the unique partial
      // index idx_report_templates_unique_active - any concurrent insert
      // that slips past here will get a constraint violation we catch below.
      const existingRes = await client.query<{ id: number }>(
        `SELECT id FROM report_templates
         WHERE client_id = $1 AND product_id = $2 AND is_active = true`,
        [Number(clientId), Number(productId)]
      );
      if (existingRes.rows[0]) {
        return { error: 'DUPLICATE_TEMPLATE' as const };
      }

      // Compute the next version from ALL rows (including deactivated ones)
      // to honor the UNIQUE(client_id, product_id, version) constraint.
      // If a previous template was created, used, deactivated (or deleted
      // via "soft delete"), a fresh create must land on MAX(version)+1 —
      // hardcoding version=1 would collide with the old inactive row.
      const nextVersionRes = await client.query<{ nextVersion: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM report_templates
         WHERE client_id = $1 AND product_id = $2`,
        [Number(clientId), Number(productId)]
      );
      const nextVersion = Number(nextVersionRes.rows[0]?.nextVersion ?? 1);

      const insertRes = await client.query<ReportTemplateRow>(
        `INSERT INTO report_templates
           (client_id, product_id, name, version, is_active, html_content,
            page_size, page_orientation, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id, client_id, product_id, name, version, is_active,
                   html_content, page_size, page_orientation,
                   created_by, updated_by, created_at, updated_at`,
        [
          Number(clientId),
          Number(productId),
          String(name),
          nextVersion,
          htmlContent,
          finalPageSize,
          finalPageOrientation,
          userId,
        ]
      );
      return insertRes.rows[0];
    });

    if ('error' in result) {
      return res.status(400).json({
        success: false,
        message: 'An active report template already exists for this client-product combination',
        error: { code: 'DUPLICATE_TEMPLATE' },
      });
    }

    logger.info('Created report template', {
      userId,
      templateId: result.id,
      clientId,
      productId,
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: 'Report template created successfully',
    });
  } catch (error) {
    // Translate the DB unique-violation into the clean user-facing error.
    // Postgres code for unique_violation is 23505.
    const pgCode = (error as { code?: string } | null)?.code;
    if (pgCode === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate active template detected',
        error: { code: 'DUPLICATE_TEMPLATE' },
      });
    }
    logger.error('Error creating report template:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/report-templates/:id
// If generated_reports exist for this template, deactivate current and
// insert a new row at version+1. Otherwise update in place.
// Mirrors case_data_templates version pinning.
// ---------------------------------------------------------------------------
export const updateTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, htmlContent, pageSize, pageOrientation } = req.body as {
      name?: unknown;
      htmlContent?: unknown;
      pageSize?: unknown;
      pageOrientation?: unknown;
    };
    const userId = req.user!.id;

    if (htmlContent !== undefined) {
      if (typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'htmlContent must be a non-empty string when provided',
          error: { code: 'HTML_REQUIRED' },
        });
      }
      if (Buffer.byteLength(htmlContent, 'utf8') > MAX_HTML_BYTES) {
        return res.status(400).json({
          success: false,
          message: `htmlContent exceeds max size of ${MAX_HTML_BYTES} bytes`,
          error: { code: 'HTML_TOO_LARGE' },
        });
      }
      const validation = reportTemplateRenderer.validate(htmlContent);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid template: ${validation.error ?? 'compile error'}`,
          error: { code: 'TEMPLATE_COMPILE_ERROR', detail: validation.error },
        });
      }
    }

    if (pageSize !== undefined) {
      if (typeof pageSize !== 'string' || !ALLOWED_PAGE_SIZES.has(pageSize)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid page size',
          error: { code: 'INVALID_PAGE_SIZE' },
        });
      }
    }
    if (pageOrientation !== undefined) {
      if (typeof pageOrientation !== 'string' || !ALLOWED_PAGE_ORIENTATIONS.has(pageOrientation)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid page orientation',
          error: { code: 'INVALID_PAGE_ORIENTATION' },
        });
      }
    }

    const result = await withTransaction(async client => {
      // Lock the target row so a concurrent generation can't grab it
      // mid-update.
      const lockRes = await client.query<ReportTemplateRow>(
        `SELECT id, client_id, product_id, name, version, is_active,
                html_content, page_size, page_orientation,
                created_by, updated_by, created_at, updated_at
         FROM report_templates
         WHERE id = $1
         FOR UPDATE`,
        [Number(id)]
      );
      const existing = lockRes.rows[0];
      if (!existing) {
        return { error: 'NOT_FOUND' as const };
      }

      // Count any audit rows referencing this template - if any exist,
      // create a new version rather than mutating the row the history
      // points at.
      const usageRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM generated_reports WHERE template_id = $1`,
        [existing.id]
      );
      const hasHistory = Number(usageRes.rows[0]?.count ?? 0) > 0;

      const nextName = typeof name === 'string' ? name : existing.name;
      const nextHtml = typeof htmlContent === 'string' ? htmlContent : existing.htmlContent;
      const nextPageSize = typeof pageSize === 'string' ? pageSize : existing.pageSize;
      const nextPageOrientation =
        typeof pageOrientation === 'string' ? pageOrientation : existing.pageOrientation;

      if (hasHistory) {
        // Deactivate the current row.
        await client.query(
          `UPDATE report_templates SET is_active = false, updated_by = $1, updated_at = NOW()
           WHERE id = $2`,
          [userId, existing.id]
        );
        // Insert at next version.
        const newRes = await client.query<ReportTemplateRow>(
          `INSERT INTO report_templates
             (client_id, product_id, name, version, is_active, html_content,
              page_size, page_orientation, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, NOW(), NOW())
           RETURNING id, client_id, product_id, name, version, is_active,
                     html_content, page_size, page_orientation,
                     created_by, updated_by, created_at, updated_at`,
          [
            existing.clientId,
            existing.productId,
            nextName,
            existing.version + 1,
            nextHtml,
            nextPageSize,
            nextPageOrientation,
            userId,
          ]
        );
        return { row: newRes.rows[0], newVersion: true };
      }

      // In-place update.
      const updRes = await client.query<ReportTemplateRow>(
        `UPDATE report_templates
         SET name = $1, html_content = $2, page_size = $3, page_orientation = $4,
             updated_by = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING id, client_id, product_id, name, version, is_active,
                   html_content, page_size, page_orientation,
                   created_by, updated_by, created_at, updated_at`,
        [nextName, nextHtml, nextPageSize, nextPageOrientation, userId, existing.id]
      );
      return { row: updRes.rows[0], newVersion: false };
    });

    if ('error' in result && result.error === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Report template not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info('Updated report template', {
      userId,
      templateId: result.row.id,
      newVersion: result.newVersion,
    });

    return res.json({
      success: true,
      data: result.row,
      message: result.newVersion ? 'New template version created' : 'Template updated successfully',
    });
  } catch (error) {
    const pgCode = (error as { code?: string } | null)?.code;
    if (pgCode === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate active template detected',
        error: { code: 'DUPLICATE_TEMPLATE' },
      });
    }
    logger.error('Error updating report template:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/report-templates/:id
// Soft delete - sets is_active = false. Any old generated_reports pointing
// at this row keep their template_version pin for audit purposes.
// ---------------------------------------------------------------------------
export const deleteTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await query<{ id: number }>(
      `UPDATE report_templates
       SET is_active = false, updated_by = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [userId, Number(id)]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Report template not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info('Deactivated report template', { userId, templateId: result.rows[0].id });

    return res.json({ success: true, message: 'Report template deactivated' });
  } catch (error) {
    logger.error('Error deleting report template:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// Helpers shared by generate + context-preview endpoints
// ---------------------------------------------------------------------------

interface ResolvedCaseAndTemplate {
  caseUuid: string;
  clientId: number;
  productId: number;
  customerName: string | null;
  caseNumber: number;
  template: ReportTemplateRow;
}

/**
 * Resolve the case (UUID or numeric) and look up the active report template
 * for its client-product combination. Returns null on any "not found" path
 * with a structured reason so the caller can send the right status code.
 */
async function resolveCaseAndActiveTemplate(
  caseIdentifier: string
): Promise<
  | { ok: true; resolved: ResolvedCaseAndTemplate }
  | { ok: false; status: number; code: string; message: string }
> {
  const trimmed = caseIdentifier.trim();
  if (!trimmed) {
    return { ok: false, status: 400, code: 'INVALID_CASE_ID', message: 'caseId is required' };
  }

  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const isUuid = uuidRegex.test(trimmed);
  const isNumeric = /^\d+$/.test(trimmed);
  if (!isUuid && !isNumeric) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_CASE_ID',
      message: 'caseId must be a UUID or numeric case_id',
    };
  }

  const caseSql = isUuid
    ? `SELECT id, case_id AS case_number, client_id, product_id, customer_name
       FROM cases WHERE id = $1`
    : `SELECT id, case_id AS case_number, client_id, product_id, customer_name
       FROM cases WHERE case_id = $1`;
  const caseParam = isUuid ? trimmed : Number(trimmed);
  const caseRes = await query<{
    id: string;
    caseNumber: number;
    clientId: number;
    productId: number;
    customerName: string | null;
  }>(caseSql, [caseParam]);
  const caseRow = caseRes.rows[0];
  if (!caseRow) {
    return { ok: false, status: 404, code: 'CASE_NOT_FOUND', message: 'Case not found' };
  }

  const tplRes = await query<ReportTemplateRow>(
    `SELECT id, client_id, product_id, name, version, is_active,
            html_content, page_size, page_orientation,
            created_by, updated_by, created_at, updated_at
     FROM report_templates
     WHERE client_id = $1 AND product_id = $2 AND is_active = true
     ORDER BY version DESC
     LIMIT 1`,
    [caseRow.clientId, caseRow.productId]
  );
  const template = tplRes.rows[0];
  if (!template) {
    return {
      ok: false,
      status: 404,
      code: 'NO_ACTIVE_TEMPLATE',
      message: 'No active report template is configured for this client-product combination',
    };
  }

  return {
    ok: true,
    resolved: {
      caseUuid: caseRow.id,
      clientId: caseRow.clientId,
      productId: caseRow.productId,
      customerName: caseRow.customerName,
      caseNumber: caseRow.caseNumber,
      template,
    },
  };
}

function sanitizeFilenameFragment(input: string | null): string {
  if (!input) {
    return 'Report';
  }
  return input.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'Report';
}

// ---------------------------------------------------------------------------
// POST /api/report-templates/generate/:caseId
// Renders the active template for the case and streams the PDF bytes.
// Logs a row in generated_reports (metadata only, no bytes stored).
// ---------------------------------------------------------------------------
export const generateReport = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  // Newer @types/express types route params as `string | string[]` even
  // though Express never produces an array for a simple :param. Narrow once
  // here so downstream code stays clean.
  const caseIdParam = req.params.caseId;
  const caseId = Array.isArray(caseIdParam) ? (caseIdParam[0] ?? '') : caseIdParam;

  try {
    const userRes = await query<{ name: string | null }>(`SELECT name FROM users WHERE id = $1`, [
      userId,
    ]);
    const userName = userRes.rows[0]?.name ?? null;

    const resolution = await resolveCaseAndActiveTemplate(caseId);
    if (!resolution.ok) {
      return res.status(resolution.status).json({
        success: false,
        message: resolution.message,
        error: { code: resolution.code },
      });
    }
    const { resolved } = resolution;

    const context = await buildReportContext(resolved.caseUuid, {
      generatedById: userId,
      generatedByName: userName,
    });

    const pageSize =
      resolved.template.pageSize === 'A4' ||
      resolved.template.pageSize === 'LETTER' ||
      resolved.template.pageSize === 'LEGAL'
        ? resolved.template.pageSize
        : 'A4';
    const pageOrientation =
      resolved.template.pageOrientation === 'landscape' ? 'landscape' : 'portrait';

    const render = await reportTemplateRenderer.renderToPdfBuffer(
      resolved.template.htmlContent,
      context as unknown as Record<string, unknown>,
      { pageSize, pageOrientation }
    );

    // Audit log row. Best-effort: if the insert fails we still return the PDF
    // so the user isn't blocked, but we log the failure loudly.
    try {
      await query(
        `INSERT INTO generated_reports
           (case_id, template_id, template_version, generated_by,
            generated_at, file_size_bytes, generation_ms)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
        [
          resolved.caseUuid,
          resolved.template.id,
          resolved.template.version,
          userId,
          render.fileSizeBytes,
          render.generationMs,
        ]
      );
    } catch (auditErr) {
      logger.error('Failed to write generated_reports audit row', {
        err: auditErr,
        caseId: resolved.caseUuid,
        templateId: resolved.template.id,
      });
    }

    logger.info('Generated report', {
      userId,
      caseId: resolved.caseUuid,
      caseNumber: resolved.caseNumber,
      templateId: resolved.template.id,
      templateVersion: resolved.template.version,
      bytes: render.fileSizeBytes,
      ms: render.generationMs,
    });

    const customerFragment = sanitizeFilenameFragment(resolved.customerName);
    const dateFragment = new Date().toISOString().slice(0, 10);
    const filename = `${customerFragment}_${resolved.caseNumber}_${dateFragment}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(render.fileSizeBytes));
    res.setHeader('X-Report-Template-Id', String(resolved.template.id));
    res.setHeader('X-Report-Template-Version', String(resolved.template.version));
    return res.status(200).send(render.buffer);
  } catch (error) {
    if (error instanceof ReportCaseNotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
        error: { code: 'CASE_NOT_FOUND' },
      });
    }
    logger.error('Error generating report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/report-templates/context/:caseId
// Returns the Handlebars context as JSON for admin debugging. Photo data
// URIs are stripped to keep the payload small - admins rarely need the
// base64 blob to understand what fields are available.
// ---------------------------------------------------------------------------
export const getContextPreview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  // Newer @types/express types route params as `string | string[]` even
  // though Express never produces an array for a simple :param. Narrow once
  // here so downstream code stays clean.
  const caseIdParam = req.params.caseId;
  const caseId = Array.isArray(caseIdParam) ? (caseIdParam[0] ?? '') : caseIdParam;

  try {
    const userRes = await query<{ name: string | null }>(`SELECT name FROM users WHERE id = $1`, [
      userId,
    ]);
    const userName = userRes.rows[0]?.name ?? null;

    const resolution = await resolveCaseAndActiveTemplate(caseId);
    if (!resolution.ok && resolution.code !== 'NO_ACTIVE_TEMPLATE') {
      return res.status(resolution.status).json({
        success: false,
        message: resolution.message,
        error: { code: resolution.code },
      });
    }

    // Even without an active template we want the admin to preview the
    // context (so they know what to reference while authoring the template).
    // Fall back to resolving the case directly for context building.
    let caseUuid: string;
    if (resolution.ok) {
      caseUuid = resolution.resolved.caseUuid;
    } else {
      const trimmed = caseId.trim();
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      const isUuid = uuidRegex.test(trimmed);
      const q = isUuid
        ? `SELECT id FROM cases WHERE id = $1`
        : `SELECT id FROM cases WHERE case_id = $1`;
      const r = await query<{ id: string }>(q, [isUuid ? trimmed : Number(trimmed)]);
      if (!r.rows[0]) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'CASE_NOT_FOUND' },
        });
      }
      caseUuid = r.rows[0].id;
    }

    const context = await buildReportContext(caseUuid, {
      generatedById: userId,
      generatedByName: userName,
    });

    // Strip photo data URIs to keep the JSON response small. Keep metadata
    // so admins can see shape/count.
    const trimmed = {
      ...context,
      tasks: context.tasks.map(t => ({
        ...t,
        attachments: t.attachments.map(a => ({ ...a, url: a.url ? '[data-uri omitted]' : null })),
      })),
    };

    return res.json({ success: true, data: trimmed });
  } catch (error) {
    if (error instanceof ReportCaseNotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
        error: { code: 'CASE_NOT_FOUND' },
      });
    }
    logger.error('Error building report context preview:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to build context',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/report-templates/convert-from-pdf
// Multipart upload: { file: PDF, clientId, productId }
// Calls Claude to convert the PDF layout into a Handlebars template bound
// to the client+product's data-entry fields. Returns the draft HTML plus
// compile-check status + token usage. Admin reviews in the editor and
// saves via the normal create endpoint.
// ---------------------------------------------------------------------------
export const convertFromPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'PDF file is required',
        error: { code: 'FILE_REQUIRED' },
      });
    }
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        message: 'Only PDF files are supported',
        error: { code: 'UNSUPPORTED_MIME' },
      });
    }

    const clientId = Number(req.body.clientId);
    const productId = Number(req.body.productId);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'clientId must be a positive integer',
        error: { code: 'INVALID_CLIENT_ID' },
      });
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'productId must be a positive integer',
        error: { code: 'INVALID_PRODUCT_ID' },
      });
    }

    const outcome = await convertPdfToTemplate({
      pdfBuffer: file.buffer,
      clientId,
      productId,
    });

    // Refuse to return HTML that exceeds the template column cap — gives
    // the admin a useful error before they hit it on save.
    const htmlBytes = Buffer.byteLength(outcome.html, 'utf8');
    if (htmlBytes > MAX_HTML_BYTES) {
      return res.status(413).json({
        success: false,
        message: `Generated template is ${htmlBytes.toLocaleString('en-IN')} bytes, exceeding the ${MAX_HTML_BYTES.toLocaleString('en-IN')}-byte cap. Re-run with a simpler PDF or edit down the output.`,
        error: { code: 'HTML_TOO_LARGE', htmlBytes, maxBytes: MAX_HTML_BYTES },
      });
    }

    logger.info('PDF → template conversion returned to admin', {
      userId: req.user?.id,
      clientId,
      productId,
      htmlBytes,
      validated: outcome.validatedOk,
      elapsedMs: outcome.elapsedMs,
    });

    return res.json({
      success: true,
      data: {
        htmlContent: outcome.html,
        validatedOk: outcome.validatedOk,
        validationError: outcome.validationError ?? null,
        model: outcome.model,
        dataEntryFieldsUsed: outcome.dataEntryFieldsUsed,
        usage: {
          inputTokens: outcome.inputTokens,
          outputTokens: outcome.outputTokens,
          cacheReadTokens: outcome.cacheReadTokens,
          cacheCreationTokens: outcome.cacheCreationTokens,
          elapsedMs: outcome.elapsedMs,
        },
      },
    });
  } catch (error) {
    if (error instanceof PdfConversionInputError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: { code: 'INVALID_INPUT' },
      });
    }
    // Narrow typed Anthropic SDK errors so the admin gets a useful message.
    const err = error as {
      status?: number;
      message?: string;
      name?: string;
      error?: { error?: { type?: string; message?: string } };
    } | null;
    if (err && typeof err === 'object' && typeof err.status === 'number') {
      // The SDK's APIError carries the parsed body on `.error`; the nested
      // `.error.error.message` is what the API actually returned.
      const apiMsg = err.error?.error?.message ?? err.message ?? '';
      const lowerMsg = apiMsg.toLowerCase();

      // Billing / credit issues come back as 400 invalid_request_error but
      // are really operator-actionable (top up credits) — surface them
      // clearly to the admin instead of a generic 400.
      if (
        err.status === 400 &&
        (lowerMsg.includes('credit balance') || lowerMsg.includes('billing'))
      ) {
        logger.error('Claude billing/credits issue', { apiMsg });
        return res.status(402).json({
          success: false,
          message:
            'AI service has no credits available. An administrator must add credits at https://console.anthropic.com before the PDF converter can be used.',
          error: { code: 'AI_INSUFFICIENT_CREDITS', detail: apiMsg },
        });
      }
      if (err.status === 401) {
        logger.error('Claude auth failed — check ANTHROPIC_API_KEY', { apiMsg });
        return res.status(500).json({
          success: false,
          message: 'AI service authentication failed. Please contact an administrator.',
          error: { code: 'AI_AUTH_ERROR' },
        });
      }
      if (err.status === 429) {
        return res.status(429).json({
          success: false,
          message: 'AI service is rate-limited. Try again in a moment.',
          error: { code: 'AI_RATE_LIMITED' },
        });
      }
      if (err.status >= 500) {
        return res.status(502).json({
          success: false,
          message: 'AI service is unavailable. Please try again.',
          error: { code: 'AI_UPSTREAM_ERROR' },
        });
      }
      // Other 4xx — echo the Anthropic-supplied message so admins see the
      // actual problem (bad request shape, unsupported file, etc.) rather
      // than a generic 500.
      if (err.status >= 400 && err.status < 500 && apiMsg) {
        return res.status(err.status).json({
          success: false,
          message: `AI service rejected the request: ${apiMsg}`,
          error: { code: 'AI_REJECTED' },
        });
      }
    }
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error('PDF → template conversion failed', { msg, stack });
    return res.status(500).json({
      success: false,
      message: `Failed to convert PDF to template: ${msg}`,
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
