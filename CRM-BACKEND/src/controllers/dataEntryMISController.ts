import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import {
  loadPrefillContext,
  getPrefillValue,
  type PrefillContext,
} from '@/services/templateFieldPrefillResolver';
import { resolveDataScope } from '@/security/dataScope';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface TemplateFieldRow {
  id: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  displayOrder: number;
  prefillSource: string | null;
}

interface EntryRow {
  id: number;
  caseId: string;
  caseNumber: number;
  customerName: string;
  caseStatus: string;
  caseCreatedAt: Date;
  clientName: string;
  productName: string;
  instanceIndex: number;
  instanceLabel: string;
  data: Record<string, unknown>;
  isCompleted: boolean;
  verificationTaskId: string | null;
  taskNumber: string | null;
  taskTitle: string | null;
}

const ENTRIES_SQL = `
  SELECT
    e.id,
    c.id AS case_id,
    c.case_id AS case_number,
    c.customer_name,
    c.status AS case_status,
    c.created_at AS case_created_at,
    cl.name AS client_name,
    p.name AS product_name,
    e.instance_index,
    e.instance_label,
    e.data,
    e.is_completed,
    e.verification_task_id,
    vt.task_number,
    vt.task_title
  FROM case_data_entries e
  JOIN cases c ON c.id = e.case_id
  JOIN clients cl ON cl.id = c.client_id
  JOIN products p ON p.id = c.product_id
  LEFT JOIN verification_tasks vt ON vt.id = e.verification_task_id
`;

const buildWhereAndParams = (
  clientId: number,
  productId: number,
  templateId: number,
  opts: { dateFrom?: string; dateTo?: string; search?: string; dataEntryStatus?: string }
) => {
  const conditions = ['c.client_id = $1', 'c.product_id = $2', 'e.template_id = $3'];
  const params: unknown[] = [clientId, productId, templateId];
  let idx = 4;

  if (opts.dateFrom) {
    conditions.push(`c.created_at >= $${idx++}`);
    params.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push(`c.created_at < ($${idx++})::date + 1`);
    params.push(opts.dateTo);
  }
  if (opts.search) {
    conditions.push(`(c.customer_name ILIKE $${idx} OR c.case_id::text = $${idx + 1})`);
    params.push(`%${opts.search}%`, opts.search);
    idx += 2;
  }

  let deFilter = '';
  if (opts.dataEntryStatus === 'completed') {
    deFilter = ' AND e.is_completed = true';
  } else if (opts.dataEntryStatus === 'in_progress') {
    deFilter = ' AND e.is_completed = false';
  }

  return {
    where: `WHERE ${conditions.join(' AND ')}${deFilter}`,
    params,
    nextIdx: idx,
  };
};

const getActiveTemplate = async (clientId: number, productId: number) => {
  const tplRes = await query(
    `SELECT id, name, version FROM case_data_templates
      WHERE client_id = $1 AND product_id = $2 AND is_active = true
      ORDER BY version DESC LIMIT 1`,
    [clientId, productId]
  );
  return tplRes.rows[0] as { id: number; name: string; version: number } | undefined;
};

const getTemplateFields = async (templateId: number): Promise<TemplateFieldRow[]> => {
  const res = await query(
    `SELECT id, field_key, field_label, field_type, is_required, display_order, prefill_source
       FROM case_data_template_fields
      WHERE template_id = $1 AND is_active = true
      ORDER BY display_order ASC, id ASC`,
    [templateId]
  );
  return res.rows as TemplateFieldRow[];
};

/** Resolve prefill values for a batch of unique case IDs. */
const batchResolvePrefill = async (
  caseIds: string[],
  fields: TemplateFieldRow[]
): Promise<Map<string, PrefillContext>> => {
  const hasMapped = fields.some(f => f.prefillSource);
  if (!hasMapped || caseIds.length === 0) {
    return new Map();
  }
  const map = new Map<string, PrefillContext>();
  for (const cid of caseIds) {
    map.set(cid, await loadPrefillContext(cid));
  }
  return map;
};

