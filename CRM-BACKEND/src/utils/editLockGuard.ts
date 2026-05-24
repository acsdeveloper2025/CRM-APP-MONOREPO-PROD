/**
 * Single source of truth for the "IN_PROGRESS = no edit" business rule
 * across Case / Field Task / KYC.
 *
 * See project_in_progress_edit_lock_audit_2026_05_24.md for the full
 * audit and don't-regress list. Any controller that mutates a case,
 * verification_task, or kyc_document_verifications row MUST gate the
 * mutation through assertEditable() before issuing the UPDATE.
 */

export type EditLockedStatus = 'IN_PROGRESS' | 'COMPLETED' | 'REVOKED';

const LOCKED_STATUSES: ReadonlySet<string> = new Set<EditLockedStatus>([
  'IN_PROGRESS',
  'COMPLETED',
  'REVOKED',
]);

export type EditLockResult =
  | { editable: true }
  | { editable: false; reason: 'IN_PROGRESS' | 'TERMINAL'; currentStatus: string };

/**
 * Pure predicate. PENDING / ASSIGNED are editable; everything else is
 * locked. `started_at IS NOT NULL` is checked at the call site when the
 * entity tracks it (verification_tasks) — keep this helper status-only
 * so it works for cases (no started_at) and KYC docs alike.
 */
export function isEditable(status: string | null | undefined): boolean {
  if (!status) {
    return true;
  } // missing status = newly-created path; defer to caller
  return !LOCKED_STATUSES.has(status);
}

/**
 * Returns a structured verdict for the controller to translate into a
 * 409 response body. Reason field distinguishes "task is being worked
 * on" (IN_PROGRESS) from "already terminal" (COMPLETED/REVOKED) so the
 * UI can phrase the error precisely.
 */
export function checkEditable(status: string | null | undefined): EditLockResult {
  if (isEditable(status)) {
    return { editable: true };
  }
  const reason: 'IN_PROGRESS' | 'TERMINAL' = status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TERMINAL';
  return { editable: false, reason, currentStatus: status as string };
}

/**
 * Canonical 409 payload — every controller returns this exact shape so
 * the FE can pattern-match on `error.code === 'EDIT_BLOCKED'` and show
 * the BE message verbatim. The legacy `TASK_LOCKED` code on
 * verificationTasksController (work-order field-lock for operational
 * fields like address/pincode) is kept for back-compat but new guards
 * use EDIT_BLOCKED.
 */
export function buildEditBlockedResponse(
  entity: 'Case' | 'Task' | 'KYC document',
  result: Extract<EditLockResult, { editable: false }>
): {
  success: false;
  message: string;
  error: {
    code: 'EDIT_BLOCKED';
    currentStatus: string;
    reason: EditLockResult['editable'] extends false ? 'IN_PROGRESS' | 'TERMINAL' : never;
  };
} {
  const verb =
    result.reason === 'IN_PROGRESS'
      ? 'is currently being processed'
      : `is ${result.currentStatus.toLowerCase()}`;
  return {
    success: false,
    message: `${entity} ${verb}; edits are not allowed.`,
    error: {
      code: 'EDIT_BLOCKED',
      currentStatus: result.currentStatus,
      reason: result.reason as never,
    },
  };
}
