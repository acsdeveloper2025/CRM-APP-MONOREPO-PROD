// -----------------------------------------------------------------------------
// Template Field Prefill Catalog — FRONTEND MIRROR
// -----------------------------------------------------------------------------
// Mirrors CRM-BACKEND/src/config/templateFieldPrefillCatalog.ts. Kept in
// sync by convention — if you add, remove, or relabel an entry on the
// backend, update this file at the same time. The backend catalog is
// the authoritative source (it gates validation + resolver); the
// frontend copy only drives the admin mapping dropdown.
// -----------------------------------------------------------------------------

export type PrefillValueKind = 'text' | 'number' | 'date' | 'datetime';

export type PrefillGroup = 'case' | 'caseJoin' | 'task' | 'applicant' | 'other';

export interface PrefillCatalogEntry {
  key: string;
  label: string;
  group: PrefillGroup;
  kind: PrefillValueKind;
  description?: string;
}

export const PREFILL_CATALOG: readonly PrefillCatalogEntry[] = [
  // Case
  { key: 'customer_name',           label: 'Customer Name',           group: 'case', kind: 'text' },
  { key: 'customer_phone',          label: 'Customer Phone',          group: 'case', kind: 'text' },
  { key: 'customer_calling_code',   label: 'Customer Calling Code',   group: 'case', kind: 'text' },
  { key: 'pan_number',              label: 'PAN Number',              group: 'case', kind: 'text' },
  { key: 'case_number',             label: 'Case Number',             group: 'case', kind: 'number' },
  { key: 'applicant_type',          label: 'Applicant Type',          group: 'case', kind: 'text' },
  { key: 'priority',                label: 'Priority',                group: 'case', kind: 'text' },
  { key: 'pincode',                 label: 'Pincode',                 group: 'case', kind: 'text' },
  { key: 'backend_contact_number',  label: 'Backend Contact Number',  group: 'case', kind: 'text' },
  { key: 'trigger',                 label: 'Trigger / Remark',        group: 'case', kind: 'text' },
  { key: 'received_date',           label: 'Case Received Date',      group: 'case', kind: 'datetime' },
  { key: 'completed_date',          label: 'Case Completed Date',     group: 'case', kind: 'datetime' },
  { key: 'case_status',             label: 'Case Status',             group: 'case', kind: 'text' },
  { key: 'verification_outcome',    label: 'Verification Outcome',    group: 'case', kind: 'text' },
  { key: 'revoke_reason',           label: 'Revoke Reason',           group: 'case', kind: 'text' },
  // Case (related)
  { key: 'client_name',             label: 'Client Name',             group: 'caseJoin', kind: 'text' },
  { key: 'client_code',             label: 'Client Code',             group: 'caseJoin', kind: 'text' },
  { key: 'product_name',            label: 'Product Name',            group: 'caseJoin', kind: 'text' },
  { key: 'product_code',            label: 'Product Code',            group: 'caseJoin', kind: 'text' },
  { key: 'rate_type_name',          label: 'Rate Type',               group: 'task', kind: 'text' },
  { key: 'verification_type_name',  label: 'Verification Type',       group: 'caseJoin', kind: 'text' },
  { key: 'city_name',               label: 'City',                    group: 'caseJoin', kind: 'text' },
  { key: 'state_name',              label: 'State',                   group: 'caseJoin', kind: 'text' },
  { key: 'country_name',            label: 'Country',                 group: 'caseJoin', kind: 'text' },
  // Task (earliest)
  { key: 'task_number',             label: 'Task Number (TID)',       group: 'task', kind: 'text' },
  { key: 'task_title',              label: 'Task Title',              group: 'task', kind: 'text' },
  { key: 'task_type',               label: 'Task Type',               group: 'task', kind: 'text' },
  { key: 'task_description',        label: 'Task Description',        group: 'task', kind: 'text' },
  { key: 'verification_address',    label: 'Verification Address',    group: 'task', kind: 'text' },
  { key: 'task_pincode',            label: 'Task Pincode',            group: 'task', kind: 'text' },
  { key: 'estimated_amount',        label: 'Estimated Amount',        group: 'task', kind: 'number' },
  { key: 'actual_amount',           label: 'Actual Amount',           group: 'task', kind: 'number' },
  { key: 'estimated_completion_date', label: 'Estimated Completion Date', group: 'task', kind: 'date' },
  { key: 'task_priority',           label: 'Task Priority',           group: 'task', kind: 'text' },
  { key: 'task_applicant_type',     label: 'Task Applicant Type',     group: 'task', kind: 'text' },
  { key: 'task_status',             label: 'Task Status',             group: 'task', kind: 'text' },
  { key: 'task_assigned_at',        label: 'Task Assigned At',        group: 'task', kind: 'datetime' },
  { key: 'task_started_at',         label: 'Task Started At',         group: 'task', kind: 'datetime' },
  { key: 'task_completed_at',       label: 'Task Completed At',       group: 'task', kind: 'datetime' },
  { key: 'task_submitted_at',       label: 'Task Submitted At',       group: 'task', kind: 'datetime' },
  { key: 'task_outcome',            label: 'Task Outcome',            group: 'task', kind: 'text' },
  { key: 'verifier_name',           label: 'Verifier / Field Agent Name', group: 'task', kind: 'text' },
  { key: 'verifier_email',          label: 'Verifier Email',          group: 'task', kind: 'text' },
  { key: 'verifier_phone',          label: 'Verifier Phone',          group: 'task', kind: 'text' },
  { key: 'verifier_employee_id',    label: 'Verifier Employee ID',    group: 'task', kind: 'text' },
  { key: 'verifier_designation',    label: 'Verifier Designation',    group: 'task', kind: 'text' },
  { key: 'assigned_by_name',        label: 'Assigned By (Name)',      group: 'task', kind: 'text' },
  // Applicant (earliest)
  { key: 'applicant_name',          label: 'Applicant Name',          group: 'applicant', kind: 'text' },
  { key: 'applicant_mobile',        label: 'Applicant Mobile',        group: 'applicant', kind: 'text' },
  { key: 'applicant_pan',           label: 'Applicant PAN',           group: 'applicant', kind: 'text' },
  { key: 'applicant_role',          label: 'Applicant Role',          group: 'applicant', kind: 'text' },
  // Other
  { key: 'case_created_by_name',    label: 'Case Created By (Name)',  group: 'other', kind: 'text' },
];

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

export const getPrefillEntry = (key: string | null | undefined): PrefillCatalogEntry | null => {
  if (!key) { return null; }
  return PREFILL_CATALOG.find(e => e.key === key) ?? null;
};

/**
 * No auto-suggest. Every field defaults to "None (dynamic field)" on
 * upload. The admin explicitly picks which fields to map to system
 * sources via the dropdown in the preview step.
 *
 * Previously this function tried to match Excel headers to catalog
 * entries via aliases ("CASE NAME" → customer_name, "STATUS" →
 * case_status, etc.), but the heuristic was too aggressive and caused
 * fields like STATUS to be silently mapped when the user intended them
 * as editable dynamic fields. Removing the guesswork entirely avoids
 * that class of bug.
 */
export const suggestPrefillSourceForHeader = (_header: string): null => {
  return null;
};
