import { query } from '@/config/database';

export class TaskLookupService {
  /**
   * Resolves a verification task ID to its associated case ID.
   * Throws an error if the task is not found.
   *
   * @param taskId The UUID of the verification task
   * @returns The UUID of the associated case
   */
  static async resolveCaseId(taskId: string): Promise<string> {
    // Validate UUID format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);

    if (!isUUID) {
      throw new Error('Invalid task ID format');
    }

    const result = await query('SELECT case_id FROM verification_tasks WHERE id = $1', [taskId]);

    if (result.rows.length === 0) {
      throw new Error('Verification task not found');
    }

    return result.rows[0].case_id;
  }

  /**
   * Verifies if a task exists and belongs to a specific user (optional)
   */
  static async verifyTaskAccess(taskId: string, userId?: string): Promise<boolean> {
    let sql = 'SELECT 1 FROM verification_tasks WHERE id = $1';
    const params: any[] = [taskId];

    if (userId) {
      sql += ' AND assigned_to = $2';
      params.push(userId);
    }

    const result = await query(sql, params);
    return result.rows.length > 0;
  }
}
