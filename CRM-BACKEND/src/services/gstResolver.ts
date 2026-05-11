/**
 * GST Resolver — single authoritative source for invoice tax breakdown.
 * ---------------------------------------------------------------------
 * Centralizes the CGST/SGST/IGST split + place_of_supply derivation used
 * by every invoice-generation path (create / update / regenerate / export).
 *
 * Design (ops decision 2026-05-11):
 *   - A1: Supplier state-of-supply read from env `SUPPLIER_GST_STATE_CODE`
 *   - B1: Flat configurable rate via `GST_RATE_DEFAULT` (default 18%)
 *   - C2: Recipient state resolution priority:
 *         clients.gstin_state_code  →  states.gst_state_code via
 *         clients.billing_state_id  →  FAIL LOUD
 *
 * Hard rules:
 *   - Never silently downgrade to legacy `tax_amount`-only mode.
 *   - Never assume a default state; missing config or recipient data
 *     throws `GstConfigError` with operator-readable detail.
 *   - Arithmetic invariant enforced before returning:
 *       subtotal + CGST + SGST + IGST === totalAmount
 *       For INTRA_STATE: IGST = 0, CGST = SGST = round(subtotal * (rate/2))
 *       For INTER_STATE: CGST = SGST = 0, IGST = round(subtotal * rate)
 *
 * Backward compatibility:
 *   - Existing invoices with `supply_type IS NULL` remain readable
 *     (CHECK `chk_invoices_gst_consistency` permits NULL supply_type).
 *   - This resolver is only invoked on NEW writes — historical rows
 *     are not mutated.
 */

import type { PoolClient } from 'pg';
import { config } from '@/config';

export type SupplyType = 'INTRA_STATE' | 'INTER_STATE' | 'EXPORT';

export interface GstBreakdown {
  /** Always set. INTRA_STATE / INTER_STATE / EXPORT. */
  supplyType: SupplyType;
  /** 2-digit GST state code of recipient. NULL only for EXPORT (not auto-detected today). */
  placeOfSupply: string;
  /**
   * Rate as numeric percent (e.g. 9 for 9%). NULL when this leg doesn't apply.
   *
   * MUST be NULL (not 0) for the inapplicable legs because the DB CHECK
   * `chk_invoices_gst_consistency` is strict:
   *   INTRA_STATE → cgst_amount + sgst_amount NOT NULL, igst_amount NULL
   *   INTER_STATE → igst_amount NOT NULL, cgst_amount + sgst_amount NULL
   *   EXPORT      → all three NULL
   * Returning 0 instead of NULL writes 0 to the column, violates the CHECK.
   */
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  /** Money amounts in INR with 2 decimal places (matches numeric(12,2) on invoices). */
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  /** subtotal × totalRate, rounded to 2dp. Always equals (cgst+sgst) | igst. */
  taxAmount: number;
  /** subtotal + taxAmount. */
  totalAmount: number;
}

