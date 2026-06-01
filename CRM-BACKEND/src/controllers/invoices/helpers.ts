// Invoice helpers that touch the Invoice domain types + data-scope.
// Extracted from invoicesController (§7 decomposition).

import { resolveDataScope, valueAllowedByScope } from '@/security/dataScope';
import { STATUS, parseInvoiceClientId } from './utils';
import type { CreateInvoiceBody, Invoice } from './types';

export const parseCaseIdsFromItems = (items: CreateInvoiceBody['items']): string[] => {
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

export const invoiceAllowedByScope = (
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

export const toDisplayStatus = (
  status: string,
  dueDate: string,
  paidDate: string | null
): string => {
  if (status === STATUS.CANCELLED) {
    return status;
  }
  if (!paidDate && dueDate && new Date(dueDate).getTime() < Date.now() && status !== STATUS.DRAFT) {
    return STATUS.OVERDUE;
  }
  return status;
};

export const normalizeInvoiceForResponse = (
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

export const buildScopeSql = (
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
