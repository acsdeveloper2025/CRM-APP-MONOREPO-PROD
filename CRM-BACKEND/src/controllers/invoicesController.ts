import type { Response } from 'express';
import type { PoolClient } from 'pg';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { query, withTransaction } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { requireControllerPermission } from '@/security/controllerAuthorization';
import { resolveDataScope, valueAllowedByScope } from '@/security/dataScope';
import { financialConfigurationValidator } from '@/services/financialConfigurationValidator';

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
}

type InvoiceListRow = {
  id: number;
  invoice_number: string;
  client_id: number;
  product_id: number | null;
  client_name: string;
  amount: string;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  status: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  payment_method: string | null;
  transaction_id: string | null;
  client_code: string | null;
  client_email: string | null;
  client_phone: string | null;
};

type InvoiceItemRow = {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: string;
  amount: string;
  case_ids: string[] | null;
};

type InvoiceTaskCandidateRow = {
  id: string;
  case_id: string;
  verification_type_id: number | null;
  rate_type_id: number | null;
  actual_amount: string | null;
  estimated_amount: string | null;
  area_id: number | null;
  task_title: string | null;
  pincode_id: number | null;
  client_id: number;
  product_id: number;
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
    const current = map.get(Number(row.invoice_id)) || [];
    current.push({
      id: String(row.id),
      invoiceId: String(row.invoice_id),
      description: row.description,
      quantity: Number(row.quantity),
      unitPrice: toNumber(row.unit_price),
      amount: toNumber(row.amount),
      totalPrice: toNumber(row.amount),
      caseIds: Array.isArray(row.case_ids) ? row.case_ids : [],
    });
    map.set(Number(row.invoice_id), current);
  });

  return map;
};

const mapDbInvoiceRow = (
  row: InvoiceListRow,
  itemsMap: Map<number, InvoiceItem[]>
): Invoice & { productId?: number | null } => ({
  id: String(row.id),
  invoiceNumber: row.invoice_number,
  clientId: String(row.client_id),
  clientName: row.client_name,
  client: {
    id: String(row.client_id),
    name: row.client_name,
    code: row.client_code || String(row.client_id),
    ...(row.client_email ? { email: row.client_email } : {}),
    ...(row.client_phone ? { phone: row.client_phone } : {}),
  },
  productId: row.product_id,
  amount: toNumber(row.amount),
  subtotalAmount: toNumber(row.subtotal_amount),
  currency: row.currency,
  status: row.status,
  dueDate: row.due_date,
  issueDate: row.issue_date,
  paidDate: row.paid_date,
  items: itemsMap.get(Number(row.id)) || [],
  taxAmount: toNumber(row.tax_amount),
  totalAmount: toNumber(row.total_amount),
  notes: row.notes || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.payment_method ? { paymentMethod: row.payment_method } : {}),
  ...(row.transaction_id ? { transactionId: row.transaction_id } : {}),
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
            invoiceId: String(itemRow.invoice_id),
            description: itemRow.description,
            quantity: Number(itemRow.quantity),
            unitPrice: toNumber(itemRow.unit_price),
            amount: toNumber(itemRow.amount),
            totalPrice: toNumber(itemRow.amount),
            caseIds: Array.isArray(itemRow.case_ids) ? itemRow.case_ids : [],
          }))
        );
        return map;
      })()
    : await loadInvoiceItems([Number(row.id)]);

  const mapped = normalizeInvoiceForResponse(mapDbInvoiceRow(row, itemsMap));
  if (!invoiceAllowedByScope({ clientId: mapped.clientId, productId: row.product_id }, scope)) {
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
    total_invoices: string;
    draft_invoices: string;
    sent_invoices: string;
    cancelled_invoices: string;
    overdue_invoices: string;
    total_amount: string;
    outstanding_amount: string;
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
  const totalAmount = toNumber(stats?.total_amount);

  return {
    totalInvoices: Number(stats?.total_invoices || 0),
    paidInvoices: 0,
    pendingInvoices: Number(stats?.sent_invoices || 0),
    overdueInvoices: Number(stats?.overdue_invoices || 0),
    totalAmount,
    paidAmount: 0,
    pendingAmount: toNumber(stats?.outstanding_amount),
    collectionRate: 0,
    statusDistribution: {
      DRAFT: Number(stats?.draft_invoices || 0),
      SENT: Number(stats?.sent_invoices || 0),
      APPROVED: 0,
      PAID: 0,
      CANCELLED: Number(stats?.cancelled_invoices || 0),
      OVERDUE: Number(stats?.overdue_invoices || 0),
    },
    clientDistribution: {},
    period,
    generatedAt: new Date().toISOString(),
  };
};