export class GstConfigError extends Error {
  readonly code: string;
  readonly operatorMessage: string;
  constructor(code: string, operatorMessage: string) {
    super(operatorMessage);
    this.name = 'GstConfigError';
    this.code = code;
    this.operatorMessage = operatorMessage;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const GST_STATE_CODE_RE = /^[0-9]{2}$/;

/**
 * Resolve the recipient's GST state code, in priority order:
 *   1. clients.gstin_state_code (matches GSTIN prefix, validated at INSERT)
 *   2. states.gst_state_code via clients.billing_state_id
 *
 * Throws GstConfigError if neither yields a 2-digit code.
 */
const resolveRecipientStateCode = async (client: PoolClient, clientId: number): Promise<string> => {
  const result = await client.query<{
    gstinStateCode: string | null;
    billingStateGstCode: string | null;
    clientName: string | null;
  }>(
    `SELECT
       c.gstin_state_code,
       s.gst_state_code AS billing_state_gst_code,
       c.name AS client_name
     FROM clients c
     LEFT JOIN states s ON s.id = c.billing_state_id
     WHERE c.id = $1
     LIMIT 1`,
    [clientId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new GstConfigError(
      'CLIENT_NOT_FOUND',
      `Cannot resolve GST place_of_supply: client ${clientId} not found.`
    );
  }

  const gstinCode = (row.gstinStateCode ?? '').trim();
  if (GST_STATE_CODE_RE.test(gstinCode)) {
    return gstinCode;
  }

  const billingCode = (row.billingStateGstCode ?? '').trim();
  if (GST_STATE_CODE_RE.test(billingCode)) {
    return billingCode;
  }

  throw new GstConfigError(
    'RECIPIENT_GST_STATE_MISSING',
    `Cannot resolve GST place_of_supply for client "${row.clientName ?? clientId}" (id=${clientId}): ` +
      `neither clients.gstin_state_code nor states.gst_state_code via clients.billing_state_id is set. ` +
      `Configure GSTIN or billing state before generating the invoice.`
  );
};

/**
 * Resolve the supplier's GST state code from env. Throws if unset/invalid.
 */
const resolveSupplierStateCode = (): string => {
  const raw = (config.gst.supplierStateCode ?? '').trim();
  if (!GST_STATE_CODE_RE.test(raw)) {
    throw new GstConfigError(
      'SUPPLIER_GST_STATE_NOT_CONFIGURED',
      `Cannot resolve GST supply_type: SUPPLIER_GST_STATE_CODE env var is not set ` +
        `to a valid 2-digit GST state code. Configure it on the backend before ` +
        `generating invoices.`
    );
  }
  return raw;
};

/**
 * Compute the full GST breakdown for an invoice.
 *
 * Throws `GstConfigError` (caller must catch + return operator-readable 422)
 * if either side of the supply pair cannot be resolved.
 */
export const resolveInvoiceGst = async (
  client: PoolClient,
  params: { clientId: number; subtotalAmount: number }
): Promise<GstBreakdown> => {
  const supplierCode = resolveSupplierStateCode();
  const recipientCode = await resolveRecipientStateCode(client, params.clientId);
  const totalRate = config.gst.rateDefault;

  if (!Number.isFinite(params.subtotalAmount) || params.subtotalAmount < 0) {
    throw new GstConfigError(
      'INVALID_SUBTOTAL',
      `Cannot compute GST breakdown: subtotal_amount must be a non-negative number ` +
        `(got: ${String(params.subtotalAmount)}).`
    );
  }

  const isIntraState = supplierCode === recipientCode;
  let breakdown: GstBreakdown;

  if (isIntraState) {
    const halfRate = totalRate / 2;
    const cgstAmount = round2((params.subtotalAmount * halfRate) / 100);
    const sgstAmount = round2((params.subtotalAmount * halfRate) / 100);
    const taxAmount = round2(cgstAmount + sgstAmount);
    breakdown = {
      supplyType: 'INTRA_STATE',
      placeOfSupply: recipientCode,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: null,
      cgstAmount,
      sgstAmount,
      igstAmount: null,
      taxAmount,
      totalAmount: round2(params.subtotalAmount + taxAmount),
    };
  } else {
    const igstAmount = round2((params.subtotalAmount * totalRate) / 100);
    breakdown = {
      supplyType: 'INTER_STATE',
      placeOfSupply: recipientCode,
      cgstRate: null,
      sgstRate: null,
      igstRate: totalRate,
      cgstAmount: null,
      sgstAmount: null,
      igstAmount,
      taxAmount: igstAmount,
      totalAmount: round2(params.subtotalAmount + igstAmount),
    };
  }

  // Defense-in-depth: arithmetic invariant.
  // Sum applicable legs only; NULLs (inapplicable legs) coerce to 0 for math.
  const componentSum = round2(
    (breakdown.cgstAmount ?? 0) + (breakdown.sgstAmount ?? 0) + (breakdown.igstAmount ?? 0)
  );
  if (componentSum !== breakdown.taxAmount) {
    throw new GstConfigError(
      'GST_ARITHMETIC_DRIFT',
      `Internal GST arithmetic drift: components sum to ${componentSum} but taxAmount=${breakdown.taxAmount}. ` +
        `Refusing to write inconsistent split.`
    );
  }
  const totalCheck = round2(params.subtotalAmount + breakdown.taxAmount);
  if (totalCheck !== breakdown.totalAmount) {
    throw new GstConfigError(
      'GST_TOTAL_DRIFT',
      `Internal GST arithmetic drift: subtotal+tax=${totalCheck} but totalAmount=${breakdown.totalAmount}.`
    );
  }

  return breakdown;
};
