import type { Response } from 'express';
import type { PoolClient } from 'pg';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { query, withTransaction } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { requireControllerPermission } from '@/security/controllerAuthorization';
import {
  resolveDataScope,
  valueAllowedByScope,
  appendOperationalScopeConditions,
} from '@/security/dataScope';
import { financialConfigurationValidator } from '@/services/financialConfigurationValidator';
import { resolveInvoiceGst, GstConfigError } from '@/services/gstResolver';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

const INVOICE_EXPORT_ROW_LIMIT = 10000;
const INVOICE_SORT_MAP: Record<string, string> = {
  invoiceNumber: 'i.invoice_number',
  clientName: 'c.name',
  issueDate: 'i.issue_date',
  dueDate: 'i.due_date',
  totalAmount: 'i.total_amount',
  amount: 'i.total_amount',
  status: 'i.status',
};

// Single 2dp rounder shared with gstResolver for arithmetic parity.
// NEW-MED-1 (AUDIT 2026-05-16): Math.round(n*100)/100 is FP-unsafe — e.g.
// 1.005*100 evaluates to 100.49999999999999, rounding to 100 instead of 101.
// EPSILON nudge pushes the FP representation past the boundary so Math.round
// picks the intended side. Off-by-0.01 invoice lines accumulate to CA
// reconciliation tickets over time; this is GST-relevant precision.
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

interface InvoiceItem {
  id: string;
  invoiceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  totalPrice?: number;
  caseIds: string[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  client?: {
    id: string;
    name: string;
    code: string;
    email?: string;
    phone?: string;
  };
  amount: number;
  subtotalAmount?: number;
  currency: string;
  status: string;
  dueDate: string;
  issueDate: string;
  paidDate: string | null;
  items: InvoiceItem[];
  taxAmount: number;
  totalAmount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod?: string;
  transactionId?: string;
  // GST breakdown (NULL for legacy pre-2026-05-12 invoices).
  supplyType?: 'INTRA_STATE' | 'INTER_STATE' | 'EXPORT' | null;
  placeOfSupply?: string | null;
  cgstRate?: number | null;
  cgstAmount?: number | null;
  sgstRate?: number | null;
  sgstAmount?: number | null;
  igstRate?: number | null;
  igstAmount?: number | null;
}

type InvoiceListRow = {
  id: number;
  invoiceNumber: string;
  clientId: number;
  productId: number | null;
  clientName: string;
  amount: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string | null;
  transactionId: string | null;
  clientCode: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  supplyType: string | null;
  placeOfSupply: string | null;
  cgstRate: string | null;
  cgstAmount: string | null;
  sgstRate: string | null;
  sgstAmount: string | null;
  igstRate: string | null;
  igstAmount: string | null;
};

type InvoiceItemRow = {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  caseIds: string[] | null;
};

type InvoiceTaskCandidateRow = {
  id: string;
  caseId: string;
  verificationTypeId: number | null;
  rateTypeId: number | null;
  actualAmount: string | null;
  estimatedAmount: string | null;
  areaId: number | null;
  taskTitle: string | null;
  taskType: 'NORMAL' | 'REVISIT' | 'KYC' | null;
  pincodeId: number | null;
  clientId: number;
  productId: number;
};

type CreateInvoiceBody = {
  clientId?: string | number;
  clientName?: string;
  items?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    caseId?: string;
    caseIds?: string[];
  }>;
  dueDate?: string;
  notes?: string;
  currency?: string;
  taskIds?: string[];
  billingPeriodFrom?: string;
  billingPeriodTo?: string;
  productId?: string | number;
};

const STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  CANCELLED: 'CANCELLED',
  OVERDUE: 'OVERDUE',
} as const;

const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMaybeNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseInvoiceClientId = (invoiceClientId: string): number | null => {
  const direct = Number(invoiceClientId);
  if (Number.isFinite(direct)) {
    return direct;
  }
  const suffix = Number(String(invoiceClientId).replace(/^client_/i, ''));
  return Number.isFinite(suffix) ? suffix : null;
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(entry => String(entry || '').trim()).filter(Boolean);
};

const parseCaseIdsFromItems = (items: CreateInvoiceBody['items']): string[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const values = new Set<string>();
  items.forEach(item => {
    if (item?.caseId) {
      values.add(String(item.caseId));
    }
    if (Array.isArray(item?.caseIds)) {
      item.caseIds.forEach(caseId => {
        if (caseId) {
          values.add(String(caseId));
        }
      });
    }
  });

  return [...values];
};

const getSingleParam = (value: string | string[] | undefined): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

const invoiceAllowedByScope = (
  invoice: { clientId: string; productId?: number | null },
  scope: Awaited<ReturnType<typeof resolveDataScope>>
): boolean =>
  valueAllowedByScope(
    {
      clientId: parseInvoiceClientId(invoice.clientId),
      productId: invoice.productId ?? null,
    },
    scope
  );

const toDisplayStatus = (status: string, dueDate: string, paidDate: string | null): string => {
  if (status === STATUS.CANCELLED) {
    return status;
  }
  if (!paidDate && dueDate && new Date(dueDate).getTime() < Date.now() && status !== STATUS.DRAFT) {
    return STATUS.OVERDUE;
  }
  return status;
};

const normalizeInvoiceForResponse = (
  invoice: Invoice & { productId?: number | null }
): Invoice & { productId?: number | null } => ({
  ...invoice,
  subtotalAmount: invoice.subtotalAmount ?? invoice.amount,
  status: toDisplayStatus(invoice.status, invoice.dueDate, invoice.paidDate),
  client:
    invoice.client ||
    (invoice.clientName
      ? {
          id: invoice.clientId,
          name: invoice.clientName,
          code: String(invoice.clientId),
        }
      : undefined),
  items: invoice.items.map(item => ({
    ...item,
    invoiceId: item.invoiceId ?? invoice.id,
    totalPrice: item.totalPrice ?? item.amount,
  })),
});

const buildScopeSql = (
  scope: Awaited<ReturnType<typeof resolveDataScope>>,
  conditions: string[],
  params: Array<string | number | number[]>
) => {
  if (!scope.restricted) {
    return;
  }

  if (scope.assignedClientIds) {
    if (scope.assignedClientIds.length === 0) {
      conditions.push('1 = 0');
    } else {
      params.push(scope.assignedClientIds);
      conditions.push(`i.client_id = ANY($${params.length}::int[])`);
    }
  }

  if (scope.assignedProductIds) {
    if (scope.assignedProductIds.length === 0) {
      conditions.push('1 = 0');
    } else {
      params.push(scope.assignedProductIds);
      conditions.push(`(i.product_id IS NULL OR i.product_id = ANY($${params.length}::int[]))`);
    }
  }
};

const loadInvoiceItems = async (invoiceIds: number[]): Promise<Map<number, InvoiceItem[]>> => {
  if (invoiceIds.length === 0) {
    return new Map();
  }

  const result = await query<InvoiceItemRow>(
    `SELECT
       ii.id,
       ii.invoice_id,
       ii.description,
       ii.quantity,
       ii.unit_price::text,
       ii.amount::text,
       COALESCE(array_agg(DISTINCT iit.case_id::text) FILTER (WHERE iit.case_id IS NOT NULL), ARRAY[]::text[]) as case_ids
     FROM invoice_items ii
     LEFT JOIN invoice_item_tasks iit ON iit.invoice_item_id = ii.id
     WHERE ii.invoice_id = ANY($1::bigint[])
     GROUP BY ii.id, ii.invoice_id, ii.description, ii.quantity, ii.unit_price, ii.amount
     ORDER BY ii.id ASC`,
    [invoiceIds]
  );

  const map = new Map<number, InvoiceItem[]>();
  result.rows.forEach(row => {
    const current = map.get(Number(row.invoiceId)) || [];
    current.push({
      id: String(row.id),
      invoiceId: String(row.invoiceId),
      description: row.description,
      quantity: Number(row.quantity),
      unitPrice: toNumber(row.unitPrice),
      amount: toNumber(row.amount),
      totalPrice: toNumber(row.amount),
      caseIds: Array.isArray(row.caseIds) ? row.caseIds : [],
    });
    map.set(Number(row.invoiceId), current);
  });

  return map;
};