const getInvoiceScopeRecord = async (
  id: string
): Promise<{ clientId: string; productId: number | null; status: string } | null> => {
  const result = await query<{ client_id: number; product_id: number | null; status: string }>(
    'SELECT client_id, product_id, status FROM invoices WHERE id = $1 LIMIT 1',
    [Number(id)]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    clientId: String(row.client_id),
    productId: row.product_id,
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
): Promise<{ id: number; invoiceNumber: string }> => {
  const seqResult = await client.query<{ id: string }>(
    `SELECT nextval('invoices_id_seq')::text as id`
  );
  const id = Number(seqResult.rows[0].id);
  const year = new Date().getFullYear();
  return {
    id,
    invoiceNumber: `INV-${year}-${String(id).padStart(6, '0')}`,
  };
};

const resolveTaskBillingAmount = async (
  task: InvoiceTaskCandidateRow
): Promise<{ amount: number; rateTypeId: number | null }> => {
  const candidateRateTypeId = toMaybeNumber(task.rate_type_id);
  if (task.verification_type_id && task.pincode_id) {
    const validation = await financialConfigurationValidator.validateTaskConfiguration(
      task.client_id,
      task.product_id,
      task.verification_type_id,
      task.pincode_id,
      task.area_id,
      candidateRateTypeId
    );

    if (validation.isValid && validation.amount !== undefined) {
      return {
        amount: Number(validation.amount),
        rateTypeId: validation.rateTypeId ?? candidateRateTypeId,
      };
    }
  }

  const fallbackAmount = toNumber(task.actual_amount) || toNumber(task.estimated_amount);
  if (fallbackAmount > 0) {
    return {
      amount: fallbackAmount,
      rateTypeId: candidateRateTypeId,
    };
  }

  throw new Error(`Billing amount not defined for verification task ${task.id}`);
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
  const conditions: string[] = [`c.client_id = $1`, `vt.status = 'COMPLETED'`, `iit.id IS NULL`];
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
       p.id as pincode_id,
       c.client_id as client_id,
       c.product_id as product_id
     FROM verification_tasks vt
     JOIN cases c ON c.id = vt.case_id
     LEFT JOIN pincodes p ON p.code = COALESCE(vt.pincode, c."pincode")
     LEFT JOIN invoice_item_tasks iit ON iit.verification_task_id = vt.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY COALESCE(vt.completed_at, vt.updated_at, vt.created_at) ASC`,
    params
  );

  return result.rows;
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

      const hasLegacyManualItems = Array.isArray(body.items) && body.items.length > 0;
      const useTaskDrivenGeneration =
        taskCandidates.length > 0 ||
        (!hasLegacyManualItems && selectedTaskIds.length === 0 && selectedCaseIds.length === 0);

      const { id: invoiceId, invoiceNumber } = await getNextInvoiceIdentity(client);

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
        if (taskCandidates.length === 0) {
          throw new Error(
            'No completed unbilled verification tasks available for invoice generation'
          );
        }

        for (const task of taskCandidates) {
          const resolved = await resolveTaskBillingAmount(task);
          generatedLines.push({
            description: task.task_title || `Verification Task ${task.id}`,
            quantity: 1,
            unitPrice: resolved.amount,
            amount: resolved.amount,
            verificationTypeId: task.verification_type_id,
            rateTypeId: resolved.rateTypeId,
            productId: task.product_id,
            linkedTasks: [
              {
                taskId: task.id,
                caseId: task.case_id,
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

      const subtotalAmount = generatedLines.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = Math.round(subtotalAmount * 0.18 * 100) / 100;
      const totalAmount = subtotalAmount + taxAmount;

      await client.query(
        `INSERT INTO invoices (
           id, invoice_number, client_id, product_id, client_name, amount,
           subtotal_amount, tax_amount, total_amount, currency, status,
           billing_period_from, billing_period_to, issue_date, due_date, notes, created_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, CURRENT_TIMESTAMP, $14, $15, $16
         )`,
        [
          invoiceId,
          invoiceNumber,
          clientId,
          productId,
          body.clientName || clientRow.name,
          subtotalAmount,
          subtotalAmount,
          taxAmount,
          totalAmount,
          currency,
          STATUS.DRAFT,
          body.billingPeriodFrom || null,
          body.billingPeriodTo || null,
          dueDate,
          body.notes || null,
          req.user?.id || null,
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

        for (const linkedTask of line.linkedTasks) {
          await client.query(
            `INSERT INTO invoice_item_tasks (
               invoice_item_id, verification_task_id, case_id, client_id, billed_amount
             ) VALUES ($1, $2, $3, $4, $5)`,
            [invoiceItemId, linkedTask.taskId, linkedTask.caseId, clientId, linkedTask.billedAmount]
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

    return res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice created successfully',
    });
  } catch (error) {
    logger.error('Error creating invoice:', error);
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

        const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
        const totalAmount = subtotal + taxAmount;
        await client.query(
          `UPDATE invoices
           SET amount = $2,
               subtotal_amount = $2,
               tax_amount = $3,
               total_amount = $4,
               due_date = COALESCE($5, due_date),
               notes = COALESCE($6, notes),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [Number(id), subtotal, taxAmount, totalAmount, dueDate || null, notes || null]
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
    return res.json({
      success: true,
      data: invoice,
      message: 'Invoice updated successfully',
    });
  } catch (error) {
    logger.error('Error updating invoice:', error);
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
        link_id: number;
        invoice_item_id: number;
        verification_task_id: string;
        case_id: string;
        verification_type_id: number | null;
        rate_type_id: number | null;
        actual_amount: string | null;
        estimated_amount: string | null;
        area_id: number | null;
        task_title: string | null;
        pincode_id: number | null;
        client_id: number;
        product_id: number;
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
           p.id as pincode_id,
           c.client_id as client_id,
           c.product_id as product_id
         FROM invoice_item_tasks iit
         JOIN verification_tasks vt ON vt.id = iit.verification_task_id
         JOIN cases c ON c.id = vt.case_id
         LEFT JOIN pincodes p ON p.code = COALESCE(vt.pincode, c."pincode")
         JOIN invoice_items ii ON ii.id = iit.invoice_item_id
         WHERE ii.invoice_id = $1`,
        [Number(id)]
      );

      if (linkedTasks.rows.length === 0) {
        throw new Error('Invoice has no linked operational tasks to regenerate');
      }

      for (const linkedTask of linkedTasks.rows) {
        const resolved = await resolveTaskBillingAmount({
          id: linkedTask.verification_task_id,
          case_id: linkedTask.case_id,
          verification_type_id: linkedTask.verification_type_id,
          rate_type_id: linkedTask.rate_type_id,
          actual_amount: linkedTask.actual_amount,
          estimated_amount: linkedTask.estimated_amount,
          area_id: linkedTask.area_id,
          task_title: linkedTask.task_title,
          pincode_id: linkedTask.pincode_id,
          client_id: linkedTask.client_id,
          product_id: linkedTask.product_id,
        });

        await client.query(`UPDATE invoice_item_tasks SET billed_amount = $2 WHERE id = $1`, [
          linkedTask.link_id,
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

      const totals = await client.query<{ subtotal: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text as subtotal FROM invoice_items WHERE invoice_id = $1`,
        [Number(id)]
      );
      const subtotal = toNumber(totals.rows[0]?.subtotal);
      const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
      const totalAmount = subtotal + taxAmount;

      await client.query(
        `UPDATE invoices
         SET amount = $2,
             subtotal_amount = $2,
             tax_amount = $3,
             total_amount = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [Number(id), subtotal, taxAmount, totalAmount]
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
    return res.json({
      success: true,
      data: invoice,
      message: 'Invoice regenerated successfully',
    });
  } catch (error) {
    logger.error('Error regenerating invoice:', error);
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
          clientName: invoice.client.name,
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
          clientName: invoice.client.name,
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
        });
      }

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
    doc.text(`Client: ${invoice.client.name}`, 14, 28);
    doc.text(`Status: ${invoice.status}`, 14, 36);
    doc.text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 14, 44);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 14, 52);
    doc.text(`Total Amount: INR ${invoice.totalAmount.toFixed(2)}`, 14, 60);
    doc.text('Items:', 14, 72);

    let y = 82;
    invoice.items.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.description} | Qty ${item.quantity} | INR ${item.amount.toFixed(2)}`,
        14,
        y
      );
      y += 8;
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
    });

    if (invoice.notes) {
      doc.text(`Notes: ${invoice.notes}`, 14, Math.min(y + 8, 285));
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
    const { status, clientId, dateFrom, dateTo } = req.query;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;

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

    if (scope.assignedClientIds && scope.assignedClientIds.length > 0) {
      conditions.push(`i.client_id = ANY($${idx++}::int[])`);
      params.push(scope.assignedClientIds as unknown as number);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
        i.notes,
        i.created_at
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ${whereClause}
      ORDER BY i.created_at DESC
    `,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoices');

    worksheet.columns = [
      { header: 'Invoice #', key: 'invoice_number', width: 22 },
      { header: 'Client', key: 'client_name', width: 25 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Issue Date', key: 'issue_date', width: 18 },
      { header: 'Due Date', key: 'due_date', width: 18 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Tax Amount', key: 'tax_amount', width: 14 },
      { header: 'Total Amount', key: 'total_amount', width: 16 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    result.rows.forEach((row: Record<string, unknown>) => {
      worksheet.addRow({
        ...row,
        subtotal: row.subtotal ? Number(row.subtotal) : 0,
        tax_amount: row.tax_amount ? Number(row.tax_amount) : 0,
        total_amount: row.total_amount ? Number(row.total_amount) : 0,
        issue_date: row.issue_date ? new Date(row.issue_date as string).toLocaleDateString() : '',
        due_date: row.due_date ? new Date(row.due_date as string).toLocaleDateString() : '',
        created_at: row.created_at ? new Date(row.created_at as string).toLocaleString() : '',
      });
    });

    worksheet.autoFilter = { from: 'A1', to: `J${result.rows.length + 1}` };

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
