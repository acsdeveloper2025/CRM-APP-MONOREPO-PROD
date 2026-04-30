// -----------------------------------------------------------------------------
// templateFieldPrefillResolver
// -----------------------------------------------------------------------------
// Resolve every catalog prefill source for a case in ONE SQL round-trip.
// Used by the data-entry bundle endpoint to return `prefillValue` for
// template fields that have a non-null `prefill_source`.
//
// Multi-valued sources (task-level, applicant-level) are resolved from
// the earliest-by-created_at row via LATERAL joins.
// -----------------------------------------------------------------------------

import type { PoolClient } from 'pg';
import { query } from '@/config/database';
import { PREFILL_CATALOG, getPrefillEntry } from '@/config/templateFieldPrefillCatalog';

// Map of `prefill_source` key → resolved current value for one case. Any
// key whose resolved value is NULL returns null; any unknown key returns
// undefined (but catalog validation upstream should prevent that).
export type PrefillContext = Record<string, unknown>;

// One big LEFT-JOIN query. LATERAL for earliest task and earliest
// applicant so we can feed their ids into the users join without
// correlation issues. Column aliases match the catalog `key` values
// exactly so the result row maps 1:1 to PrefillContext (via the
// backend's auto-camelizeRow transform for snake→camel, which means
// the JS side will see `customerName`, `taskNumber`, etc., so we
// access by the camelCase alias).
// Only fields that are visible in the frontend UI. Cross-checked against
// CaseDetailPage, NewCasePage, TaskDetailPage on 2026-04-16. 16 invisible
// fields removed (city/state/country, verifier email/phone/designation,
// applicant pan/role, revoke_reason, client/product code, etc.).
const PREFILL_QUERY = `
  SELECT
    -- Case-level
    c.customer_name,
    c.customer_phone,
    c.customer_calling_code,
    c.pan_number,
    c.case_id                       AS case_number,
    c.applicant_type,
    c.priority,
    -- F5.1.x: cases.pincode dropped; derive from first task
    (SELECT p2.code FROM verification_tasks vt2 JOIN pincodes p2 ON p2.id = vt2.pincode_id WHERE vt2.case_id = c.id AND vt2.pincode_id IS NOT NULL LIMIT 1) AS pincode,
    c.backend_contact_number,
    c.trigger,
    c.created_at                    AS received_date,
    c.completed_at                  AS completed_date,
    c.status                        AS case_status,
    -- Case via joins
    cl.name                         AS client_name,
    p.name                          AS product_name,
    vt.name                         AS verification_type_name,
    -- Task-level (earliest)
    t.task_number,
    t.task_title,
    t.task_type::text               AS task_type,
    t.task_description,
    t.address                       AS verification_address,
    t.pincode                       AS task_pincode,
    t.estimated_amount,
    t.actual_amount,
    t.priority                      AS task_priority,
    t.applicant_type                AS task_applicant_type,
    t.status                        AS task_status,
    rt.name                         AS rate_type_name,
    t.assigned_at                   AS task_assigned_at,
    t.started_at                    AS task_started_at,
    t.completed_at                  AS task_completed_at,
    tu.name                         AS verifier_name,
    ab.name                         AS assigned_by_name,
    -- Applicant-level (earliest)
    ap.name                         AS applicant_name,
    ap.mobile                       AS applicant_mobile,
    -- Other
    cu.name                         AS case_created_by_name
  FROM cases c
  LEFT JOIN clients            cl ON cl.id = c.client_id
  LEFT JOIN products           p  ON p.id  = c.product_id
  LEFT JOIN verification_types vt ON vt.id = c.verification_type_id
  LEFT JOIN users              cu ON cu.id = c.created_by_backend_user
  LEFT JOIN LATERAL (
    SELECT * FROM verification_tasks WHERE case_id = c.id
     ORDER BY created_at ASC LIMIT 1
  ) t ON true
  LEFT JOIN rate_types         rt ON rt.id = t.rate_type_id
  LEFT JOIN users              tu ON tu.id = t.assigned_to
  LEFT JOIN users              ab ON ab.id = t.assigned_by
  LEFT JOIN LATERAL (
    SELECT * FROM applicants WHERE case_id = c.id
     ORDER BY created_at ASC LIMIT 1
  ) ap ON true
  WHERE c.id = $1
  LIMIT 1
`;