const buildFieldValues = (
  row: EntryRow,
  fields: TemplateFieldRow[],
  prefillCtx: PrefillContext | undefined
): Record<string, unknown> => {
  const vals: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.prefillSource && prefillCtx) {
      vals[f.fieldKey] = getPrefillValue(prefillCtx, f.prefillSource);
    } else {
      vals[f.fieldKey] = row.data?.[f.fieldKey] ?? null;
    }
  }
  return vals;
};

// ---------------------------------------------------------------------------
// GET /api/case-data-entries/mis — paginated MIS data
// ---------------------------------------------------------------------------
export const getMISData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = Number(req.query.clientId);
    const productId = Number(req.query.productId);
    if (!clientId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'clientId and productId are required',
        error: { code: 'MISSING_PARAMS' },
      });
    }

    // Scope check: user must be assigned to this client+product.
    const scope = await resolveDataScope(req);
    if (scope.restricted) {
      if (scope.assignedClientIds && !scope.assignedClientIds.includes(clientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied — client not in your scope',
          error: { code: 'FORBIDDEN' },
        });
      }
      if (scope.assignedProductIds && !scope.assignedProductIds.includes(productId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied — product not in your scope',
          error: { code: 'FORBIDDEN' },
        });
      }
    }

    const template = await getActiveTemplate(clientId, productId);
    if (!template) {
      return res.json({
        success: true,
        data: {
          template: null,
          data: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        },
      });
    }

    const fields = await getTemplateFields(template.id);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { where, params, nextIdx } = buildWhereAndParams(clientId, productId, template.id, {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
      dataEntryStatus: req.query.dataEntryStatus as string,
    });

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM case_data_entries e JOIN cases c ON c.id = e.case_id JOIN clients cl ON cl.id = c.client_id JOIN products p ON p.id = c.product_id LEFT JOIN verification_tasks vt ON vt.id = e.verification_task_id ${where}`,
      params
    );
    const total = (countRes.rows[0] as { total: number }).total;

    params.push(limit, offset);
    const dataRes = await query(
      `${ENTRIES_SQL} ${where} ORDER BY c.created_at DESC, e.instance_index ASC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      params
    );
    const rows = dataRes.rows as EntryRow[];

    // Batch-resolve prefill values for unique case IDs on this page.
    const uniqueCaseIds = [...new Set(rows.map(r => r.caseId))];
    const prefillMap = await batchResolvePrefill(uniqueCaseIds, fields);

    const data = rows.map(r => ({
      caseId: r.caseNumber,
      caseUuid: r.caseId,
      customerName: r.customerName,
      caseStatus: r.caseStatus,
      clientName: r.clientName,
      productName: r.productName,
      instanceLabel: r.instanceLabel,
      taskNumber: r.taskNumber,
      taskTitle: r.taskTitle,
      dataEntryStatus: r.isCompleted ? 'completed' : 'in_progress',
      caseCreatedAt: r.caseCreatedAt,
      fieldValues: buildFieldValues(r, fields, prefillMap.get(r.caseId)),
    }));

    return res.json({
      success: true,
      data: {
        template: { id: template.id, name: template.name, version: template.version, fields },
        data,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('Error fetching data entry MIS:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch data entry MIS data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/case-data-entries/mis/export — Excel download
// ---------------------------------------------------------------------------
export const exportMISData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientId = Number(req.query.clientId);
    const productId = Number(req.query.productId);
    if (!clientId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'clientId and productId are required',
        error: { code: 'MISSING_PARAMS' },
      });
    }

    // Scope check: user must be assigned to this client+product.
    const scope = await resolveDataScope(req);
    if (scope.restricted) {
      if (scope.assignedClientIds && !scope.assignedClientIds.includes(clientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied — client not in your scope',
          error: { code: 'FORBIDDEN' },
        });
      }
      if (scope.assignedProductIds && !scope.assignedProductIds.includes(productId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied — product not in your scope',
          error: { code: 'FORBIDDEN' },
        });
      }
    }

    const template = await getActiveTemplate(clientId, productId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No active template for this client+product',
        error: { code: 'NO_TEMPLATE' },
      });
    }

    const fields = await getTemplateFields(template.id);
    const { where, params } = buildWhereAndParams(clientId, productId, template.id, {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
      dataEntryStatus: req.query.dataEntryStatus as string,
    });

    // No pagination on export — fetch all matching rows.
    const dataRes = await query(
      `${ENTRIES_SQL} ${where} ORDER BY c.created_at DESC, e.instance_index ASC`,
      params
    );
    const rows = dataRes.rows as EntryRow[];

    // Batch-resolve prefill.
    const uniqueCaseIds = [...new Set(rows.map(r => r.caseId))];
    const prefillMap = await batchResolvePrefill(uniqueCaseIds, fields);

    // Build Excel workbook.
    const wb = new ExcelJS.Workbook();
    wb.creator = 'CRM Data Entry MIS';
    wb.created = new Date();
    const ws = wb.addWorksheet(template.name.slice(0, 31)); // Excel sheet name limit

    // Columns: system fields + dynamic fields
    const systemCols: Partial<ExcelJS.Column>[] = [
      { header: 'Case #', key: 'caseId', width: 10 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Case Status', key: 'caseStatus', width: 14 },
      { header: 'Instance', key: 'instanceLabel', width: 20 },
      { header: 'Task #', key: 'taskNumber', width: 14 },
      { header: 'Data Entry Status', key: 'dataEntryStatus', width: 16 },
      { header: 'Case Received', key: 'caseCreatedAt', width: 18 },
    ];
    const dynamicCols = fields.map(f => ({
      header: f.fieldLabel,
      key: `field_${f.fieldKey}`,
      width: Math.max(12, Math.min(30, f.fieldLabel.length + 4)),
    }));
    ws.columns = [...systemCols, ...dynamicCols];

    // Style header row.
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '007bff' },
    };
    headerRow.alignment = { horizontal: 'center' };

    // Add data rows.
    for (const r of rows) {
      const prefillCtx = prefillMap.get(r.caseId);
      const rowData: Record<string, unknown> = {
        caseId: r.caseNumber,
        customerName: r.customerName,
        caseStatus: r.caseStatus,
        instanceLabel: r.instanceLabel,
        taskNumber: r.taskNumber ?? '',
        dataEntryStatus: r.isCompleted ? 'Completed' : 'In Progress',
        caseCreatedAt: r.caseCreatedAt
          ? new Date(r.caseCreatedAt as unknown as string).toLocaleDateString('en-IN')
          : '',
      };
      for (const f of fields) {
        let val: unknown;
        if (f.prefillSource && prefillCtx) {
          val = getPrefillValue(prefillCtx, f.prefillSource);
        } else {
          val = r.data?.[f.fieldKey] ?? '';
        }
        rowData[`field_${f.fieldKey}`] =
          val === null || val === undefined
            ? ''
            : typeof val === 'object'
              ? JSON.stringify(val)
              : val;
      }
      ws.addRow(rowData);
    }

    // AutoFilter.
    if (rows.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: systemCols.length + dynamicCols.length },
      };
    }

    // Write to buffer and send.
    const buffer = await wb.xlsx.writeBuffer();

    const clientRes = await query('SELECT name FROM clients WHERE id = $1', [clientId]);
    const productRes = await query('SELECT name FROM products WHERE id = $1', [productId]);
    const cName = ((clientRes.rows[0] as { name?: string })?.name ?? 'Client').replace(
      /[^a-zA-Z0-9]/g,
      '_'
    );
    const pName = ((productRes.rows[0] as { name?: string })?.name ?? 'Product').replace(
      /[^a-zA-Z0-9]/g,
      '_'
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `DataEntry_${cName}_${pName}_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buffer as ArrayBuffer));
  } catch (error) {
    logger.error('Error exporting data entry MIS:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export data entry MIS',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
