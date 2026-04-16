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
const PREFILL_QUERY = `
  SELECT
    c.customer_name,
    c.customer_phone,
    c.customer_calling_code,
    c.pan_number,
    c.case_id                       AS case_number,
    c.applicant_type,
    c.priority,
    c.pincode,
    c.backend_contact_number,
    c.trigger,
    c.created_at                    AS received_date,
    c.completed_at                  AS completed_date,
    c.status                        AS case_status,
    c.verification_outcome,
    c.revoke_reason,

    cl.name                         AS client_name,
    cl.code                         AS client_code,
    p.name                          AS product_name,
    p.code                          AS product_code,
    rt.name                         AS rate_type_name,
    vt.name                         AS verification_type_name,
    ci.name                         AS city_name,
    st.name                         AS state_name,
    co.name                         AS country_name,

    t.task_number,
    t.task_title,
    t.task_type::text               AS task_type,
    t.task_description,
    t.address                       AS verification_address,
    t.pincode                       AS task_pincode,
    t.estimated_amount,
    t.actual_amount,
    t.estimated_completion_date,
    t.priority                      AS task_priority,
    t.applicant_type                AS task_applicant_type,
    t.status                        AS task_status,
    t.assigned_at                   AS task_assigned_at,
    t.started_at                    AS task_started_at,
    t.completed_at                  AS task_completed_at,
    t.submitted_at                  AS task_submitted_at,
    t.verification_outcome          AS task_outcome,
    tu.name                         AS verifier_name,
    tu.email                        AS verifier_email,
    tu.phone                        AS verifier_phone,
    tu.employee_id                  AS verifier_employee_id,
    tu.designation                  AS verifier_designation,
    ab.name                         AS assigned_by_name,

    ap.name                         AS applicant_name,
    ap.mobile                       AS applicant_mobile,
    ap.pan_number                   AS applicant_pan,
    ap.role                         AS applicant_role,

    cu.name                         AS case_created_by_name
  FROM cases c
  LEFT JOIN clients            cl ON cl.id = c.client_id
  LEFT JOIN products           p  ON p.id  = c.product_id
  LEFT JOIN rate_types         rt ON rt.id = t.rate_type_id
  LEFT JOIN verification_types vt ON vt.id = c.verification_type_id
  LEFT JOIN cities             ci ON ci.id = c.city_id
  LEFT JOIN states             st ON st.id = ci.state_id
  LEFT JOIN countries          co ON co.id = ci.country_id
  LEFT JOIN users              cu ON cu.id = c.created_by_backend_user
  LEFT JOIN LATERAL (
    SELECT * FROM verification_tasks WHERE case_id = c.id
     ORDER BY created_at ASC LIMIT 1
  ) t ON true
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
 * Fetch the prefill context for a case. Uses the supplied PoolClient
 * when called from inside a transaction; falls back to the default
 * pool otherwise.
 */
const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const loadPrefillContext = async (
  caseId: string,
  client?: PoolClient
): Promise<PrefillContext> => {
  const res = client
    ? await client.query(PREFILL_QUERY, [caseId])
    : await query(PREFILL_QUERY, [caseId]);
  const row = (res.rows[0] ?? {}) as Record<string, unknown>;

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
