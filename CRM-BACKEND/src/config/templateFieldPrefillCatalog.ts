// -----------------------------------------------------------------------------
// Template Field Prefill Catalog
// -----------------------------------------------------------------------------
// Canonical list of system fields that a Case Data Template field may be
// mapped to ("prefill source"). Mapped fields are read-only mirrors — the
// value is computed LIVE from the source on every render and never stored
// in case_data_entries.data JSONB.
//
// This file is the source of truth for:
//   - Which source keys are valid (validator uses PREFILL_SOURCE_KEYS).
//   - What each key's human label is (admin UI dropdown).
//   - Which group the source belongs to (UI grouping: Case / Case via
//     joins / Task / Applicant / Other).
//   - The value-type hint so the template editor can warn when the
//     mapped source and the template field's fieldType mismatch (e.g.
//     mapping a NUMBER field to customer_name which is text).
//
// For multi-valued sources (task-level, applicant-level), the value is
// resolved from the row with the earliest created_at — see the resolver
// in templateFieldPrefillResolver.ts.
// -----------------------------------------------------------------------------

export type PrefillValueKind = 'text' | 'number' | 'date' | 'datetime';

export type PrefillGroup = 'case' | 'caseJoin' | 'task' | 'applicant' | 'other';

export interface PrefillCatalogEntry {
  /** The stored value in case_data_template_fields.prefill_source. */
  key: string;
  /** Human-readable label shown in the admin mapping dropdown. */
  label: string;
  /** Group — drives the optgroup label in the UI. */
  group: PrefillGroup;
  /** Underlying value type — template editor warns on type mismatch. */
  kind: PrefillValueKind;
  /** One-line description shown as hint/tooltip. */
  description?: string;
}

