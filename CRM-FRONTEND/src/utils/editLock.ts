/**
 * Single source of truth for the FE-side "IN_PROGRESS = no edit"
 * business rule. Mirrors CRM-BACKEND/src/utils/editLockGuard.ts.
 *
 * See project_in_progress_edit_lock_audit_2026_05_24.md.
 *
 * Use for:
 *   - Hiding/disabling Edit buttons in lists and detail pages
 *   - Pattern-matching on BE 409 `error.code === 'EDIT_BLOCKED'`
 */

import type { TaskStatus } from '@/types/verificationTask';

export type CaseStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
export type KycVerificationStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVOKED';

export type LockableStatus = TaskStatus | CaseStatus | KycVerificationStatus | string;

const LOCKED_STATUSES = new Set<string>(['IN_PROGRESS', 'COMPLETED', 'REVOKED']);

export function isEditable(status: LockableStatus | null | undefined): boolean {
  if (!status) {
    return true;
  }
  return !LOCKED_STATUSES.has(status);
}

export function editBlockedReason(status: LockableStatus | null | undefined): string | null {
  if (isEditable(status)) {
    return null;
  }
  if (status === 'IN_PROGRESS') {
    return 'Currently being processed; edits are not allowed.';
  }
  return `Already ${String(status).toLowerCase()}; edits are not allowed.`;
}

/**
 * Extract a structured EDIT_BLOCKED error from an axios-style error.
 * Returns null if the error is anything else — callers fall back to
 * generic toast extraction.
 */
export function extractEditBlockedError(error: unknown): {
  message: string;
  currentStatus?: string;
} | null {
  const e = error as {
    response?: { data?: { message?: string; error?: { code?: string; currentStatus?: string } } };
  };
  const code = e?.response?.data?.error?.code;
  if (code !== 'EDIT_BLOCKED' && code !== 'TASK_LOCKED') {
    return null;
  }
  return {
    message: e.response?.data?.message || 'This record cannot be edited right now.',
    currentStatus: e.response?.data?.error?.currentStatus,
  };
}
