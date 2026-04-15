import type { Response } from 'express';
import type { PoolClient } from 'pg';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query, withTransaction } from '@/config/database';
import { CacheKeys, invalidateCachePatterns } from '@/services/enterpriseCacheService';
import { recordEntryHistory, markCaseCompleted } from '@/services/caseLifecycleService';

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

type ValidationMode = 'draft' | 'complete';

/**
 * Validate data values against template field definitions.
 *
 * - 'draft' mode: only type sanity (e.g. MULTISELECT must be an array);
 *   required / min / max / pattern are NOT enforced, so users can save
 *   partial progress without fighting the validator.
 * - 'complete' mode: full enforcement — every required field must be
 *   filled and every rule (min, max, minLength, maxLength, pattern,
 *   option membership) must pass.
 *
 * Returns an array of human-readable error strings (empty = valid).
 */
const validateDataAgainstTemplate = (
  data: Record<string, unknown>,
  fields: TemplateField[],
  mode: ValidationMode
): string[] => {
  const errors: string[] = [];
  const fieldMap = new Map(fields.map(f => [f.fieldKey, f]));

  // Required-field check is only enforced on complete.
  if (mode === 'complete') {
    for (const field of fields) {
      if (field.isRequired) {
        const value = data[field.fieldKey];
        if (value === undefined || value === null || value === '') {
          errors.push(`Field "${field.fieldLabel}" is required`);
        }
      }
    }
  }

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
    const strict = mode === 'complete';

    switch (field.fieldType) {
      case 'NUMBER': {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`Field "${field.fieldLabel}" must be a number`);
        } else if (strict) {
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
        if (typeof value !== 'string') {
          errors.push(`Field "${field.fieldLabel}" must be text`);
        } else if (strict) {
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
              // Invalid regex in config — skip pattern check.
            }
          }
        }
        break;
      }
      case 'DATE': {
        // Strict ISO-8601 date (YYYY-MM-DD) or date-time. Accept nothing else.
        const dateStr = typeof value === 'string' ? value : '';
        const isIso = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(
          dateStr
        );
        if (!isIso || isNaN(new Date(dateStr).getTime())) {
          errors.push(`Field "${field.fieldLabel}" must be a valid ISO date (YYYY-MM-DD)`);
        }
        break;
      }
      case 'SELECT': {
        const validValues = (field.options || []).map(o => o.value);
        const selectStr = typeof value === 'string' ? value : '';
        if (typeof value !== 'string') {
          errors.push(`Field "${field.fieldLabel}" must be a single value`);
        } else if (validValues.length > 0 && !validValues.includes(selectStr)) {
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
 * Scope check: user must have access to the case's client + product. System
 * scope bypass (admins/super admins) short-circuits the check.
 */
const checkCaseAccess = (
  req: AuthenticatedRequest,
  caseRow: { clientId: number; productId: number }
): boolean => {
  if (req.user?.capabilities?.systemScopeBypass) {
    return true;
  }
  const assignedClientIds = req.user?.assignedClientIds || [];
  const assignedProductIds = req.user?.assignedProductIds || [];
  return (
    assignedClientIds.includes(caseRow.clientId) && assignedProductIds.includes(caseRow.productId)
  );
};

/**
 * Resolve the active template (id + version) for a client-product pair
 * inside a transaction, taking a FOR SHARE lock so concurrent
 * updateTemplate writers cannot re-version it mid-save.
 */
const getActiveTemplateLocked = async (
  client: PoolClient,
  clientId: number,
  productId: number
): Promise<{ id: number; version: number } | null> => {
  const res = await client.query(
    `SELECT id, version
       FROM case_data_templates
      WHERE client_id = $1 AND product_id = $2 AND is_active = true
      ORDER BY version DESC
      LIMIT 1
        FOR SHARE`,
    [clientId, productId]
  );
  return res.rows[0] || null;
};

const getTemplateFields = async (
  client: PoolClient | null,
  templateId: number
): Promise<TemplateField[]> => {
  const sql = `SELECT id, field_key, field_label, field_type, is_required, display_order,
                      section, placeholder, default_value, validation_rules, options, is_active
                 FROM case_data_template_fields
                WHERE template_id = $1 AND is_active = true
                ORDER BY display_order ASC, id ASC`;
  const res = client ? await client.query(sql, [templateId]) : await query(sql, [templateId]);
  return res.rows as TemplateField[];
};

// ---------------------------------------------------------------------------
// GET /api/case-data-entries/:caseId
// Returns: { entries: [...all instances...], template, caseStatus }
// ---------------------------------------------------------------------------
export const getEntry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;

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
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
        error: { code: 'FORBIDDEN' },
      });
    }

    const entriesRes = await query(
      `SELECT id, case_id, template_id, template_version, instance_index, instance_label,
              data, is_completed, completed_at, completed_by, created_by, updated_by,
              created_at, updated_at
         FROM case_data_entries
        WHERE case_id = $1
        ORDER BY instance_index ASC`,
      [caseId]
    );
    const entries = entriesRes.rows;

    // Determine which template to show the form against.
    // Prefer the entry's pinned template if entries exist; otherwise the
    // currently active template for the case's client+product.
    let template = null;
    if (entries.length > 0) {
      const firstEntry = entries[0];
      const tplRes = await query(
        `SELECT t.id, t.client_id, t.product_id, t.name, t.version, t.is_active,
                c.name AS client_name, p.name AS product_name
           FROM case_data_templates t
           JOIN clients c ON c.id = t.client_id
           JOIN products p ON p.id = t.product_id
          WHERE t.id = $1`,
        [firstEntry.templateId]
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

    let fields: TemplateField[] = [];
    if (template) {
      fields = await getTemplateFields(null, template.id);
    }

    return res.json({
      success: true,
      data: {
        entries,
        template: template ? { ...template, fields } : null,
        caseStatus: caseRow.status,
      },
    });
  } catch (error) {
    logger.error('Error fetching case data entries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case data entries',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/case-data-entries/:caseId/instances
// Create a new instance for a case. Body: { instanceLabel?: string }
// Returns the new entry row with its auto-assigned instance_index.
// ---------------------------------------------------------------------------
export const createInstance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { instanceLabel } = req.body as { instanceLabel?: string };
    const userId = req.user!.id;

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
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
        error: { code: 'FORBIDDEN' },
      });
    }
    if (caseRow.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot add instances to a completed case',
        error: { code: 'CASE_COMPLETED' },
      });
    }

    const result = await withTransaction(async client => {
      const tpl = await getActiveTemplateLocked(client, caseRow.clientId, caseRow.productId);
      if (!tpl) {
        return { error: 'NO_TEMPLATE' as const };
      }

      // Determine next instance_index atomically (we hold a FOR SHARE
      // lock on the template; competing inserters for the same case will
      // serialise on the composite unique constraint).
      const nextIdxRes = await client.query(
        `SELECT COALESCE(MAX(instance_index) + 1, 0) AS next_idx
           FROM case_data_entries WHERE case_id = $1`,
        [caseId]
      );
      const nextIdx = Number(nextIdxRes.rows[0].nextIdx);

      const label =
        typeof instanceLabel === 'string' && instanceLabel.trim()
          ? instanceLabel.trim().slice(0, 100)
          : nextIdx === 0
            ? 'Primary'
            : `Instance ${nextIdx + 1}`;

      const insertRes = await client.query(
        `INSERT INTO case_data_entries
           (case_id, template_id, template_version, instance_index, instance_label,
            data, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, NOW(), NOW())
         RETURNING *`,
        [caseId, tpl.id, tpl.version, nextIdx, label, userId]
      );
      const entry = insertRes.rows[0];

      await recordEntryHistory(client, {
        entryId: entry.id,
        caseId,
        templateId: tpl.id,
        templateVersion: tpl.version,
        data: {},
        changeType: 'CREATE',
        changedBy: userId,
      });

      return { entry };
    });

    if ('error' in result && result.error === 'NO_TEMPLATE') {
      return res.status(400).json({
        success: false,
        message: 'No active template configured for this client-product combination',
        error: { code: 'NO_TEMPLATE' },
      });
    }

    void invalidateCachePatterns(CacheKeys.invalidateCase(caseId));
    return res.json({ success: true, data: result.entry });
  } catch (error) {
    logger.error('Error creating case data entry instance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create instance',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/case-data-entries/:caseId/instances/:instanceIndex
// Save (draft) data for a specific instance. Loose validation — only type
// sanity, not required/min/max. Rejects if active template version moved
// ahead of the entry's pinned version.
// Body: { data: object, templateVersion: number }
// ---------------------------------------------------------------------------
export const saveInstance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId, instanceIndex } = req.params;
    const instanceIdx = Number(instanceIndex);
    const { data, templateVersion } = req.body as {
      data: Record<string, unknown>;
      templateVersion?: number;
    };
    const userId = req.user!.id;

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
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
        error: { code: 'FORBIDDEN' },
      });
    }
    if (caseRow.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit data entry for a completed case',
        error: { code: 'CASE_COMPLETED' },
      });
    }

    const outcome = await withTransaction(async client => {
      // Lock the active template so concurrent updateTemplate cannot
      // re-version between version check and write.
      const activeTpl = await getActiveTemplateLocked(
        client,
        caseRow.clientId,
        caseRow.productId
      );
      if (!activeTpl) {
        return { error: 'NO_TEMPLATE' as const };
      }

      // Find existing instance (if any).
      const existingRes = await client.query(
        `SELECT id, template_id, template_version, is_completed
           FROM case_data_entries
          WHERE case_id = $1 AND instance_index = $2
            FOR UPDATE`,
        [caseId, instanceIdx]
      );
      const existing = existingRes.rows[0];

      if (existing?.isCompleted) {
        return { error: 'INSTANCE_COMPLETED' as const };
      }

      // Version pin: the version the user is editing against MUST be
      // the active one. If an admin published a newer version while
      // this user was filling the form, reject with a clear code so
      // the frontend can reload the template.
      const pinnedVersion = existing?.templateVersion ?? templateVersion ?? activeTpl.version;
      if (pinnedVersion !== activeTpl.version) {
        return {
          error: 'TEMPLATE_VERSION_CHANGED' as const,
          activeVersion: activeTpl.version,
          yourVersion: pinnedVersion,
        };
      }

      // Draft validation — type sanity only.
      const fields = await getTemplateFields(client, activeTpl.id);
      const validationErrors = validateDataAgainstTemplate(data || {}, fields, 'draft');
      if (validationErrors.length > 0) {
        return { error: 'VALIDATION' as const, details: validationErrors };
      }

      let entry;
      let changeType: 'CREATE' | 'UPDATE';
      if (existing) {
        const updateRes = await client.query(
          `UPDATE case_data_entries
              SET data = $1, updated_by = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *`,
          [JSON.stringify(data || {}), userId, existing.id]
        );
        entry = updateRes.rows[0];
        changeType = 'UPDATE';
      } else {
        // No row yet for this (case, instance_index) — create it and
        // allow the requested index (e.g. first save for instance 0 of
        // a freshly-opened case).
        const label = instanceIdx === 0 ? 'Primary' : `Instance ${instanceIdx + 1}`;
        const insertRes = await client.query(
          `INSERT INTO case_data_entries
             (case_id, template_id, template_version, instance_index, instance_label,
              data, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING *`,
          [
            caseId,
            activeTpl.id,
            activeTpl.version,
            instanceIdx,
            label,
            JSON.stringify(data || {}),
            userId,
          ]
        );
        entry = insertRes.rows[0];
        changeType = 'CREATE';
      }

      await recordEntryHistory(client, {
        entryId: entry.id,
        caseId,
        templateId: entry.templateId,
        templateVersion: entry.templateVersion,
        data: data || {},
        changeType,
        changedBy: userId,
      });

      return { entry };
    });

    if ('error' in outcome) {
      switch (outcome.error) {
        case 'NO_TEMPLATE':
          return res.status(400).json({
            success: false,
            message: 'No active template configured for this client-product combination',
            error: { code: 'NO_TEMPLATE' },
          });
        case 'INSTANCE_COMPLETED':
          return res.status(400).json({
            success: false,
            message: 'This instance is already completed',
            error: { code: 'INSTANCE_COMPLETED' },
          });
        case 'TEMPLATE_VERSION_CHANGED':
          return res.status(409).json({
            success: false,
            message:
              'The template has been updated since you opened this form. Please reload to continue.',
            error: {
              code: 'TEMPLATE_VERSION_CHANGED',
              activeVersion: outcome.activeVersion,
              yourVersion: outcome.yourVersion,
            },
          });
        case 'VALIDATION':
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            error: { code: 'VALIDATION_ERROR', details: outcome.details },
          });
      }
    }

    void invalidateCachePatterns(CacheKeys.invalidateCase(caseId));
    logger.info(`Saved case data entry`, {
      caseId,
      instanceIdx,
      userId,
      entryId: outcome.entry.id,
    });
    return res.json({
      success: true,
      data: outcome.entry,
      message: 'Data entry saved successfully',
    });
  } catch (error) {
    logger.error('Error saving case data entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save data entry',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/case-data-entries/:caseId/instances/:instanceIndex
// Remove a not-yet-completed instance. Keeps history via FK cascade (the
// history table rows remain; entry_id becomes dangling, but change_type
// set lets callers see that this instance was removed).
// ---------------------------------------------------------------------------
export const deleteInstance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId, instanceIndex } = req.params;
    const instanceIdx = Number(instanceIndex);

    const caseRes = await query(
      `SELECT id, client_id, product_id, status FROM cases WHERE id = $1`,
      [caseId]
    );
    const caseRow = caseRes.rows[0];
    if (!caseRow) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    if (caseRow.status === 'COMPLETED') {
      return res
        .status(400)
        .json({ success: false, error: { code: 'CASE_COMPLETED' } });
    }

    // History rows cascade via FK ON DELETE CASCADE.
    const result = await query(
      `DELETE FROM case_data_entries
        WHERE case_id = $1 AND instance_index = $2 AND is_completed = false`,
      [caseId, instanceIdx]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found or already completed',
        error: { code: 'NOT_FOUND' },
      });
    }

    void invalidateCachePatterns(CacheKeys.invalidateCase(caseId));
    return res.json({ success: true, message: 'Instance deleted' });
  } catch (error) {
    logger.error('Error deleting case data entry instance:', error);
    return res
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
};