// Ordered by group → then by label so the admin dropdown is predictable.
export const PREFILL_CATALOG: readonly PrefillCatalogEntry[] = [
  // ---------- Group A: case-level (always one value per case) ----------
  { key: 'customer_name', label: 'Customer Name', group: 'case', kind: 'text' },
  { key: 'customer_phone', label: 'Customer Phone', group: 'case', kind: 'text' },
  { key: 'customer_calling_code', label: 'Customer Calling Code', group: 'case', kind: 'text' },
  { key: 'pan_number', label: 'PAN Number', group: 'case', kind: 'text' },
  {
    key: 'case_number',
    label: 'Case Number',
    group: 'case',
    kind: 'number',
    description: 'Auto-increment case_id, e.g. 3',
  },
  { key: 'applicant_type', label: 'Applicant Type', group: 'case', kind: 'text' },
  { key: 'priority', label: 'Priority', group: 'case', kind: 'text' },
  { key: 'pincode', label: 'Pincode', group: 'case', kind: 'text' },
  { key: 'backend_contact_number', label: 'Backend Contact Number', group: 'case', kind: 'text' },
  { key: 'trigger', label: 'Trigger / Remark', group: 'case', kind: 'text' },
  {
    key: 'received_date',
    label: 'Case Received Date',
    group: 'case',
    kind: 'datetime',
    description: 'cases.created_at',
  },
  { key: 'completed_date', label: 'Case Completed Date', group: 'case', kind: 'datetime' },
  { key: 'case_status', label: 'Case Status', group: 'case', kind: 'text' },
  { key: 'verification_outcome', label: 'Verification Outcome', group: 'case', kind: 'text' },
  { key: 'revoke_reason', label: 'Revoke Reason', group: 'case', kind: 'text' },

  // ---------- Group B: case-level via joins ----------
  { key: 'client_name', label: 'Client Name', group: 'caseJoin', kind: 'text' },
  { key: 'client_code', label: 'Client Code', group: 'caseJoin', kind: 'text' },
  { key: 'product_name', label: 'Product Name', group: 'caseJoin', kind: 'text' },
  { key: 'product_code', label: 'Product Code', group: 'caseJoin', kind: 'text' },
  { key: 'rate_type_name', label: 'Rate Type', group: 'task', kind: 'text' },
  { key: 'verification_type_name', label: 'Verification Type', group: 'caseJoin', kind: 'text' },
  { key: 'city_name', label: 'City', group: 'caseJoin', kind: 'text' },
  { key: 'state_name', label: 'State', group: 'caseJoin', kind: 'text' },
  { key: 'country_name', label: 'Country', group: 'caseJoin', kind: 'text' },

  // ---------- Group C: task-level (earliest by created_at) ----------
  { key: 'task_number', label: 'Task Number (TID)', group: 'task', kind: 'text' },
  { key: 'task_title', label: 'Task Title', group: 'task', kind: 'text' },
  { key: 'task_type', label: 'Task Type', group: 'task', kind: 'text' },
  { key: 'task_description', label: 'Task Description', group: 'task', kind: 'text' },
  { key: 'verification_address', label: 'Verification Address', group: 'task', kind: 'text' },
  { key: 'task_pincode', label: 'Task Pincode', group: 'task', kind: 'text' },
  { key: 'estimated_amount', label: 'Estimated Amount', group: 'task', kind: 'number' },
  { key: 'actual_amount', label: 'Actual Amount', group: 'task', kind: 'number' },
  {
    key: 'estimated_completion_date',
    label: 'Estimated Completion Date',
    group: 'task',
    kind: 'date',
  },
  { key: 'task_priority', label: 'Task Priority', group: 'task', kind: 'text' },
  { key: 'task_applicant_type', label: 'Task Applicant Type', group: 'task', kind: 'text' },
  { key: 'task_status', label: 'Task Status', group: 'task', kind: 'text' },
  { key: 'task_assigned_at', label: 'Task Assigned At', group: 'task', kind: 'datetime' },
  { key: 'task_started_at', label: 'Task Started At', group: 'task', kind: 'datetime' },
  { key: 'task_completed_at', label: 'Task Completed At', group: 'task', kind: 'datetime' },
  { key: 'task_submitted_at', label: 'Task Submitted At', group: 'task', kind: 'datetime' },
  { key: 'task_outcome', label: 'Task Outcome', group: 'task', kind: 'text' },
  { key: 'verifier_name', label: 'Verifier / Field Agent Name', group: 'task', kind: 'text' },
  { key: 'verifier_email', label: 'Verifier Email', group: 'task', kind: 'text' },
  { key: 'verifier_phone', label: 'Verifier Phone', group: 'task', kind: 'text' },
  { key: 'verifier_employee_id', label: 'Verifier Employee ID', group: 'task', kind: 'text' },
  { key: 'verifier_designation', label: 'Verifier Designation', group: 'task', kind: 'text' },
  { key: 'assigned_by_name', label: 'Assigned By (Name)', group: 'task', kind: 'text' },

  // ---------- Group D: applicant-level (earliest by created_at) ----------
  { key: 'applicant_name', label: 'Applicant Name', group: 'applicant', kind: 'text' },
  { key: 'applicant_mobile', label: 'Applicant Mobile', group: 'applicant', kind: 'text' },
  { key: 'applicant_pan', label: 'Applicant PAN', group: 'applicant', kind: 'text' },
  { key: 'applicant_role', label: 'Applicant Role', group: 'applicant', kind: 'text' },

  // ---------- Group E: other ----------
  { key: 'case_created_by_name', label: 'Case Created By (Name)', group: 'other', kind: 'text' },
];

export const PREFILL_SOURCE_KEYS: ReadonlySet<string> = new Set(PREFILL_CATALOG.map(e => e.key));

export const getPrefillEntry = (key: string | null | undefined): PrefillCatalogEntry | null => {
  if (!key) {
    return null;
  }
  return PREFILL_CATALOG.find(e => e.key === key) ?? null;
};

/**
 * Labels only, for grouping by group in UI. Not used server-side except
 * via the validator above, but exported so the admin-facing list UI on
 * the frontend can share the same ordering.
 */
export const PREFILL_GROUP_ORDER: readonly PrefillGroup[] = [
  'case',
  'caseJoin',
  'task',
  'applicant',
  'other',
];

export const PREFILL_GROUP_LABELS: Record<PrefillGroup, string> = {
  case: 'Case',
  caseJoin: 'Case (related)',
  task: 'Verification Task (earliest)',
  applicant: 'Applicant (earliest)',
  other: 'Other',
};