const mapDbInvoiceRow = (
  row: InvoiceListRow,
  itemsMap: Map<number, InvoiceItem[]>
): Invoice & { productId?: number | null } => ({
  id: String(row.id),
  invoiceNumber: row.invoiceNumber,
  clientId: String(row.clientId),
  clientName: row.clientName,
  client: {
    id: String(row.clientId),
    name: row.clientName,
    code: row.clientCode || String(row.clientId),
    ...(row.clientEmail ? { email: row.clientEmail } : {}),
    ...(row.clientPhone ? { phone: row.clientPhone } : {}),
  },
  productId: row.productId,
  amount: toNumber(row.amount),
  subtotalAmount: toNumber(row.subtotalAmount),
  currency: row.currency,
  status: row.status,
  dueDate: row.dueDate,
  issueDate: row.issueDate,
  paidDate: row.paidDate,
  items: itemsMap.get(Number(row.id)) || [],
  taxAmount: toNumber(row.taxAmount),
  totalAmount: toNumber(row.totalAmount),
  notes: row.notes || '',
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  ...(row.paymentMethod ? { paymentMethod: row.paymentMethod } : {}),
  ...(row.transactionId ? { transactionId: row.transactionId } : {}),
  supplyType: (row.supplyType as Invoice['supplyType']) ?? null,
  placeOfSupply: row.placeOfSupply ?? null,
  cgstRate: row.cgstRate !== null ? toNumber(row.cgstRate) : null,
  cgstAmount: row.cgstAmount !== null ? toNumber(row.cgstAmount) : null,
  sgstRate: row.sgstRate !== null ? toNumber(row.sgstRate) : null,
  sgstAmount: row.sgstAmount !== null ? toNumber(row.sgstAmount) : null,
  igstRate: row.igstRate !== null ? toNumber(row.igstRate) : null,
  igstAmount: row.igstAmount !== null ? toNumber(row.igstAmount) : null,
});

