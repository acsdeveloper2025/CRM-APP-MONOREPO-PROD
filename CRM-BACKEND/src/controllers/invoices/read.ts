import type { Response } from 'express';
import type { PoolClient } from 'pg';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { resolveDataScope } from '@/security/dataScope';
import { STATUS, toNumber, getSingleParam } from './utils';
import type { Invoice, InvoiceItem, InvoiceListRow, InvoiceItemRow } from './types';
import { invoiceAllowedByScope, normalizeInvoiceForResponse, buildScopeSql } from './helpers';

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

export const getInvoiceByIdFromDb = async (
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
