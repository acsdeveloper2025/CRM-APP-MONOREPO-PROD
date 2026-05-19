#!/usr/bin/env ts-node
//
// T1-1 (audit 2026-05-17): verifyAuditChain
//
// Re-walks every audit_logs row in (id ASC) order where row_hash IS NOT
// NULL and recomputes the HMAC chain using AUDIT_LOG_HMAC_SECRET. The
// first row whose recomputed hash differs from the stored row_hash, or
// whose prev_hash does not match the previous row's row_hash, is the
// tamper / corruption point.
//
// Usage:
//   npm run audit:verify-chain
//
// Exit code 0 on full match, non-zero on any mismatch.

import { createPool } from './lib/dbAdmin';
import { computeRowHash } from '../src/utils/auditChain';
import type { AuditLogData } from '../src/utils/auditLogger';

interface ChainRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  prev_hash: Buffer | null;
  row_hash: Buffer;
}

const main = async (): Promise<void> => {
  const secret = process.env.AUDIT_LOG_HMAC_SECRET;
  if (!secret) {
    console.error('AUDIT_LOG_HMAC_SECRET must be set');
    process.exit(2);
  }

  const pool = createPool();
  let scanned = 0;
  let prevRowHash: Buffer | null = null;

  try {
    // Stream in pages (LIMIT/OFFSET on a partitioned table is acceptable
    // for a one-shot integrity sweep; if this becomes a hot path we
    // would switch to keyset pagination on id).
    const PAGE = 1000;
    let offset = 0;

    for (;;) {
      const { rows } = await pool.query<ChainRow>(
        `SELECT id, action, entity_type, entity_id, user_id, details,
                ip_address::text AS ip_address, user_agent, created_at,
                prev_hash, row_hash
           FROM audit_logs
          WHERE row_hash IS NOT NULL
          ORDER BY id ASC
          LIMIT $1 OFFSET $2`,
        [PAGE, offset]
      );
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        // Chain-link check
        const expectedPrev = prevRowHash;
        const actualPrev = row.prev_hash;
        if (
          (expectedPrev === null) !== (actualPrev === null) ||
          (expectedPrev && actualPrev && !expectedPrev.equals(actualPrev))
        ) {
          console.error(
            `CHAIN BREAK at id=${row.id}: prev_hash does not match previous row's row_hash`
          );
          process.exit(1);
        }

        // Row-hash recomputation check
        const data: AuditLogData = {
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id ?? undefined,
          userId: row.user_id ?? undefined,
          details: row.details ?? undefined,
          ipAddress: row.ip_address ?? undefined,
          userAgent: row.user_agent ?? undefined,
        };
        const expected = computeRowHash(actualPrev, data, row.created_at, secret);
        if (!expected.equals(row.row_hash)) {
          console.error(`HASH MISMATCH at id=${row.id}: row content tampered or secret rotated`);
          process.exit(1);
        }

        prevRowHash = row.row_hash;
        scanned++;
      }

      offset += PAGE;
    }
  } finally {
    await pool.end();
  }

  console.log(`OK: ${scanned} signed audit-log rows verified.`);
};

main().catch(err => {
  console.error('Verify failed:', err);
  process.exit(2);
});
