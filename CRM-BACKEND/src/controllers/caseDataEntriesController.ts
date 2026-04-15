import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import { CacheKeys, invalidateCachePatterns } from '@/services/enterpriseCacheService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TemplateField {
  id: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  displayOrder: number;
  section: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  validationRules: Record<string, unknown>;
  options: Array<{ label: string; value: string }>;
  isActive: boolean;
}

/**
 * Validate data values against template field definitions.
 * Returns an array of validation error strings (empty = valid).
 */
const validateDataAgainstTemplate = (
  data: Record<string, unknown>,
  fields: TemplateField[]
): string[] => {
  const errors: string[] = [];
  const fieldMap = new Map(fields.map(f => [f.fieldKey, f]));

  // Check required fields
  for (const field of fields) {
    if (field.isRequired) {
      const value = data[field.fieldKey];
      if (value === undefined || value === null || value === '') {
        errors.push(`Field "${field.fieldLabel}" is required`);
      }
    }
  }

  // Validate provided values
  for (const [key, value] of Object.entries(data)) {
    const field = fieldMap.get(key);
    if (!field) {
      errors.push(`Unknown field "${key}" is not part of the template`);
      continue;
    }

    if (value === null || value === undefined || value === '') {
      continue;
    }

    const rules = field.validationRules || {};

    switch (field.fieldType) {
      case 'NUMBER': {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`Field "${field.fieldLabel}" must be a number`);
        } else {
          if (rules.min !== undefined && num < Number(rules.min)) {
            errors.push(`Field "${field.fieldLabel}" must be ≥ ${Number(rules.min)}`);
          }
          if (rules.max !== undefined && num > Number(rules.max)) {
            errors.push(`Field "${field.fieldLabel}" must be ≤ ${Number(rules.max)}`);
          }
        }
        break;
      }
      case 'TEXT':
      case 'TEXTAREA': {
        const str = typeof value === 'string' ? value : '';
        if (rules.minLength !== undefined && str.length < Number(rules.minLength)) {
          errors.push(
            `Field "${field.fieldLabel}" must be at least ${Number(rules.minLength)} characters`
          );
        }
        if (rules.maxLength !== undefined && str.length > Number(rules.maxLength)) {
          errors.push(
            `Field "${field.fieldLabel}" must be at most ${Number(rules.maxLength)} characters`
          );
        }
        if (rules.pattern) {
          try {
            const patternStr = typeof rules.pattern === 'string' ? rules.pattern : '';
            const regex = new RegExp(patternStr);
            if (!regex.test(str)) {
              errors.push(`Field "${field.fieldLabel}" does not match the required pattern`);
            }
          } catch {
            // Invalid regex in config — skip pattern check
          }
        }
        break;
      }
      case 'DATE': {
        const dateStr = typeof value === 'string' ? value : JSON.stringify(value);
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
          errors.push(`Field "${field.fieldLabel}" must be a valid date`);
        }
        break;
      }
      case 'SELECT': {
        const validValues = (field.options || []).map(o => o.value);
        const selectStr = typeof value === 'string' ? value : JSON.stringify(value);
        if (validValues.length > 0 && !validValues.includes(selectStr)) {
          errors.push(`Field "${field.fieldLabel}" has an invalid selection`);
        }
        break;
      }
      case 'MULTISELECT': {
        if (!Array.isArray(value)) {
          errors.push(`Field "${field.fieldLabel}" must be an array`);
        } else {
          const validValues = (field.options || []).map(o => o.value);
          if (validValues.length > 0) {
            for (const v of value) {
              if (!validValues.includes(String(v))) {
                errors.push(
                  `Field "${field.fieldLabel}" contains invalid selection "${String(v)}"`
                );
              }
            }
          }
        }
        break;
      }
      case 'BOOLEAN': {
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`Field "${field.fieldLabel}" must be true or false`);
        }
        break;
      }
    }
  }

  return errors;
};

/**
 * Check if user has access to the case's client+product scope.
 */
