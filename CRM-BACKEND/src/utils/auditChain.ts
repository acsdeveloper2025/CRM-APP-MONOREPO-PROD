// T1-1 (audit 2026-05-17): tamper-evident hash chain for audit_logs.
//
// Every audit_logs row stores `row_hash = HMAC-SHA256(secret, prev_hash ||
// canonical(row))`. A tampered row breaks the chain — re-running
// `scripts/verifyAuditChain.ts` will surface the first mismatched id.
//
// Notes:
// - prev_hash for the very first signed row is NULL (chain genesis).
// - Pre-T1-1 rows (deployed before this change) have row_hash IS NULL;
//   they sit outside the chain and the verifier skips them. Honest:
//   tamper-evidence covers events from deploy time forward.
// - Hash input pins `created_at` to the application clock at INSERT
//   time so the value is identical at sign and at verify (the column
//   default now() would otherwise be set by the DB, after we have
//   already computed the hash).
// - HMAC key lives in app env (AUDIT_LOG_HMAC_SECRET). It is never
//   passed as a SQL parameter to keep it out of pg_stat_statements.

import { createHmac } from 'crypto';
import type { AuditLogData } from './auditLogger';

// ASCII Unit Separator (0x1F) — guaranteed not to appear inside any of
// our action / entityType / UUID / IP / user-agent / ISO timestamp /
// canonicalized-JSON values, so it is a safe joiner that prevents
// `("FOO","BAR")` from hashing the same as `("FOOBAR","")`.
const SEP = '\x1f';

/**
 * Deterministic serialization of an audit-log row's content. The chain
 * is only as good as this canonicalization — any property added later
 * MUST be appended to the end of the string so older rows continue to
 * verify with the same algorithm.
 */
const canonicalize = (data: AuditLogData, createdAt: Date): string => {
  return [
    data.action,
    data.entityType,
    data.entityId ?? '',
    data.userId ?? '',
    data.details ? JSON.stringify(data.details) : '',
    data.ipAddress ?? '',
    data.userAgent ?? '',
    createdAt.toISOString(),
  ].join(SEP);
};

export const computeRowHash = (
  prevHash: Buffer | null,
  data: AuditLogData,
  createdAt: Date,
  secret: string
): Buffer => {
  const hmac = createHmac('sha256', secret);
  if (prevHash) {
    hmac.update(prevHash);
  }
  hmac.update(canonicalize(data, createdAt));
  return hmac.digest();
};