/**
 * Batch variant of the prefill query. The WHERE clause swaps `= $1` for
 * `= ANY($1::uuid[])` so one round-trip returns prefill data for up to
 * thousands of cases. `c.id AS case_id_pk` lets the caller fan rows out
 * into a per-case map. Essential for MIS export at scale — the sequential
 * for-of loop was the single biggest bottleneck (1 query per case).
 */
const PREFILL_QUERY_BATCH = PREFILL_QUERY.replace(
  'WHERE c.id = $1\n  LIMIT 1',
  'WHERE c.id = ANY($1::uuid[])'
).replace(
  'SELECT\n    -- Case-level',
  'SELECT\n    c.id                            AS case_id_pk,\n    -- Case-level'
);

/**
 * Fetch the prefill context for a case. Uses the supplied PoolClient
 * when called from inside a transaction; falls back to the default
 * pool otherwise.
 */
const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const rowToContext = (row: Record<string, unknown>): PrefillContext => {
  // The backend auto-camelizes result rows, so the row uses camelCase
  // keys (e.g. customerName). Map them back to the catalog keys
  // (snake_case) so callers can look up values by the same string
  // stored in case_data_template_fields.prefill_source.
  const ctx: PrefillContext = {};
  for (const { key } of PREFILL_CATALOG) {
    const camelKey = snakeToCamel(key);
    ctx[key] = camelKey in row ? row[camelKey] : (row[key] ?? null);
  }
  return ctx;
};

export const loadPrefillContext = async (
  caseId: string,
  client?: PoolClient
): Promise<PrefillContext> => {
  const res = client
    ? await client.query(PREFILL_QUERY, [caseId])
    : await query(PREFILL_QUERY, [caseId]);
  const row = (res.rows[0] ?? {}) as Record<string, unknown>;
  return rowToContext(row);
};

/**
 * Batch version of loadPrefillContext. Returns a Map keyed by case UUID.
 * A single SQL round-trip handles up to thousands of cases — replaces
 * the sequential for-of loop in the MIS controller. Any case id not
 * found in the DB is absent from the returned map; callers should fall
 * back to an empty PrefillContext in that case.
 *
 * Empty input returns an empty map without hitting the DB.
 */
export const loadPrefillContextBatch = async (
  caseIds: string[],
  client?: PoolClient
): Promise<Map<string, PrefillContext>> => {
  const out = new Map<string, PrefillContext>();
  if (caseIds.length === 0) {
    return out;
  }
  // De-duplicate the input — the MIS rows can have multiple instances per
  // case and we only need one prefill resolution per case.
  const uniqueIds = Array.from(new Set(caseIds));
  const res = client
    ? await client.query(PREFILL_QUERY_BATCH, [uniqueIds])
    : await query(PREFILL_QUERY_BATCH, [uniqueIds]);
  for (const raw of res.rows) {
    const row = raw as Record<string, unknown>;
    // case_id_pk gets camelized to caseIdPk by the pool boundary.
    const caseId = (row.caseIdPk ?? row.case_id_pk) as string | undefined;
    if (typeof caseId === 'string') {
      out.set(caseId, rowToContext(row));
    }
  }
  return out;
};

/**
 * Given a prefill context and a catalog key, return the live value or
 * null. Returns null for unknown keys (defensive — validator should
 * have rejected them at template save time).
 */
export const getPrefillValue = (
  ctx: PrefillContext,
  sourceKey: string | null | undefined
): unknown => {
  if (!sourceKey) {
    return null;
  }
  if (!getPrefillEntry(sourceKey)) {
    return null;
  }
  const v = ctx[sourceKey];
  return v === undefined ? null : v;
};
