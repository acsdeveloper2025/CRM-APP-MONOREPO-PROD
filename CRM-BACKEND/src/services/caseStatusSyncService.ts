import { PoolClient } from 'pg';
import { withTransaction } from '../config/db';
import { logger } from '../utils/logger';

export class CaseStatusSyncService {
  /**
   * Recalculates and updates the status of a case based on its verification tasks.
   *
   * Priority order (first match wins):
   *   1. RV == T              → REVOKED  (only when ALL tasks revoked)
   *   2. C + RV == T          → COMPLETED  (all done or revoked; CLOSED ≡ COMPLETED in this codebase)
   *   3. IP > 0               → IN_PROGRESS  (any task actively being worked)
   *   4. A > 0                → ASSIGNED  (some task waiting for FE to start)
   *   5. P > 0                → PENDING  (no task assigned yet — = prompt's CREATED)
   *
   * Mixed-state edge cases (e.g. 1×COMPLETED + 1×PENDING after a revisit task is added)
   * fall through to the lowest-priority active rule (#5 = PENDING in that example).
   *
   * Also updates cases.completed_at:
   * - Set to NOW() if status becomes COMPLETED (preserved if already set, via COALESCE)
   * - Set to NULL otherwise
   *
   * @param caseId The UUID or numeric ID of the case
   * @param client Optional PoolClient for transaction support
   */
  static async recalculateCaseStatus(caseId: string, client?: PoolClient): Promise<void> {
    // R-CRIT-1 follow-up (AUDIT 2026-05-17): if no caller-supplied tx,
    // open a fresh one so the FOR UPDATE lock below actually spans the
    // SELECT + UPDATE window. Without the wrap, FOR UPDATE on the bare
    // pool runs in auto-commit mode and the lock releases per statement
    // — no phantom-read protection. This guard fixes the 6 post-commit
    // callers (createTasksForCase, assignTask, updateTask, mobile
    // updateCaseStatus / completeTask / completeVerificationTask) without
    // touching their call sites.
    if (!client) {
      return withTransaction(async (txClient) => {
        return CaseStatusSyncService.recalculateCaseStatus(caseId, txClient);
      });
    }

    try {
      // Lock the case row so concurrent task INSERT/UPDATE can't slip in
      // between the SELECT below and the UPDATE further down.
      await client.query(`SELECT id FROM cases WHERE id = $1 FOR UPDATE`, [caseId]);

      // Fetch all tasks for this case
      const tasksResult = await client.query(
        `SELECT status FROM verification_tasks WHERE case_id = $1`,
        [caseId]
      );

      const tasks = tasksResult.rows;

      if (tasks.length === 0) {
        logger.info(`No tasks found for case ${caseId}, skipping status sync`);
        return;
      }

      const t = tasks.length;
      const counts: { c: number; rv: number; ip: number; a: number; p: number } = {
        c: 0,
        rv: 0,
        ip: 0,
        a: 0,
        p: 0,
      };
      for (const task of tasks) {
        const s = String(task.status);
        if (s === 'COMPLETED') {
          counts.c++;
        } else if (s === 'REVOKED') {
          counts.rv++;
        } else if (s === 'IN_PROGRESS') {
          counts.ip++;
        } else if (s === 'ASSIGNED') {
          counts.a++;
        } else if (s === 'PENDING') {
          counts.p++;
        }
      }

      let newStatus: string;
      let completedAt: Date | null = null;

      if (counts.rv === t) {
        newStatus = 'REVOKED';
      } else if (counts.c + counts.rv === t) {
        newStatus = 'COMPLETED';
        completedAt = new Date();
      } else if (counts.ip > 0) {
        newStatus = 'IN_PROGRESS';
      } else if (counts.a > 0) {
        newStatus = 'ASSIGNED';
      } else {
        // P > 0 by elimination (every task is in one of the 5 statuses
        // and the four prior buckets are exhausted).
        newStatus = 'PENDING';
      }

      // Update the case
      // Use COALESCE to preserve the original completed_at if it was already set
      // (prevents overwriting historical completion dates on re-sync)
      await client.query(
        `UPDATE cases
         SET status = $1::varchar,
             completed_at = CASE
               WHEN $1::text = 'COMPLETED' THEN COALESCE(completed_at, $2::timestamp)
               ELSE NULL
             END,
             updated_at = NOW()
         WHERE id = $3`,
        [newStatus, completedAt, caseId]
      );

      logger.info(`Case ${caseId} status synchronized`, {
        newStatus,
        completedAt,
        taskCount: tasks.length,
      });
    } catch (error) {
      logger.error(`Failed to recalculate status for case ${caseId}:`, error);
      throw error;
    }
  }
}