const checkCaseAccess = (
  req: AuthenticatedRequest,
  caseRow: { clientId: number; productId: number }
): boolean => {
  // System scope bypass (admins/super admins)
  if (req.user?.capabilities?.systemScopeBypass) {
    return true;
  }

  const assignedClientIds = req.user?.assignedClientIds || [];
  const assignedProductIds = req.user?.assignedProductIds || [];

  return (
    assignedClientIds.includes(caseRow.clientId) && assignedProductIds.includes(caseRow.productId)
  );
};

// ---------------------------------------------------------------------------
// GET /api/case-data-entries/:caseId — Get entry with template fields
// ---------------------------------------------------------------------------
export const getEntry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    // Get case
    const caseRes = await query(
      `SELECT id, client_id, product_id, status FROM cases WHERE id = $1`,
      [caseId]
    );
    const caseRow = caseRes.rows[0];
    if (!caseRow) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check scope access
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Get entry
    const entryRes = await query(
      `SELECT e.id, e.case_id, e.template_id, e.data, e.is_completed,
              e.completed_at, e.completed_by, e.created_by, e.updated_by,
              e.created_at, e.updated_at
       FROM case_data_entries e
       WHERE e.case_id = $1`,
      [caseId]
    );
    const entry = entryRes.rows[0];

    // Get template (from entry if exists, otherwise active template for client+product)
    const templateId = entry?.templateId;
    let template = null;

    if (templateId) {
      const tplRes = await query(
        `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
                c.name AS client_name, p.name AS product_name
         FROM case_data_templates t
         JOIN clients c ON c.id = t.client_id
         JOIN products p ON p.id = t.product_id
         WHERE t.id = $1`,
        [templateId]
      );
      template = tplRes.rows[0];
    } else {
      const tplRes = await query(
        `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
                c.name AS client_name, p.name AS product_name
         FROM case_data_templates t
         JOIN clients c ON c.id = t.client_id
         JOIN products p ON p.id = t.product_id
         WHERE t.client_id = $1 AND t.product_id = $2 AND t.is_active = true
         ORDER BY t.version DESC LIMIT 1`,
        [caseRow.clientId, caseRow.productId]
      );
      template = tplRes.rows[0];
    }

    // Get fields for template
    let fields: TemplateField[] = [];
    if (template) {
      const fieldsRes = await query(
        `SELECT id, field_key, field_label, field_type, is_required, display_order,
                section, placeholder, default_value, validation_rules, options, is_active
         FROM case_data_template_fields
         WHERE template_id = $1 AND is_active = true
         ORDER BY display_order ASC, id ASC`,
        [template.id]
      );
      fields = fieldsRes.rows as TemplateField[];
    }

    res.json({
      success: true,
      data: {
        entry: entry || null,
        template: template ? { ...template, fields } : null,
        caseStatus: caseRow.status,
      },
    });
  } catch (error) {
    logger.error('Error fetching case data entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch case data entry',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/case-data-entries/:caseId — Create/save data entry
// ---------------------------------------------------------------------------
export const saveEntry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { data } = req.body;
    const userId = req.user?.id;

    // Get case
    const caseRes = await query(
      `SELECT id, client_id, product_id, status FROM cases WHERE id = $1`,
      [caseId]
    );
    const caseRow = caseRes.rows[0];
    if (!caseRow) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check scope access
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Check if case is already completed
    const existingEntryRes = await query(
      `SELECT is_completed FROM case_data_entries WHERE case_id = $1`,
      [caseId]
    );
    if (existingEntryRes.rows[0]?.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit data entry for a completed case',
        error: { code: 'CASE_COMPLETED' },
      });
    }

    // Get active template
    const tplRes = await query(
      `SELECT id FROM case_data_templates
       WHERE client_id = $1 AND product_id = $2 AND is_active = true
       ORDER BY version DESC LIMIT 1`,
      [caseRow.clientId, caseRow.productId]
    );
    const template = tplRes.rows[0];
    if (!template) {
      return res.status(400).json({
        success: false,
        message: 'No active template configured for this client-product combination',
        error: { code: 'NO_TEMPLATE' },
      });
    }

    // Get template fields for validation
    const fieldsRes = await query(
      `SELECT id, field_key, field_label, field_type, is_required, display_order,
              section, placeholder, default_value, validation_rules, options, is_active
       FROM case_data_template_fields
       WHERE template_id = $1 AND is_active = true
       ORDER BY display_order ASC`,
      [template.id]
    );
    const fields = fieldsRes.rows as TemplateField[];

    // Validate data against template (only validate non-empty values — allow partial saves)
    const validationErrors = validateDataAgainstTemplate(data || {}, fields);
    // Filter out "required" errors for saves (only enforce on complete)
    const nonRequiredErrors = validationErrors.filter(e => !e.includes('is required'));
    if (nonRequiredErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: { code: 'VALIDATION_ERROR', details: nonRequiredErrors },
      });
    }

    // Upsert entry
    const upsertRes = await query(
      `INSERT INTO case_data_entries (case_id, template_id, data, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (case_id)
       DO UPDATE SET data = $3, template_id = $2, updated_by = $4, updated_at = NOW()
       RETURNING *`,
      [caseId, template.id, JSON.stringify(data || {}), userId]
    );

    void invalidateCachePatterns(CacheKeys.invalidateCase(caseId));

    logger.info(`Saved case data entry for case ${caseId}`, { userId, templateId: template.id });

    res.json({
      success: true,
      data: upsertRes.rows[0],
      message: 'Data entry saved successfully',
    });
  } catch (error) {
    logger.error('Error saving case data entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save data entry',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/case-data-entries/:caseId — Update data entry
// ---------------------------------------------------------------------------
export const updateEntry = async (req: AuthenticatedRequest, res: Response) => {
  // Reuse saveEntry — upsert handles both create and update
  return saveEntry(req, res);
};

// ---------------------------------------------------------------------------
// POST /api/case-data-entries/:caseId/complete — Mark case as complete
// ---------------------------------------------------------------------------
export const completeCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const userId = req.user?.id;

    // Get case
    const caseRes = await query(
      `SELECT id, client_id, product_id, status FROM cases WHERE id = $1`,
      [caseId]
    );
    const caseRow = caseRes.rows[0];
    if (!caseRow) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check scope access
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Check existing entry
    const entryRes = await query(
      `SELECT id, template_id, data, is_completed FROM case_data_entries WHERE case_id = $1`,
      [caseId]
    );
    const entry = entryRes.rows[0];

    if (entry?.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Case is already completed',
        error: { code: 'ALREADY_COMPLETED' },
      });
    }

    // If entry exists, validate required fields
    if (entry) {
      const fieldsRes = await query(
        `SELECT id, field_key, field_label, field_type, is_required, display_order,
                section, placeholder, default_value, validation_rules, options, is_active
         FROM case_data_template_fields
         WHERE template_id = $1 AND is_active = true`,
        [entry.templateId]
      );
      const fields = fieldsRes.rows as TemplateField[];
      const errors = validateDataAgainstTemplate(entry.data || {}, fields);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Data entry has validation errors. Please fix them before completing.',
          error: { code: 'VALIDATION_ERROR', details: errors },
        });
      }
    }

    const result = await withTransaction(async client => {
      // Mark entry as completed (if exists)
      if (entry) {
        await client.query(
          `UPDATE case_data_entries
           SET is_completed = true, completed_at = NOW(), completed_by = $1, updated_at = NOW()
           WHERE case_id = $2`,
          [userId, caseId]
        );
      }

      // Update case status to COMPLETED
      const caseUpdateRes = await client.query(
        `UPDATE cases SET status = 'COMPLETED', "completedAt" = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [caseId]
      );

      return caseUpdateRes.rows[0];
    });

    void invalidateCachePatterns(CacheKeys.invalidateCase(caseId));

    logger.info(`Completed case ${caseId}`, { userId });

    res.json({
      success: true,
      data: result,
      message: 'Case completed successfully',
    });
  } catch (error) {
    logger.error('Error completing case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
