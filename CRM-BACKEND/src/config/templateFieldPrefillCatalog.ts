// -----------------------------------------------------------------------------
// Template Field Prefill Catalog
// -----------------------------------------------------------------------------
// Canonical list of system fields that a Case Data Template field may be
// mapped to ("prefill source"). Mapped fields are read-only mirrors — the
// value is computed LIVE from the source on every render and never stored
// in case_data_entries.data JSONB.
//
// EVERY entry in this list has been cross-checked against the frontend UI:
// it is visible on at least one page (Case Detail, New Case, Task Detail).
// Fields that exist in the DB but are NOT shown anywhere in the frontend
// are deliberately excluded — mapping to an invisible field would confuse
// the admin and serve no purpose on the data entry form.
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
  // ---------- Case-level ----------
  { key: 'customer_name', label: 'Customer Name', group: 'case', kind: 'text' },
  { key: 'customer_phone', label: 'Customer Phone', group: 'case', kind: 'text' },
  { key: 'customer_calling_code', label: 'Customer Calling Code', group: 'case', kind: 'text' },
  { key: 'pan_number', label: 'PAN Number', group: 'case', kind: 'text' },
  {
    key: 'case_number',
    label: 'Case Number',
    group: 'case',
    kind: 'number',
    description: 'Auto-increment case_id',
  },
  { key: 'applicant_type', label: 'Applicant Type', group: 'case', kind: 'text' },
  { key: 'priority', label: 'Priority', group: 'case', kind: 'text' },
  { key: 'pincode', label: 'Pincode', group: 'case', kind: 'text' },
  { key: 'backend_contact_number', label: 'Backend Contact Number', group: 'case', kind: 'text' },
  { key: 'trigger', label: 'Trigger / Remark', group: 'case', kind: 'text' },
  { key: 'received_date', label: 'Case Received Date', group: 'case', kind: 'datetime' },
  { key: 'completed_date', label: 'Case Completed Date', group: 'case', kind: 'datetime' },
  { key: 'case_status', label: 'Case Status', group: 'case', kind: 'text' },

  // ---------- Case-level via joins ----------
  { key: 'client_name', label: 'Client Name', group: 'caseJoin', kind: 'text' },
  { key: 'product_name', label: 'Product Name', group: 'caseJoin', kind: 'text' },
  { key: 'verification_type_name', label: 'Verification Type', group: 'caseJoin', kind: 'text' },

  // ---------- Task-level (earliest by created_at) ----------
  { key: 'task_number', label: 'Task Number (TID)', group: 'task', kind: 'text' },
  { key: 'task_title', label: 'Task Title', group: 'task', kind: 'text' },
  { key: 'task_type', label: 'Task Type', group: 'task', kind: 'text' },
  { key: 'task_description', label: 'Task Description', group: 'task', kind: 'text' },
  { key: 'verification_address', label: 'Verification Address', group: 'task', kind: 'text' },
  { key: 'task_pincode', label: 'Task Pincode', group: 'task', kind: 'text' },
  { key: 'estimated_amount', label: 'Estimated Amount', group: 'task', kind: 'number' },
  { key: 'actual_amount', label: 'Actual Amount', group: 'task', kind: 'number' },
  { key: 'task_priority', label: 'Task Priority', group: 'task', kind: 'text' },
  { key: 'task_applicant_type', label: 'Task Applicant Type', group: 'task', kind: 'text' },
  { key: 'task_status', label: 'Task Status', group: 'task', kind: 'text' },
  { key: 'rate_type_name', label: 'Rate Type', group: 'task', kind: 'text' },
  { key: 'task_assigned_at', label: 'Task Assigned At', group: 'task', kind: 'datetime' },
  { key: 'task_started_at', label: 'Task Started At', group: 'task', kind: 'datetime' },
  { key: 'task_completed_at', label: 'Task Completed At', group: 'task', kind: 'datetime' },
  { key: 'verifier_name', label: 'Verifier / Field Agent Name', group: 'task', kind: 'text' },
  { key: 'assigned_by_name', label: 'Assigned By (Name)', group: 'task', kind: 'text' },

  // ---------- Applicant-level (earliest by created_at) ----------
  { key: 'applicant_name', label: 'Applicant Name', group: 'applicant', kind: 'text' },
  { key: 'applicant_mobile', label: 'Applicant Mobile', group: 'applicant', kind: 'text' },

  // ---------- Other ----------
  { key: 'case_created_by_name', label: 'Case Created By (Name)', group: 'other', kind: 'text' },
];

export const PREFILL_SOURCE_KEYS: ReadonlySet<string> = new Set(PREFILL_CATALOG.map(e => e.key));

export const getPrefillEntry = (key: string | null | undefined): PrefillCatalogEntry | null => {
  if (!key) {
    return null;
  }
  return PREFILL_CATALOG.find(e => e.key === key) ?? null;
};

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
