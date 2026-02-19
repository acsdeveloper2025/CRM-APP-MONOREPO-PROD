import { PoolClient } from 'pg';
import { query } from '../config/database';
import { logger } from '../utils/logger';

interface DbClient {
  query: (
    text: string,
    params?: (string | number | Date | null)[]
  ) => Promise<{ rows: Record<string, unknown>[] }>;
}

export class CaseStatusSyncService {
  /**
   * Recalculates and updates the status of a case based on its verification tasks.
   *
   * Rules:
   * - ANY task is PENDING / ASSIGNED / IN_PROGRESS → case = IN_PROGRESS
   * - ALL tasks are COMPLETED or REVOKED → case = COMPLETED
   * - ALL tasks are REVOKED → case = REVOKED
   *
   * Also updates cases.completedAt:
   * - Set to NOW() if status becomes COMPLETED
   * - Set to NULL if status is NOT COMPLETED
   *
   * @param caseId The UUID or numeric ID of the case
   * @param client Optional PoolClient for transaction support
   */
  static async recalculateCaseStatus(caseId: string, client?: PoolClient): Promise<void> {
    try {
      const db: DbClient = client || {
        query: (text: string, params?: (string | number | Date | null)[]) =>
          query(text, params || []),
      };

      // Fetch all tasks for this case
      const tasksResult = await db.query(
        `SELECT status FROM verification_tasks WHERE case_id = $1`,
        [caseId]
      );

      const tasks = tasksResult.rows;

      if (tasks.length === 0) {
        logger.info(`No tasks found for case ${caseId}, skipping status sync`);
        return;
      }

      let newStatus = 'IN_PROGRESS';
      let completedAt: Date | null = null;

      const allRevoked = tasks.every(t => t.status === 'REVOKED');
      const allCompletedOrRevoked = tasks.every(
        t => t.status === 'COMPLETED' || t.status === 'REVOKED'
      );
      const anyInProgress = tasks.some(
        t => t.status === 'PENDING' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS'
      );

      if (allRevoked) {
        newStatus = 'REVOKED';
      } else if (allCompletedOrRevoked) {
        newStatus = 'COMPLETED';
        completedAt = new Date();
      } else if (anyInProgress) {
        newStatus = 'IN_PROGRESS';
      }
      // Default remains IN_PROGRESS if none of the above matches exactly

      // Update the case
      await db.query(
        `UPDATE cases 
         SET status = $1, 
             "completedAt" = $2, 
             "updatedAt" = NOW() 
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
