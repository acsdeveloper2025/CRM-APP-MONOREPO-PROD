// Pure, stateless invoice utilities (no Invoice/InvoiceItem type coupling).
// Extracted from invoicesController (§7 decomposition). Imported back by the
// controller; behaviour pinned by invoices.integration + invoiceCreate.integration.

export const INVOICE_EXPORT_ROW_LIMIT = 10000;

export const INVOICE_SORT_MAP: Record<string, string> = {
  invoiceNumber: 'i.invoice_number',
  clientName: 'c.name',
  issueDate: 'i.issue_date',
  dueDate: 'i.due_date',
  totalAmount: 'i.total_amount',
  amount: 'i.total_amount',
  status: 'i.status',
};

export const STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  CANCELLED: 'CANCELLED',
  OVERDUE: 'OVERDUE',
} as const;

export const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toMaybeNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseInvoiceClientId = (invoiceClientId: string): number | null => {
  const direct = Number(invoiceClientId);
  if (Number.isFinite(direct)) {
    return direct;
  }
  const suffix = Number(String(invoiceClientId).replace(/^client_/i, ''));
  return Number.isFinite(suffix) ? suffix : null;
};

export const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(entry => String(entry || '').trim()).filter(Boolean);
};

export const getSingleParam = (value: string | string[] | undefined): string | null => {
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