// ---------------------------------------------------------------------------
// POST /api/case-data-entries/:caseId/complete
// Strict completion: requires ≥1 instance AND every instance must pass
// full validation (required + min/max/pattern/option-set).
// ---------------------------------------------------------------------------
export const completeCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const userId = req.user!.id;

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
    if (!checkCaseAccess(req, caseRow)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
        error: { code: 'FORBIDDEN' },
      });
    }
    if (caseRow.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Case is already completed',
        error: { code: 'ALREADY_COMPLETED' },
      });
    }

    const outcome = await withTransaction(async client => {
      const entriesRes = await client.query(
        `SELECT id, template_id, template_version, instance_index, instance_label,
                data, is_completed
           FROM case_data_entries
          WHERE case_id = $1
          ORDER BY instance_index ASC
            FOR UPDATE`,
        [caseId]
      );
      const entries = entriesRes.rows;

      if (entries.length === 0) {
        return { error: 'NO_ENTRIES' as const };
      }

      // Every instance must pass full validation against its pinned
      // template version. Aggregate errors across instances so the user
      // sees all problems in one round-trip.
      const allErrors: string[] = [];
      for (const entry of entries) {
        const fieldsRes = await client.query(
          `SELECT id, field_key, field_label, field_type, is_required, display_order,
                  section, placeholder, default_value, validation_rules, options, is_active
             FROM case_data_template_fields
            WHERE template_id = $1 AND is_active = true`,
          [entry.templateId]
        );
        const fields = fieldsRes.rows as TemplateField[];
        const data = (entry.data || {}) as Record<string, unknown>;
        if (Object.keys(data).length === 0) {
          allErrors.push(`Instance "${entry.instanceLabel}" has no data`);
          continue;
        }
        const errors = validateDataAgainstTemplate(data, fields, 'complete');
        for (const e of errors) {
          allErrors.push(`[${entry.instanceLabel}] ${e}`);
        }
      }

      if (allErrors.length > 0) {
        return { error: 'VALIDATION' as const, details: allErrors };
      }

      // Mark all instances completed.
      await client.query(
        `UPDATE case_data_entries
            SET is_completed = true,
                completed_at = NOW(),
                completed_by = $1,
                updated_at = NOW()
          WHERE case_id = $2`,
        [userId, caseId]
      );

      // Append COMPLETE history row for each instance.
      for (const entry of entries) {
        await recordEntryHistory(client, {
          entryId: entry.id,
          caseId,
          templateId: entry.templateId,
          templateVersion: entry.templateVersion,
          data: entry.data as Record<string, unknown>,
          changeType: 'COMPLETE',
          changedBy: userId,
        });
      }

      const caseRowUpdated = await markCaseCompleted(client, caseId);
      return { case: caseRowUpdated };
    });

    if ('error' in outcome) {
      switch (outcome.error) {
        case 'NO_ENTRIES':
          return res.status(400).json({
            success: false,
            message: 'Cannot complete a case that has no data entry',
            error: { code: 'NO_ENTRIES' },
          });
        case 'VALIDATION':
          return res.status(400).json({
            success: false,
            message: 'Data entry has validation errors. Please fix them before completing.',
            error: { code: 'VALIDATION_ERROR', details: outcome.details },
          });
      }
    }

    void invalidateCachePatterns(CacheKeys.invalidateCase(caseId));
    logger.info(`Completed case ${caseId}`, { userId });
    return res.json({
      success: true,
      data: outcome.case,
      message: 'Case completed successfully',
    });
  } catch (error) {
    logger.error('Error completing case:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
