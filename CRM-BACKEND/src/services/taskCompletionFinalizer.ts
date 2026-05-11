/**
 * Task Completion Finalizer
 * -------------------------
 * Single authoritative place for financial-completion behavior triggered
 * when a verification task transitions to COMPLETED.
 *
 * Used by BOTH:
 *   - Web completion path:   verificationTasksController.completeTask
 *   - Mobile completion path: mobileFormController.submit<Type>Verification (9 sites)
 *
 * Responsibilities (intentional scope):
 *   1. actual_amount snapshot — freezes the billable amount onto the task row
 *      so downstream invoice/commission engines have a stable historical value
 *      even if rates/SZR/RTA are reconfigured later.
 *   2. Commission auto-calculation — invokes the per-task commission engine
 *      (idempotent on commission_calculations.verification_task_id UNIQUE).
 *   3. Reserved hook point for future post-completion financial side-effects
 *      (e.g., billing-batch enqueueing, invoice item linkage).
 *
 * NOT in scope (do NOT add here):
 *   - case-level status recompute (CaseStatusSyncService owns that)
 *   - verification_outcome / form-submission writes (controller-specific)
 *   - revoke / reassignment financial handling
 *
 * Transactional ordering contract:
 *   - `snapshotFinancials` MUST run INSIDE the same transaction that flips
 *     verification_tasks.status to 'COMPLETED'. Atomicity guarantees the row
 *     never reaches COMPLETED with NULL actual_amount.
 *   - `triggerPostCompletionHooks` MUST run AFTER the completion transaction
 *     has COMMITTED. The commission auto-calc uses the pool — it cannot see
 *     uncommitted writes from a sibling client transaction.
 *
 * Idempotent by design:
 *   - actual_amount UPDATE uses COALESCE(actual_amount, $given, estimated_amount)
 *     — runs once per task; replays no-op.
 *   - autoCalculateCommissionForTask uses ON CONFLICT DO NOTHING on the
 *     verification_task_id UNIQUE constraint.
 */

import type { PoolClient } from 'pg';
import { logger } from '@/config/logger';
import { autoCalculateCommissionForTask } from '@/controllers/commissionManagementController';

export interface SnapshotFinancialsOptions {
  /**
   * Explicit override for actual_amount. Takes precedence over the
   * task's estimated_amount fallback. Pass `null` (default) to let
   * estimated_amount fill in.
   */
  actualAmount?: number | string | null;
}

export const TaskCompletionFinalizer = {
  /**
   * Snapshot financial state on the verification_task row.
   *
   * Run INSIDE the transaction that flips status='COMPLETED'.
   *
   * Idempotent: actual_amount is only written when currently NULL.
   * Subsequent calls (e.g., from a revisit completion or a sync replay)
   * preserve the historical snapshot.
   */
  async snapshotFinancials(
    client: PoolClient,
    taskId: string,
    options: SnapshotFinancialsOptions = {}
  ): Promise<void> {
    const explicitAmount = options.actualAmount ?? null;
    await client.query(
      `UPDATE verification_tasks
         SET actual_amount = COALESCE(actual_amount, $2, estimated_amount),
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [taskId, explicitAmount]
    );
  },

  /**
   * Fire post-completion financial side-effects.
   *
   * Run AFTER the completion transaction has committed.
   *
   * Currently:
   *   - commission auto-calculation (idempotent)
   *
   * Failure is logged but never thrown — commission can be reconciled
   * later via the admin endpoint; the completion itself must not roll
   * back because of a downstream hook.
   */
  async triggerPostCompletionHooks(taskId: string): Promise<void> {
    try {
      await autoCalculateCommissionForTask(taskId);
    } catch (err) {
      logger.error('TaskCompletionFinalizer.triggerPostCompletionHooks failed', {
        taskId,
        error: err,
      });
    }
  },
};
