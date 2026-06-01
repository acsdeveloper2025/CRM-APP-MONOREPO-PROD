// Invoice access-control + status-history helpers shared by the read and
// write handlers. Extracted from invoicesController (§7 decomposition).

import type { Response } from 'express';
import type { PoolClient } from 'pg';
import { query } from '@/config/database';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { resolveDataScope } from '@/security/dataScope';
import { invoiceAllowedByScope } from './helpers';

export const getInvoiceScopeRecord = async (
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

export const ensureInvoiceAccessible = async (
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

export const recordInvoiceStatusHistory = async (
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