const getInvoicesFromDb = async (
  req: AuthenticatedRequest,
  scope: Awaited<ReturnType<typeof resolveDataScope>>
): Promise<{
  success: true;
  data: Invoice[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const {
    page = 1,
    limit = 20,
    clientId,
    status,
    dateFrom,
    dateTo,
    search,
    sortBy = 'issueDate',
    sortOrder = 'desc',
  } = req.query;

  const conditions: string[] = [];
  const params: Array<string | number | number[]> = [];

  buildScopeSql(scope, conditions, params);

  if (clientId) {
    params.push(Number(clientId));
    conditions.push(`i.client_id = $${params.length}`);
  }

  if (status && typeof status === 'string') {
    const normalizedStatus = status.toUpperCase();
    if (normalizedStatus === STATUS.OVERDUE) {
      conditions.push(`i.status = '${STATUS.SENT}' AND i.paid_date IS NULL AND i.due_date < NOW()`);
    } else {
      params.push(normalizedStatus);
      conditions.push(`i.status = $${params.length}`);
    }
  }

  if (search && typeof search === 'string' && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      i.invoice_number ILIKE $${params.length} OR
      i.client_name ILIKE $${params.length} OR
      COALESCE(i.notes, '') ILIKE $${params.length}
    )`);
  }

  if (typeof dateFrom === 'string' && dateFrom) {
    params.push(dateFrom);
    conditions.push(`i.issue_date >= $${params.length}`);
  }

  if (typeof dateTo === 'string' && dateTo) {
    params.push(dateTo);
    conditions.push(`i.issue_date <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSortByMap: Record<string, string> = {
    invoiceNumber: 'i.invoice_number',
    clientName: 'i.client_name',
    amount: 'i.amount',
    totalAmount: 'i.total_amount',
    issueDate: 'i.issue_date',
    dueDate: 'i.due_date',
    status: 'i.status',
    createdAt: 'i.created_at',
  };
  const sortByValue = typeof sortBy === 'string' ? sortBy : 'issueDate';
  const sortOrderValue = typeof sortOrder === 'string' ? sortOrder : 'desc';
  const safeSortBy = safeSortByMap[sortByValue] || 'i.issue_date';
  const safeSortOrder = sortOrderValue.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(500, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text as total FROM invoices i ${whereClause}`,
    params
  );
  const total = Number(countResult.rows[0]?.total || 0);

  const listParams = [...params, limitNum, offset];
  const rows = await query<InvoiceListRow>(
    `SELECT
       i.id,
       i.invoice_number,
       i.client_id,
       i.product_id,
       i.client_name,
       i.amount::text,
       i.subtotal_amount::text,
       i.tax_amount::text,
       i.total_amount::text,
       i.currency,
       i.status,
       i.issue_date::text,
       i.due_date::text,
       i.paid_date::text,
       i.notes,
       i.created_at::text,
       i.updated_at::text,
       i.payment_method,
       i.transaction_id,
       i.supply_type,
       i.place_of_supply,
       i.cgst_rate::text,
       i.cgst_amount::text,
       i.sgst_rate::text,
       i.sgst_amount::text,
       i.igst_rate::text,
       i.igst_amount::text,
       c.code as client_code,
       c.email as client_email,
       c.phone as client_phone
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     ${whereClause}
     ORDER BY ${safeSortBy} ${safeSortOrder}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams
  );

  const invoiceIds = rows.rows.map(row => Number(row.id));
  const itemsMap = await loadInvoiceItems(invoiceIds);
  const data = rows.rows.map(row => normalizeInvoiceForResponse(mapDbInvoiceRow(row, itemsMap)));

  return {
    success: true,
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const getInvoiceByIdFromDb = async (
  id: string,
  scope: Awaited<ReturnType<typeof resolveDataScope>>,
  client: PoolClient | null = null
): Promise<Invoice | null> => {
  const invoiceSelectSql = `SELECT
     i.id,
     i.invoice_number,
     i.client_id,
     i.product_id,
     i.client_name,
     i.amount::text,
     i.subtotal_amount::text,
     i.tax_amount::text,
     i.total_amount::text,
     i.currency,
     i.status,
     i.issue_date::text,
     i.due_date::text,
     i.paid_date::text,
     i.notes,
     i.created_at::text,
     i.updated_at::text,
     i.payment_method,
     i.transaction_id,
     i.supply_type,
     i.place_of_supply,
     i.cgst_rate::text,
     i.cgst_amount::text,
     i.sgst_rate::text,
     i.sgst_amount::text,
     i.igst_rate::text,
     i.igst_amount::text,
     c.code as client_code,
     c.email as client_email,
     c.phone as client_phone
   FROM invoices i
   LEFT JOIN clients c ON c.id = i.client_id
   WHERE i.id = $1
   LIMIT 1`;

  const rowResult = client
    ? await client.query<InvoiceListRow>(invoiceSelectSql, [Number(id)])
    : await query<InvoiceListRow>(invoiceSelectSql, [Number(id)]);

  const row = rowResult.rows[0];
  if (!row) {
    return null;
  }

  const itemsMap = client
    ? await (async () => {
        const result = await client.query<InvoiceItemRow>(
          `SELECT
             ii.id,
             ii.invoice_id,
             ii.description,
             ii.quantity,
             ii.unit_price::text,
             ii.amount::text,
             COALESCE(array_agg(DISTINCT iit.case_id::text) FILTER (WHERE iit.case_id IS NOT NULL), ARRAY[]::text[]) as case_ids
           FROM invoice_items ii
           LEFT JOIN invoice_item_tasks iit ON iit.invoice_item_id = ii.id
           WHERE ii.invoice_id = $1
           GROUP BY ii.id, ii.invoice_id, ii.description, ii.quantity, ii.unit_price, ii.amount
           ORDER BY ii.id ASC`,
          [Number(row.id)]
        );
        const map = new Map<number, InvoiceItem[]>();
        map.set(
          Number(row.id),
          result.rows.map(itemRow => ({
            id: String(itemRow.id),
            invoiceId: String(itemRow.invoiceId),
            description: itemRow.description,
            quantity: Number(itemRow.quantity),
            unitPrice: toNumber(itemRow.unitPrice),
            amount: toNumber(itemRow.amount),
            totalPrice: toNumber(itemRow.amount),
            caseIds: Array.isArray(itemRow.caseIds) ? itemRow.caseIds : [],
          }))
        );
        return map;
      })()
    : await loadInvoiceItems([Number(row.id)]);

  const mapped = normalizeInvoiceForResponse(mapDbInvoiceRow(row, itemsMap));
  if (!invoiceAllowedByScope({ clientId: mapped.clientId, productId: row.productId }, scope)) {
    return null;
  }

  return mapped;
};

const getInvoiceStatsFromDb = async (
  scope: Awaited<ReturnType<typeof resolveDataScope>>,
  period: string
): Promise<Record<string, unknown>> => {
  const conditions: string[] = [];
  const params: Array<string | number | number[]> = [];
  buildScopeSql(scope, conditions, params);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<{
    totalInvoices: string;
    draftInvoices: string;
    sentInvoices: string;
    cancelledInvoices: string;
    overdueInvoices: string;
    totalAmount: string;
    outstandingAmount: string;
  }>(
    `SELECT
       COUNT(*)::text as total_invoices,
       COUNT(*) FILTER (WHERE i.status = '${STATUS.DRAFT}')::text as draft_invoices,
       COUNT(*) FILTER (WHERE i.status = '${STATUS.SENT}')::text as sent_invoices,
       COUNT(*) FILTER (WHERE i.status = '${STATUS.CANCELLED}')::text as cancelled_invoices,
       COUNT(*) FILTER (WHERE i.status = '${STATUS.SENT}' AND i.paid_date IS NULL AND i.due_date < NOW())::text as overdue_invoices,
       COALESCE(SUM(i.total_amount), 0)::text as total_amount,
       COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = '${STATUS.SENT}' AND i.paid_date IS NULL), 0)::text as outstanding_amount
     FROM invoices i
     ${whereClause}`,
    params
  );

  const stats = result.rows[0];
  const totalAmount = toNumber(stats?.totalAmount);

  return {
    totalInvoices: Number(stats?.totalInvoices || 0),
    paidInvoices: 0,
    pendingInvoices: Number(stats?.sentInvoices || 0),
    overdueInvoices: Number(stats?.overdueInvoices || 0),
    totalAmount,
    paidAmount: 0,
    pendingAmount: toNumber(stats?.outstandingAmount),
    collectionRate: 0,
    statusDistribution: {
      DRAFT: Number(stats?.draftInvoices || 0),
      SENT: Number(stats?.sentInvoices || 0),
      APPROVED: 0,
      PAID: 0,
      CANCELLED: Number(stats?.cancelledInvoices || 0),
      OVERDUE: Number(stats?.overdueInvoices || 0),
    },
    clientDistribution: {},
    period,
    generatedAt: new Date().toISOString(),
  };
};

const getInvoiceScopeRecord = async (
  id: string
): Promise<{ clientId: string; productId: number | null; status: string } | null> => {
  const result = await query<{ clientId: number; productId: number | null; status: string }>(
    'SELECT client_id, product_id, status FROM invoices WHERE id = $1 LIMIT 1',
    [Number(id)]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    clientId: String(row.clientId),
    productId: row.productId,
    status: row.status,
  };
};

const ensureInvoiceAccessible = async (
  req: AuthenticatedRequest,
  res: Response,
  id: string
): Promise<{ scope: Awaited<ReturnType<typeof resolveDataScope>>; status: string } | null> => {
  const scope = await resolveDataScope(req);
  const record = await getInvoiceScopeRecord(id);
  if (!record || !invoiceAllowedByScope(record, scope)) {
    res.status(404).json({
      success: false,
      message: 'Invoice not found',
      error: { code: 'NOT_FOUND' },
    });
    return null;
  }

  return { scope, status: record.status };
};

const recordInvoiceStatusHistory = async (
  client: PoolClient,
  invoiceId: number,
  fromStatus: string | null,
  toStatus: string,
  changedBy: string | undefined,
  notes?: string | null
): Promise<void> => {
  await client.query(
    `INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [invoiceId, fromStatus, toStatus, changedBy || null, notes || null]
  );
};

const getNextInvoiceIdentity = async (
  client: PoolClient
): Promise<{
  id: number;
  invoiceNumber: string;
  fiscalYear: string;
  invoiceSequenceNo: number;
}> => {
  const seqResult = await client.query<{ id: string }>(
    `SELECT nextval('invoices_id_seq')::text as id`
  );
  const id = Number(seqResult.rows[0].id);

  // GST-compliant per-FY numbering (CGST Rule 46(b)).
  // next_invoice_number() atomically increments invoice_sequences.current_value
  // for the current Indian fiscal year (Apr-Mar) and returns the formatted number.
  const fyResult = await client.query<{
    out_fiscal_year: string;
    out_sequence_no: number;
    out_formatted_number: string;
  }>(`SELECT * FROM next_invoice_number()`);
  const fy = fyResult.rows[0];

  return {
    id,
    invoiceNumber: fy.out_formatted_number,
    fiscalYear: fy.out_fiscal_year,
    invoiceSequenceNo: fy.out_sequence_no,
  };
};

const resolveTaskBillingAmount = async (
  task: InvoiceTaskCandidateRow
): Promise<{ amount: number; rateTypeId: number | null }> => {
  const candidateRateTypeId = toMaybeNumber(task.rateTypeId);

  // Issue 2 (audit 2026-05-12): FROZEN PRICING.
  // Field task billing amount is the snapshot persisted by
  // TaskCompletionFinalizer.snapshotFinancials at completion time
  // (`actual_amount = COALESCE(actual_amount, estimated_amount)`).
  // Once the snapshot is set, this resolver MUST NOT re-validate against
  // live rates/RTA/SZR — that would silently mutate DRAFT-invoice
  // amounts on every regen if an admin changes config between completion
  // and issuance. Same audit-safe model as KYC (already frozen via
  // resolveKycTaskBillingAmount).
  //
  // Fallback to live validation only when the snapshot is missing
  // (legacy data created before the finalizer landed, or edge cases
  // where actual_amount was somehow not persisted). The fail-loud
  // contract (B-1, 2026-05-10) is preserved in that fallback path —
  // never silently substitute.
  const snapshot = toMaybeNumber(task.actualAmount);
  if (snapshot !== null && Number.isFinite(snapshot) && snapshot >= 0) {
    return {
      amount: snapshot,
      rateTypeId: candidateRateTypeId,
    };
  }

  // Snapshot missing — fall through to live validation (defensive path).
  // Per B-1, fails loud rather than substituting estimated_amount silently.
  if (!task.verificationTypeId || !task.pincodeId) {
    throw new Error(
      `Billing amount cannot be resolved for verification task ${task.id} — ` +
        `actual_amount snapshot is missing AND verificationTypeId/pincodeId are ` +
        `not set for live re-resolution. Complete the task through the finalizer ` +
        `or reconfigure before billing.`
    );
  }

  const validation = await financialConfigurationValidator.validateTaskConfiguration(
    task.clientId,
    task.productId,
    task.verificationTypeId,
    task.pincodeId,
    task.areaId,
    candidateRateTypeId
  );

  if (validation.isValid && validation.amount !== undefined) {
    return {
      amount: Number(validation.amount),
      rateTypeId: validation.rateTypeId ?? candidateRateTypeId,
    };
  }

  throw new Error(
    `Billing amount cannot be resolved for verification task ${task.id} — ` +
      `${validation.errorCode ?? 'CONFIG_INVALID'}: ${validation.errorMessage ?? 'unknown'}. ` +
      `Reconfigure Rate Type Assignment / Rate Amounts / Service Zone Rules for ` +
      `client=${task.clientId} product=${task.productId} ` +
      `verificationType=${task.verificationTypeId} pincode=${task.pincodeId} ` +
      `area=${task.areaId ?? 'null'} before re-running invoice generation.`
  );
};

const loadCompletedUnbilledTasks = async (
  client: PoolClient,
  scope: Awaited<ReturnType<typeof resolveDataScope>>,
  clientId: number,
  selectedTaskIds: string[],
  selectedCaseIds: string[],
  productId?: number | null,
  billingPeriodFrom?: string,
  billingPeriodTo?: string
): Promise<InvoiceTaskCandidateRow[]> => {
  // C-2 (audit 2026-05-11): KYC tasks have NULL verification_type_id /
  // pincode_id by design (CHECK chk_vt_type_matches_task_type). They cannot
  // flow through resolveTaskBillingAmount and are loaded by the dedicated
  // loadCompletedUnbilledKycTasks helper instead. REVISIT tasks keep field
  // semantics (full-rate per business rule R2).
  const conditions: string[] = [
    `c.client_id = $1`,
    `vt.status = 'COMPLETED'`,
    `vt.task_type IN ('NORMAL', 'REVISIT')`,
    `iit.id IS NULL`,
  ];
  const params: Array<string | number | string[] | number[]> = [clientId];

  if (scope.restricted) {
    if (scope.assignedClientIds && scope.assignedClientIds.length > 0) {
      params.push(scope.assignedClientIds);
      conditions.push(`c.client_id = ANY($${params.length}::int[])`);
    }
    if (scope.assignedProductIds && scope.assignedProductIds.length > 0) {
      params.push(scope.assignedProductIds);
      conditions.push(`c.product_id = ANY($${params.length}::int[])`);
    }
  }

  if (productId) {
    params.push(productId);
    conditions.push(`c.product_id = $${params.length}`);
  }

  if (selectedTaskIds.length > 0) {
    params.push(selectedTaskIds);
    conditions.push(`vt.id = ANY($${params.length}::uuid[])`);
  }

  if (selectedCaseIds.length > 0) {
    params.push(selectedCaseIds);
    conditions.push(`vt.case_id = ANY($${params.length}::uuid[])`);
  }

  if (billingPeriodFrom) {
    params.push(billingPeriodFrom);
    conditions.push(`vt.completed_at >= $${params.length}`);
  }

  if (billingPeriodTo) {
    params.push(billingPeriodTo);
    conditions.push(`vt.completed_at <= $${params.length}`);
  }

  const result = await client.query<InvoiceTaskCandidateRow>(
    `SELECT
       vt.id,
       vt.case_id,
       vt.verification_type_id,
       vt.rate_type_id,
       vt.actual_amount::text,
       vt.estimated_amount::text,
       vt.area_id,
       vt.task_title,
       vt.task_type,
       p.id as pincode_id,
       c.client_id as client_id,
       c.product_id as product_id
     FROM verification_tasks vt
     JOIN cases c ON c.id = vt.case_id
     LEFT JOIN pincodes p ON p.id = vt.pincode_id
     LEFT JOIN invoice_item_tasks iit ON iit.verification_task_id = vt.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY COALESCE(vt.completed_at, vt.updated_at, vt.created_at) ASC`,
    params
  );

  return result.rows;
};

// KYC candidate row — sourced from verification_tasks where task_type='KYC',
// joined to kyc_document_verifications + document_types for description.
// Billing amount is the FROZEN snapshot from verification_tasks.estimated_amount
// (populated at case-create from kyc_rates per business rule).
type InvoiceKycTaskCandidateRow = {
  id: string;
  caseId: string;
  taskTitle: string | null;
  estimatedAmount: string | null;
  actualAmount: string | null;
  documentTypeId: number | null;
  documentTypeName: string | null;
  documentTypeCode: string | null;
  clientId: number;
  productId: number;
};

const loadCompletedUnbilledKycTasks = async (
  client: PoolClient,
  scope: Awaited<ReturnType<typeof resolveDataScope>>,
  clientId: number,
  selectedTaskIds: string[],
  selectedCaseIds: string[],
  productId?: number | null,
  billingPeriodFrom?: string,
  billingPeriodTo?: string
): Promise<InvoiceKycTaskCandidateRow[]> => {
  // C-2 + KYC billing (audit 2026-05-11): KYC tasks land in invoice_items
  // with frozen pricing from verification_tasks.estimated_amount.
  // KYC tasks don't have verification_type_id / pincode_id / area_id /
  // rate_type_id — they're priced via kyc_rates(client, product,
  // document_type) at case-create time and the snapshot is stored on the
  // task row. We do NOT re-resolve from kyc_rates here.
  const conditions: string[] = [
    `c.client_id = $1`,
    `vt.status = 'COMPLETED'`,
    `vt.task_type = 'KYC'`,
    `iit.id IS NULL`,
  ];
  const params: Array<string | number | string[] | number[]> = [clientId];

  if (scope.restricted) {
    if (scope.assignedClientIds && scope.assignedClientIds.length > 0) {
      params.push(scope.assignedClientIds);
      conditions.push(`c.client_id = ANY($${params.length}::int[])`);
    }
    if (scope.assignedProductIds && scope.assignedProductIds.length > 0) {
      params.push(scope.assignedProductIds);
      conditions.push(`c.product_id = ANY($${params.length}::int[])`);
    }
  }

  if (productId) {
    params.push(productId);
    conditions.push(`c.product_id = $${params.length}`);
  }

  if (selectedTaskIds.length > 0) {
    params.push(selectedTaskIds);
    conditions.push(`vt.id = ANY($${params.length}::uuid[])`);
  }

  if (selectedCaseIds.length > 0) {
    params.push(selectedCaseIds);
    conditions.push(`vt.case_id = ANY($${params.length}::uuid[])`);
  }

  if (billingPeriodFrom) {
    params.push(billingPeriodFrom);
    conditions.push(`vt.completed_at >= $${params.length}`);
  }

  if (billingPeriodTo) {
    params.push(billingPeriodTo);
    conditions.push(`vt.completed_at <= $${params.length}`);
  }

  const result = await client.query<InvoiceKycTaskCandidateRow>(
    `SELECT
       vt.id,
       vt.case_id,
       vt.task_title,
       vt.estimated_amount::text,
       vt.actual_amount::text,
       kdv.document_type_id,
       dt.name as document_type_name,
       dt.code as document_type_code,
       c.client_id as client_id,
       c.product_id as product_id
     FROM verification_tasks vt
     JOIN cases c ON c.id = vt.case_id
     LEFT JOIN kyc_document_verifications kdv
       ON kdv.verification_task_id = vt.id AND kdv.deleted_at IS NULL
     LEFT JOIN document_types dt ON dt.id = kdv.document_type_id
     LEFT JOIN invoice_item_tasks iit ON iit.verification_task_id = vt.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY COALESCE(vt.completed_at, vt.updated_at, vt.created_at) ASC`,
    params
  );

  return result.rows;
};

// Resolve the billing amount for a KYC task. Fails LOUD on missing snapshot
// to match the field-task contract (B-1 audit fix). KYC pricing is FROZEN at
// case-create time from kyc_rates; we never re-resolve.
const resolveKycTaskBillingAmount = (task: InvoiceKycTaskCandidateRow): { amount: number } => {
  const candidate = task.actualAmount ?? task.estimatedAmount;
  const parsed = candidate !== null && candidate !== undefined ? Number(candidate) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Billing amount cannot be resolved for KYC task ${task.id} — ` +
        `verification_tasks.actual_amount and estimated_amount are both NULL/invalid. ` +
        `KYC pricing snapshot is populated at case-create from kyc_rates; ` +
        `reconfigure kyc_rates for client=${task.clientId} product=${task.productId} ` +
        `documentType=${task.documentTypeId ?? 'null'} and re-create the task before billing.`
    );
  }
  return { amount: parsed };
};

const createInvoiceFromDb = async (req: AuthenticatedRequest, res: Response) => {
  const scope = await resolveDataScope(req);
  const body = req.body as CreateInvoiceBody;
  const clientId = toMaybeNumber(body.clientId);
  const dueDate = body.dueDate ? String(body.dueDate) : null;
  const currency = body.currency ? String(body.currency) : 'INR';
  const productId = toMaybeNumber(body.productId);

  if (!clientId || !dueDate) {
    return res.status(400).json({
      success: false,
      message: 'Client ID and due date are required',
      error: { code: 'VALIDATION_ERROR' },
    });
  }

  if (!invoiceAllowedByScope({ clientId: String(clientId), productId }, scope)) {
    return res.status(403).json({
      success: false,
      message: 'Client is outside assigned scope',
      error: { code: 'OUT_OF_SCOPE' },
    });
  }

  const selectedTaskIds = parseStringArray(body.taskIds);
  const selectedCaseIds = parseCaseIdsFromItems(body.items);

  try {
    const createdInvoiceId = await withTransaction(async client => {
      const clientRes = await client.query<{
        id: number;
        name: string;
        code: string;
        email: string | null;
        phone: string | null;
      }>(`SELECT id, name, code, email, phone FROM clients WHERE id = $1 LIMIT 1`, [clientId]);

      const clientRow = clientRes.rows[0];
      if (!clientRow) {
        throw new Error('Client not found');
      }

      const taskCandidates = await loadCompletedUnbilledTasks(
        client,
        scope,
        clientId,
        selectedTaskIds,
        selectedCaseIds,
        productId,
        body.billingPeriodFrom,
        body.billingPeriodTo
      );

      const kycTaskCandidates = await loadCompletedUnbilledKycTasks(
        client,
        scope,
        clientId,
        selectedTaskIds,
        selectedCaseIds,
        productId,
        body.billingPeriodFrom,
        body.billingPeriodTo
      );

      const hasLegacyManualItems = Array.isArray(body.items) && body.items.length > 0;
      const useTaskDrivenGeneration =
        taskCandidates.length > 0 ||
        kycTaskCandidates.length > 0 ||
        (!hasLegacyManualItems && selectedTaskIds.length === 0 && selectedCaseIds.length === 0);

      const {
        id: invoiceId,
        invoiceNumber,
        fiscalYear,
        invoiceSequenceNo,
      } = await getNextInvoiceIdentity(client);

      const generatedLines: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        verificationTypeId: number | null;
        rateTypeId: number | null;
        productId: number | null;
        linkedTasks: Array<{ taskId: string; caseId: string; billedAmount: number }>;
      }> = [];

      if (useTaskDrivenGeneration) {
        if (taskCandidates.length === 0 && kycTaskCandidates.length === 0) {
          throw new Error(
            'No completed unbilled verification tasks available for invoice generation'
          );
        }

        for (const task of taskCandidates) {
          const resolved = await resolveTaskBillingAmount(task);
          generatedLines.push({
            description: task.taskTitle || `Verification Task ${task.id}`,
            quantity: 1,
            unitPrice: resolved.amount,
            amount: resolved.amount,
            verificationTypeId: task.verificationTypeId,
            rateTypeId: resolved.rateTypeId,
            productId: task.productId,
            linkedTasks: [
              {
                taskId: task.id,
                caseId: task.caseId,
                billedAmount: resolved.amount,
              },
            ],
          });
        }

        // C-2 + KYC billing (audit 2026-05-11): KYC tasks land in invoice_items
        // with frozen pricing (no runtime re-resolution). verification_type_id
        // and rate_type_id are NULL (KYC pricing is keyed on document_type
        // via kyc_rates, snapshotted onto verification_tasks at
        // case-create).
        for (const kycTask of kycTaskCandidates) {
          const resolved = resolveKycTaskBillingAmount(kycTask);
          const docLabel = kycTask.documentTypeName || kycTask.documentTypeCode || 'Document';
          generatedLines.push({
            description: kycTask.taskTitle || `KYC Verification — ${docLabel}`,
            quantity: 1,
            unitPrice: resolved.amount,
            amount: resolved.amount,
            verificationTypeId: null,
            rateTypeId: null,
            productId: kycTask.productId,
            linkedTasks: [
              {
                taskId: kycTask.id,
                caseId: kycTask.caseId,
                billedAmount: resolved.amount,
              },
            ],
          });
        }
      } else {
        for (const item of body.items || []) {
          const quantity = Math.max(1, Number(item.quantity || 1));
          const unitPrice = Math.max(0, Number(item.unitPrice || 0));
          generatedLines.push({
            description: String(item.description || 'Invoice Item'),
            quantity,
            unitPrice,
            amount: quantity * unitPrice,
            verificationTypeId: null,
            rateTypeId: null,
            productId,
            linkedTasks: [],
          });
        }
      }

      const subtotalAmount = round2(generatedLines.reduce((sum, item) => sum + item.amount, 0));
      // Centralized GST resolver — fails LOUD if supplier state env is unset
      // or recipient state cannot be determined (per ops decision A1/C2).
      const gst = await resolveInvoiceGst(client, { clientId, subtotalAmount });

      await client.query(
        `INSERT INTO invoices (
           id, invoice_number, fiscal_year, invoice_sequence_no, client_id, product_id, client_name, amount,
           subtotal_amount, tax_amount, total_amount, currency, status,
           billing_period_from, billing_period_to, issue_date, due_date, notes, created_by,
           supply_type, place_of_supply,
           cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12, $13,
           $14, $15, CURRENT_TIMESTAMP, $16, $17, $18,
           $19, $20,
           $21, $22, $23, $24, $25, $26
         )`,
        [
          invoiceId,
          invoiceNumber,
          fiscalYear,
          invoiceSequenceNo,
          clientId,
          productId,
          body.clientName || clientRow.name,
          subtotalAmount,
          subtotalAmount,
          gst.taxAmount,
          gst.totalAmount,
          currency,
          STATUS.DRAFT,
          body.billingPeriodFrom || null,
          body.billingPeriodTo || null,
          dueDate,
          body.notes || null,
          req.user?.id || null,
          gst.supplyType,
          gst.placeOfSupply,
          gst.cgstRate,
          gst.cgstAmount,
          gst.sgstRate,
          gst.sgstAmount,
          gst.igstRate,
          gst.igstAmount,
        ]
      );

      for (const line of generatedLines) {
        const itemResult = await client.query<{ id: string }>(
          `INSERT INTO invoice_items (
             invoice_id, client_id, product_id, verification_type_id, rate_type_id,
             description, quantity, unit_price, amount
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id::text as id`,
          [
            invoiceId,
            clientId,
            line.productId,
            line.verificationTypeId,
            line.rateTypeId,
            line.description,
            line.quantity,
            line.unitPrice,
            line.amount,
          ]
        );

        const invoiceItemId = Number(itemResult.rows[0].id);

        // Batch all linked-task rows for this line into a single multi-row
        // INSERT. Previously this was a per-task INSERT inside the per-line
        // loop — O(tasks) sequential round-trips holding the invoice tx (and
        // the FY-sequence lock) open. Same rows/values, far fewer round-trips.
        if (line.linkedTasks.length > 0) {
          const taskValues = line.linkedTasks
            .map((_t, i) => {
              const o = i * 5;
              return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`;
            })
            .join(', ');
          const taskParams = line.linkedTasks.flatMap(linkedTask => [
            invoiceItemId,
            linkedTask.taskId,
            linkedTask.caseId,
            clientId,
            linkedTask.billedAmount,
          ]);
          await client.query(
            `INSERT INTO invoice_item_tasks (
               invoice_item_id, verification_task_id, case_id, client_id, billed_amount
             ) VALUES ${taskValues}`,
            taskParams
          );
        }
      }

      await recordInvoiceStatusHistory(
        client,
        invoiceId,
        null,
        STATUS.DRAFT,
        req.user?.id,
        'Invoice created'
      );
      return invoiceId;
    });

    const invoice = await getInvoiceByIdFromDb(String(createdInvoiceId), scope);
    if (!invoice) {
      return res.status(500).json({
        success: false,
        message: 'Invoice created but could not be loaded',
        error: { code: 'INTERNAL_ERROR' },
      });
    }

    logger.info(`Created invoice ${invoice.id}`, {
      userId: req.user?.id,
      clientId,
      source: 'database',
    });

    void createAuditLog({
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: String(invoice.id),
      userId: req.user?.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        clientId,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });

    return res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice created successfully',
    });
  } catch (error) {
    logger.error('Error creating invoice:', error);
    if (error instanceof GstConfigError) {
      return res.status(422).json({
        success: false,
        message: error.operatorMessage,
        error: { code: error.code },
      });
    }
    const message = error instanceof Error ? error.message : 'Failed to create invoice';
    return res.status(422).json({
      success: false,
      message,
      error: { code: 'INVOICE_GENERATION_FAILED' },
    });
  }
};

const updateInvoiceInDb = async (req: AuthenticatedRequest, res: Response) => {
  const id = getSingleParam(req.params.id);
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required',
      error: { code: 'VALIDATION_ERROR' },
    });
  }
  const accessible = await ensureInvoiceAccessible(req, res, id);
  if (!accessible) {
    return;
  }

  if (!requireControllerPermission(req, res, 'billing.generate')) {
    return;
  }

  if (accessible.status === STATUS.CANCELLED) {
    return res.status(400).json({
      success: false,
      message: 'Only draft or sent invoices can be updated',
      error: { code: 'INVALID_STATUS_TRANSITION' },
    });
  }

  const { dueDate, notes, items } = req.body as CreateInvoiceBody & {
    dueDate?: string;
    notes?: string;
  };

  try {
    await withTransaction(async client => {
      if (Array.isArray(items) && items.length > 0) {
        if (accessible.status !== STATUS.DRAFT) {
          throw new Error('Invoice items can only be modified while invoice is in draft status');
        }

        const linkCheck = await client.query<{ total: string }>(
          `SELECT COUNT(*)::text as total
           FROM invoice_item_tasks iit
           JOIN invoice_items ii ON ii.id = iit.invoice_item_id
           WHERE ii.invoice_id = $1`,
          [Number(id)]
        );

        if (Number(linkCheck.rows[0]?.total || 0) > 0) {
          throw new Error('Linked operational invoice items cannot be edited manually');
        }

        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [Number(id)]);

        let subtotal = 0;
        for (const item of items) {
          const quantity = Math.max(1, Number(item.quantity || 1));
          const unitPrice = Math.max(0, Number(item.unitPrice || 0));
          const amount = quantity * unitPrice;
          subtotal += amount;

          await client.query(
            `INSERT INTO invoice_items (
               invoice_id, client_id, product_id, verification_type_id, rate_type_id,
               description, quantity, unit_price, amount
             )
             SELECT $1, i.client_id, i.product_id, NULL, NULL, $2, $3, $4, $5
             FROM invoices i WHERE i.id = $1`,
            [Number(id), String(item.description || 'Invoice Item'), quantity, unitPrice, amount]
          );
        }

        // Centralized GST resolver — fails LOUD on config/data gaps.
        const subtotalRounded = round2(subtotal);
        const invClient = await client.query<{ clientId: number }>(
          `SELECT client_id FROM invoices WHERE id = $1`,
          [Number(id)]
        );
        const invClientId = Number(invClient.rows[0]?.clientId);
        const gst = await resolveInvoiceGst(client, {
          clientId: invClientId,
          subtotalAmount: subtotalRounded,
        });
        await client.query(
          `UPDATE invoices
           SET amount = $2,
               subtotal_amount = $2,
               tax_amount = $3,
               total_amount = $4,
               due_date = COALESCE($5, due_date),
               notes = COALESCE($6, notes),
               supply_type = $7,
               place_of_supply = $8,
               cgst_rate = $9,
               cgst_amount = $10,
               sgst_rate = $11,
               sgst_amount = $12,
               igst_rate = $13,
               igst_amount = $14,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [
            Number(id),
            subtotalRounded,
            gst.taxAmount,
            gst.totalAmount,
            dueDate || null,
            notes || null,
            gst.supplyType,
            gst.placeOfSupply,
            gst.cgstRate,
            gst.cgstAmount,
            gst.sgstRate,
            gst.sgstAmount,
            gst.igstRate,
            gst.igstAmount,
          ]
        );
      } else {
        await client.query(
          `UPDATE invoices
           SET due_date = COALESCE($2, due_date),
               notes = COALESCE($3, notes),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [Number(id), dueDate || null, notes || null]
        );
      }
    });

    const invoice = await getInvoiceByIdFromDb(id, accessible.scope);
    void createAuditLog({
      action: 'INVOICE_UPDATED',
      entityType: 'INVOICE',
      entityId: id,
      userId: req.user?.id,
      details: {
        invoiceNumber: invoice?.invoiceNumber,
        status: invoice?.status,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
    return res.json({
      success: true,
      data: invoice,
      message: 'Invoice updated successfully',
    });
  } catch (error) {
    logger.error('Error updating invoice:', error);
    if (error instanceof GstConfigError) {
      return res.status(422).json({
        success: false,
        message: error.operatorMessage,
        error: { code: error.code },
      });
    }
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update invoice',
      error: { code: 'INVOICE_UPDATE_FAILED' },
    });
  }
};

const deleteInvoiceInDb = async (req: AuthenticatedRequest, res: Response) => {
  const id = getSingleParam(req.params.id);
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required',
      error: { code: 'VALIDATION_ERROR' },
    });
  }
  const accessible = await ensureInvoiceAccessible(req, res, id);
  if (!accessible) {
    return;
  }

  if (!requireControllerPermission(req, res, 'billing.generate')) {
    return;
  }

  if (accessible.status !== STATUS.DRAFT && accessible.status !== STATUS.CANCELLED) {
    return res.status(400).json({
      success: false,
      message: 'Only draft or cancelled invoices can be deleted',
      error: { code: 'INVALID_STATUS_TRANSITION' },
    });
  }

  await query('DELETE FROM invoices WHERE id = $1', [Number(id)]);
  void createAuditLog({
    action: 'INVOICE_DELETED',
    entityType: 'INVOICE',
    entityId: id,
    userId: req.user?.id,
    details: { previousStatus: accessible.status },
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || undefined,
  });
  return res.json({
    success: true,
    message: 'Invoice deleted successfully',
  });
};

const regenerateInvoiceInDb = async (req: AuthenticatedRequest, res: Response) => {
  const id = getSingleParam(req.params.id);
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required',
      error: { code: 'VALIDATION_ERROR' },
    });
  }
  const accessible = await ensureInvoiceAccessible(req, res, id);
  if (!accessible) {
    return;
  }

  if (!requireControllerPermission(req, res, 'billing.generate')) {
    return;
  }

  if (accessible.status !== STATUS.DRAFT) {
    return res.status(400).json({
      success: false,
      message: 'Only draft invoices can be regenerated',
      error: { code: 'INVALID_STATUS_TRANSITION' },
    });
  }

  try {
    await withTransaction(async client => {
      const linkedTasks = await client.query<{
        linkId: number;
        invoiceItemId: number;
        verificationTaskId: string;
        caseId: string;
        verificationTypeId: number | null;
        rateTypeId: number | null;
        actualAmount: string | null;
        estimatedAmount: string | null;
        areaId: number | null;
        taskTitle: string | null;
        taskType: 'NORMAL' | 'REVISIT' | 'KYC' | null;
        pincodeId: number | null;
        clientId: number;
        productId: number;
      }>(
        `SELECT
           iit.id as link_id,
           iit.invoice_item_id,
           iit.verification_task_id,
           iit.case_id,
           vt.verification_type_id,
           vt.rate_type_id,
           vt.actual_amount::text,
           vt.estimated_amount::text,
           vt.area_id,
           vt.task_title,
           vt.task_type,
           p.id as pincode_id,
           c.client_id as client_id,
           c.product_id as product_id
         FROM invoice_item_tasks iit
         JOIN verification_tasks vt ON vt.id = iit.verification_task_id
         JOIN cases c ON c.id = vt.case_id
         LEFT JOIN pincodes p ON p.id = vt.pincode_id
         JOIN invoice_items ii ON ii.id = iit.invoice_item_id
         WHERE ii.invoice_id = $1`,
        [Number(id)]
      );

      if (linkedTasks.rows.length === 0) {
        throw new Error('Invoice has no linked operational tasks to regenerate');
      }

      for (const linkedTask of linkedTasks.rows) {
        // KYC tasks have NULL verification_type_id/pincode_id by design —
        // route them through the KYC-specific resolver which reads the
        // frozen snapshot off the task row.
        const resolved =
          linkedTask.taskType === 'KYC'
            ? resolveKycTaskBillingAmount({
                id: linkedTask.verificationTaskId,
                caseId: linkedTask.caseId,
                taskTitle: linkedTask.taskTitle,
                estimatedAmount: linkedTask.estimatedAmount,
                actualAmount: linkedTask.actualAmount,
                documentTypeId: null,
                documentTypeName: null,
                documentTypeCode: null,
                clientId: linkedTask.clientId,
                productId: linkedTask.productId,
              })
            : await resolveTaskBillingAmount({
                id: linkedTask.verificationTaskId,
                caseId: linkedTask.caseId,
                verificationTypeId: linkedTask.verificationTypeId,
                rateTypeId: linkedTask.rateTypeId,
                actualAmount: linkedTask.actualAmount,
                estimatedAmount: linkedTask.estimatedAmount,
                areaId: linkedTask.areaId,
                taskTitle: linkedTask.taskTitle,
                taskType: linkedTask.taskType ?? 'NORMAL',
                pincodeId: linkedTask.pincodeId,
                clientId: linkedTask.clientId,
                productId: linkedTask.productId,
              });

        await client.query(`UPDATE invoice_item_tasks SET billed_amount = $2 WHERE id = $1`, [
          linkedTask.linkId,
          resolved.amount,
        ]);
      }

      await client.query(
        `UPDATE invoice_items ii
         SET amount = agg.total_amount,
             unit_price = CASE WHEN ii.quantity > 0 THEN (agg.total_amount / ii.quantity) ELSE ii.unit_price END,
             updated_at = CURRENT_TIMESTAMP
         FROM (
           SELECT iit.invoice_item_id, SUM(iit.billed_amount) as total_amount
           FROM invoice_item_tasks iit
           GROUP BY iit.invoice_item_id
         ) agg
         WHERE ii.id = agg.invoice_item_id
           AND ii.invoice_id = $1`,
        [Number(id)]
      );

      const totals = await client.query<{ subtotal: string; clientId: number }>(
        `SELECT COALESCE(SUM(ii.amount), 0)::text as subtotal, i.client_id
           FROM invoices i
           LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
          WHERE i.id = $1
          GROUP BY i.id`,
        [Number(id)]
      );
      const subtotal = round2(toNumber(totals.rows[0]?.subtotal));
      const invClientId = Number(totals.rows[0]?.clientId);
      // Centralized GST resolver — keeps regen identical to create/update paths.
      const gst = await resolveInvoiceGst(client, {
        clientId: invClientId,
        subtotalAmount: subtotal,
      });

      await client.query(
        `UPDATE invoices
         SET amount = $2,
             subtotal_amount = $2,
             tax_amount = $3,
             total_amount = $4,
             supply_type = $5,
             place_of_supply = $6,
             cgst_rate = $7,
             cgst_amount = $8,
             sgst_rate = $9,
             sgst_amount = $10,
             igst_rate = $11,
             igst_amount = $12,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          Number(id),
          subtotal,
          gst.taxAmount,
          gst.totalAmount,
          gst.supplyType,
          gst.placeOfSupply,
          gst.cgstRate,
          gst.cgstAmount,
          gst.sgstRate,
          gst.sgstAmount,
          gst.igstRate,
          gst.igstAmount,
        ]
      );

      await recordInvoiceStatusHistory(
        client,
        Number(id),
        STATUS.DRAFT,
        STATUS.DRAFT,
        req.user?.id,
        'Invoice regenerated'
      );
    });

    const invoice = await getInvoiceByIdFromDb(id, accessible.scope);
    void createAuditLog({
      action: 'INVOICE_REGENERATED',
      entityType: 'INVOICE',
      entityId: id,
      userId: req.user?.id,
      details: {
        invoiceNumber: invoice?.invoiceNumber,
        totalAmount: invoice?.totalAmount,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
    return res.json({
      success: true,
      data: invoice,
      message: 'Invoice regenerated successfully',
    });
  } catch (error) {
    logger.error('Error regenerating invoice:', error);
    if (error instanceof GstConfigError) {
      return res.status(422).json({
        success: false,
        message: error.operatorMessage,
        error: { code: error.code },
      });
    }
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to regenerate invoice',
      error: { code: 'INVOICE_REGENERATE_FAILED' },
    });
  }
};

const transitionInvoiceStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  id: string,
  nextStatus: string,
  allowedCurrent: string[],
  permissionCode: string,
  message: string,
  extraUpdate?: {
    notes?: string | null;
    sentAt?: boolean;
  }
) => {
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required',
      error: { code: 'VALIDATION_ERROR' },
    });
  }

  const accessible = await ensureInvoiceAccessible(req, res, id);
  if (!accessible) {
    return;
  }

  if (!requireControllerPermission(req, res, permissionCode)) {
    return;
  }

  if (!allowedCurrent.includes(accessible.status)) {
    return res.status(400).json({
      success: false,
      message: `Invoice cannot transition from ${accessible.status} to ${nextStatus}`,
      error: { code: 'INVALID_STATUS_TRANSITION' },
    });
  }

  await withTransaction(async client => {
    const updateFields: string[] = ['status = $1::varchar', 'updated_at = CURRENT_TIMESTAMP'];
    const params: Array<string | number | null> = [nextStatus];

    if (extraUpdate?.sentAt) {
      updateFields.push('sent_at = CURRENT_TIMESTAMP');
    }

    if (extraUpdate?.notes) {
      updateFields.push(
        `notes = COALESCE(notes, '') || CASE WHEN COALESCE(notes, '') = '' THEN $${params.length + 1}::text ELSE E'\\n' || $${params.length + 1}::text END`
      );
      params.push(extraUpdate.notes);
    }

    params.push(Number(id));

    await client.query(
      `UPDATE invoices
       SET ${updateFields.join(', ')}
       WHERE id = $${params.length}`,
      params
    );

    // H-8 (audit 2026-05-11): on CANCELLED transition, sever the
    // task↔invoice link rows so the underlying verification tasks become
    // re-billable. Without this, the global UNIQUE on
    // invoice_item_tasks.verification_task_id permanently locks the task
    // out of any future invoice. invoice_items + invoices remain (audit
    // trail intact via invoice_items.description + status_history).
    if (nextStatus === STATUS.CANCELLED) {
      await client.query(
        `DELETE FROM invoice_item_tasks
         WHERE invoice_item_id IN (
           SELECT id FROM invoice_items WHERE invoice_id = $1
         )`,
        [Number(id)]
      );
    }

    await recordInvoiceStatusHistory(
      client,
      Number(id),
      accessible.status,
      nextStatus,
      req.user?.id,
      extraUpdate?.notes || null
    );
  });

  const invoice = await getInvoiceByIdFromDb(id, accessible.scope);
  void createAuditLog({
    action: `INVOICE_STATUS_${nextStatus}`,
    entityType: 'INVOICE',
    entityId: id,
    userId: req.user?.id,
    details: {
      invoiceNumber: invoice?.invoiceNumber,
      fromStatus: accessible.status,
      toStatus: nextStatus,
      notes: extraUpdate?.notes || undefined,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || undefined,
  });
  return res.json({
    success: true,
    data: invoice,
    message,
  });
};

// GET /api/invoices - List invoices with pagination and filters
export const getInvoices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveDataScope(req);
    const response = await getInvoicesFromDb(req, scope);

    logger.info(`Retrieved ${response.data.length} invoices from database`, {
      userId: req.user?.id,
      filters: req.query,
    });

    return res.json(response);
  } catch (error) {
    logger.error('Error retrieving invoices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoices',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/invoices/:id - Get invoice by ID
export const getInvoiceById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveDataScope(req);
    const id = getSingleParam(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invoice ID is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }
    const invoice = await getInvoiceByIdFromDb(id, scope);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved invoice ${id}`, { userId: req.user?.id });
    return res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    logger.error('Error retrieving invoice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoice',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/invoices - Create new invoice
export const createInvoice = async (req: AuthenticatedRequest, res: Response) =>
  createInvoiceFromDb(req, res);

// PUT /api/invoices/:id - Update invoice
export const updateInvoice = async (req: AuthenticatedRequest, res: Response) =>
  updateInvoiceInDb(req, res);

// DELETE /api/invoices/:id - Delete invoice
export const deleteInvoice = async (req: AuthenticatedRequest, res: Response) =>
  deleteInvoiceInDb(req, res);

// POST /api/invoices/:id/regenerate - Regenerate invoice lines
export const regenerateInvoice = async (req: AuthenticatedRequest, res: Response) =>
  regenerateInvoiceInDb(req, res);

// POST /api/invoices/:id/cancel - Cancel invoice
export const cancelInvoice = async (req: AuthenticatedRequest, res: Response) =>
  transitionInvoiceStatus(
    req,
    res,
    getSingleParam(req.params.id) || '',
    STATUS.CANCELLED,
    [STATUS.DRAFT, STATUS.SENT],
    'billing.generate',
    'Invoice cancelled successfully',
    { notes: (req.body?.reason as string) || 'Invoice cancelled' }
  );

// POST /api/invoices/:id/send - Send invoice
export const sendInvoice = async (req: AuthenticatedRequest, res: Response) =>
  transitionInvoiceStatus(
    req,
    res,
    getSingleParam(req.params.id) || '',
    STATUS.SENT,
    [STATUS.DRAFT],
    'billing.generate',
    'Invoice sent successfully',
    { sentAt: true, notes: (req.body?.message as string) || 'Invoice sent' }
  );

// GET /api/invoices/:id/download - Download invoice payload
export const downloadInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveDataScope(req);
    const id = getSingleParam(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invoice ID is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }
    const invoice = await getInvoiceByIdFromDb(id, scope);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const format = typeof req.query.format === 'string' ? req.query.format.toUpperCase() : 'PDF';

    if (format === 'EXCEL') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Invoice');
      worksheet.columns = [
        { header: 'Invoice Number', key: 'invoiceNumber', width: 24 },
        { header: 'Client', key: 'clientName', width: 28 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Issue Date', key: 'issueDate', width: 22 },
        { header: 'Due Date', key: 'dueDate', width: 22 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Unit Price', key: 'unitPrice', width: 14 },
        { header: 'Line Amount', key: 'amount', width: 14 },
      ];

      invoice.items.forEach(item => {
        worksheet.addRow({
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.client?.name ?? 'Unknown',
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        });
      });

      if (invoice.items.length === 0) {
        worksheet.addRow({
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.client?.name ?? 'Unknown',
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
        });
      }

      // GST summary worksheet (Rule 46 — supply type + tax split breakdown).
      const summary = workbook.addWorksheet('Summary');
      summary.columns = [
        { header: 'Field', key: 'field', width: 26 },
        { header: 'Value', key: 'value', width: 28 },
      ];
      summary.getRow(1).font = { bold: true };
      summary.addRow({ field: 'Invoice Number', value: invoice.invoiceNumber });
      summary.addRow({ field: 'Client', value: invoice.client?.name ?? 'Unknown' });
      summary.addRow({ field: 'Status', value: invoice.status });
      summary.addRow({
        field: 'Subtotal',
        value: invoice.subtotalAmount ?? invoice.amount,
      });
      if (invoice.supplyType) {
        summary.addRow({ field: 'Supply Type', value: invoice.supplyType });
        summary.addRow({ field: 'Place of Supply', value: invoice.placeOfSupply ?? '' });
      }
      if (invoice.supplyType === 'INTRA_STATE') {
        summary.addRow({ field: 'CGST Rate (%)', value: invoice.cgstRate ?? 0 });
        summary.addRow({ field: 'CGST Amount', value: invoice.cgstAmount ?? 0 });
        summary.addRow({ field: 'SGST Rate (%)', value: invoice.sgstRate ?? 0 });
        summary.addRow({ field: 'SGST Amount', value: invoice.sgstAmount ?? 0 });
      } else if (invoice.supplyType === 'INTER_STATE') {
        summary.addRow({ field: 'IGST Rate (%)', value: invoice.igstRate ?? 0 });
        summary.addRow({ field: 'IGST Amount', value: invoice.igstAmount ?? 0 });
      }
      summary.addRow({ field: 'Tax Amount', value: invoice.taxAmount });
      summary.addRow({ field: 'Total Amount', value: invoice.totalAmount });

      const workbookBuffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.xlsx"`);

      logger.info(`Invoice download requested: ${id}`, {
        userId: req.user?.id,
        invoiceNumber: invoice.invoiceNumber,
        format,
      });

      return res.send(Buffer.from(workbookBuffer));
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Invoice ${invoice.invoiceNumber}`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Client: ${invoice.client?.name ?? 'Unknown'}`, 14, 28);
    doc.text(`Status: ${invoice.status}`, 14, 36);
    doc.text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 14, 44);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 14, 52);
    if (invoice.supplyType) {
      doc.text(
        `Supply Type: ${invoice.supplyType}  |  Place of Supply: ${invoice.placeOfSupply ?? '-'}`,
        14,
        60
      );
    }
    doc.text('Items:', 14, invoice.supplyType ? 72 : 64);

    let y = invoice.supplyType ? 82 : 74;
    invoice.items.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.description} | Qty ${item.quantity} | INR ${item.amount.toFixed(2)}`,
        14,
        y
      );
      y += 8;
      if (y > 245) {
        doc.addPage();
        y = 20;
      }
    });

    // GST summary block — Rule 46 (CGST/SGST or IGST + place_of_supply).
    y = Math.min(y + 4, 248);
    const subtotalForPdf = invoice.subtotalAmount ?? invoice.amount;
    doc.text(`Subtotal: INR ${subtotalForPdf.toFixed(2)}`, 14, y);
    y += 8;
    if (invoice.supplyType === 'INTRA_STATE') {
      doc.text(
        `CGST @ ${(invoice.cgstRate ?? 0).toFixed(2)}%: INR ${(invoice.cgstAmount ?? 0).toFixed(2)}`,
        14,
        y
      );
      y += 8;
      doc.text(
        `SGST @ ${(invoice.sgstRate ?? 0).toFixed(2)}%: INR ${(invoice.sgstAmount ?? 0).toFixed(2)}`,
        14,
        y
      );
      y += 8;
    } else if (invoice.supplyType === 'INTER_STATE') {
      doc.text(
        `IGST @ ${(invoice.igstRate ?? 0).toFixed(2)}%: INR ${(invoice.igstAmount ?? 0).toFixed(2)}`,
        14,
        y
      );
      y += 8;
    } else {
      doc.text(`Tax Amount: INR ${invoice.taxAmount.toFixed(2)}`, 14, y);
      y += 8;
    }
    doc.setFontSize(12);
    doc.text(`Total Amount: INR ${invoice.totalAmount.toFixed(2)}`, 14, y);
    doc.setFontSize(11);

    if (invoice.notes) {
      doc.text(`Notes: ${invoice.notes}`, 14, Math.min(y + 12, 285));
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);

    logger.info(`Invoice download requested: ${id}`, {
      userId: req.user?.id,
      invoiceNumber: invoice.invoiceNumber,
      format,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating invoice download:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate invoice download',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/invoices/export - Export all invoices to Excel
export const exportInvoicesToExcel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveDataScope(req);
    const { status, clientId, dateFrom, dateTo, search, sortBy, sortOrder } = req.query;

    // M-4 (audit 2026-05-11): use the central scope helper so empty
    // assignedClientIds falls back to '1=0' (zero results) instead of
    // silently widening to all invoices. Listing endpoint already uses
    // buildScopeSql; export was inlining a non-equivalent length>0 check.
    const conditions: string[] = [];
    const params: Array<string | number | boolean | string[] | number[]> = [];
    appendOperationalScopeConditions({
      scope,
      conditions,
      params,
      clientExpr: 'i.client_id',
    });
    let idx = params.length + 1;

    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(
        `(i.invoice_number ILIKE $${idx} OR c.name ILIKE $${idx} OR COALESCE(i.notes, '') ILIKE $${idx})`
      );
      params.push(`%${search.trim()}%`);
      idx++;
    }
    if (status) {
      conditions.push(`i.status = $${idx++}`);
      params.push(status as string);
    }
    if (clientId) {
      conditions.push(`i.client_id = $${idx++}`);
      params.push(Number(clientId));
    }
    if (dateFrom) {
      conditions.push(`i.issue_date >= $${idx++}`);
      params.push(dateFrom as string);
    }
    if (dateTo) {
      conditions.push(`i.issue_date <= $${idx++}`);
      params.push(`${dateTo as string} 23:59:59`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderByColumn = INVOICE_SORT_MAP[sortBy as string] ?? 'i.created_at';
    const orderByDirection = (sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const limitParamIndex = params.length + 1;
    params.push(INVOICE_EXPORT_ROW_LIMIT);

    const result = await query(
      `
      SELECT
        i.invoice_number,
        c.name as client_name,
        i.status,
        i.issue_date,
        i.due_date,
        i.subtotal_amount as subtotal,
        i.tax_amount,
        i.total_amount,
        i.supply_type,
        i.place_of_supply,
        i.cgst_rate,
        i.cgst_amount,
        i.sgst_rate,
        i.sgst_amount,
        i.igst_rate,
        i.igst_amount,
        i.notes,
        i.created_at
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ${whereClause}
      ORDER BY ${orderByColumn} ${orderByDirection} NULLS LAST
      LIMIT $${limitParamIndex}
    `,
      params
    );

    await createAuditLog({
      userId: req.user?.id,
      action: 'INVOICE_EXPORTED',
      entityType: 'invoice',
      details: { recordCount: result.rows.length, filters: req.query },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoices');

    worksheet.columns = [
      { header: 'Invoice #', key: 'invoiceNumber', width: 22 },
      { header: 'Client', key: 'clientName', width: 25 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Issue Date', key: 'issueDate', width: 18 },
      { header: 'Due Date', key: 'dueDate', width: 18 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Supply Type', key: 'supplyType', width: 14 },
      { header: 'Place of Supply', key: 'placeOfSupply', width: 14 },
      { header: 'CGST %', key: 'cgstRate', width: 10 },
      { header: 'CGST Amount', key: 'cgstAmount', width: 14 },
      { header: 'SGST %', key: 'sgstRate', width: 10 },
      { header: 'SGST Amount', key: 'sgstAmount', width: 14 },
      { header: 'IGST %', key: 'igstRate', width: 10 },
      { header: 'IGST Amount', key: 'igstAmount', width: 14 },
      { header: 'Tax Amount', key: 'taxAmount', width: 14 },
      { header: 'Total Amount', key: 'totalAmount', width: 16 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    result.rows.forEach((row: Record<string, unknown>) => {
      worksheet.addRow(
        escapeFormulaRow({
          ...row,
          subtotal: row.subtotal ? Number(row.subtotal) : 0,
          taxAmount: row.taxAmount ? Number(row.taxAmount) : 0,
          totalAmount: row.totalAmount ? Number(row.totalAmount) : 0,
          supplyType: row.supplyType ?? '',
          placeOfSupply: row.placeOfSupply ?? '',
          cgstRate: row.cgstRate !== null && row.cgstRate !== undefined ? Number(row.cgstRate) : '',
          cgstAmount:
            row.cgstAmount !== null && row.cgstAmount !== undefined ? Number(row.cgstAmount) : '',
          sgstRate: row.sgstRate !== null && row.sgstRate !== undefined ? Number(row.sgstRate) : '',
          sgstAmount:
            row.sgstAmount !== null && row.sgstAmount !== undefined ? Number(row.sgstAmount) : '',
          igstRate: row.igstRate !== null && row.igstRate !== undefined ? Number(row.igstRate) : '',
          igstAmount:
            row.igstAmount !== null && row.igstAmount !== undefined ? Number(row.igstAmount) : '',
          issueDate: row.issueDate ? new Date(row.issueDate as string).toLocaleDateString() : '',
          dueDate: row.dueDate ? new Date(row.dueDate as string).toLocaleDateString() : '',
          createdAt: row.createdAt ? new Date(row.createdAt as string).toLocaleString() : '',
        })
      );
    });

    worksheet.autoFilter = { from: 'A1', to: `R${result.rows.length + 1}` };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoices_export_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    logger.error('Error exporting invoices:', error);
    return res.status(500).json({ success: false, message: 'Failed to export invoices' });
  }
};

// GET /api/invoices/stats - Get invoice statistics
export const getInvoiceStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveDataScope(req);
    const period = typeof req.query.period === 'string' ? req.query.period : 'month';
    const stats = await getInvoiceStatsFromDb(scope, period);

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting invoice stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get invoice statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
