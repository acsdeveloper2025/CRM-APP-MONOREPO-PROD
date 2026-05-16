import { query } from '@/config/database';
import { isFieldExecutionActor } from '@/security/rbacAccess';
import type { AuthenticatedRequest } from '@/middleware/auth';

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

type RecordRevocationInput = {
  taskId: string;
  revokedByUserId: string;
  revokedByRole: string;
  revokedFromUserId: string | null;
  revokeReason: string;
  previousStatus: string;
};

export class TaskRevocationService {
  /**
   * NM-12 (2026-05-16): broadened from 'FE' | 'ADMIN' to the full role
   * enum so `task_revocations.revoked_by_role` audit analytics can
   * distinguish SUPER_ADMIN vs MANAGER vs TEAM_LEADER vs BACKEND_USER
   * vs FE. Falls back to 'ADMIN' for any non-FE role we don't recognize
   * by name. Column is varchar(16) — all values fit.
   */
  static deriveRevokedByRole(
    user:
      | Pick<NonNullable<AuthenticatedRequest['user']>, 'permissionCodes' | 'primaryRole'>
      | undefined
  ): string {
    if (
      isFieldExecutionActor(
        user
          ? ({ permissionCodes: user.permissionCodes } as AuthenticatedRequest['user'])
          : undefined
      )
    ) {
      return 'FE';
    }
    const role = user?.primaryRole?.toUpperCase() || '';
    if (role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (role === 'MANAGER') return 'MANAGER';
    if (role === 'TEAM_LEADER') return 'TEAM_LEADER';
    if (role === 'BACKEND_USER') return 'BACKEND_USER';
    return 'ADMIN'; // generic fallback for unknown non-FE actor
  }

  static async recordRevocation(db: Queryable, input: RecordRevocationInput): Promise<number> {
    const result = await db.query(
      `
        INSERT INTO task_revocations (
          task_id,
          revoked_by_user_id,
          revoked_by_role,
          revoked_from_user_id,
          revoke_reason,
          previous_status,
          revoked_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `,
      [
        input.taskId,
        input.revokedByUserId,
        input.revokedByRole,
        input.revokedFromUserId,
        input.revokeReason,
        input.previousStatus,
      ]
    );

    return Number(result.rows[0]?.id || 0);
  }

  static async markReassigned(
    db: Queryable,
    taskId: string,
    reassignedToUserId: string
  ): Promise<void> {
    await db.query(
      `
        UPDATE task_revocations
        SET
          reassigned = TRUE,
          reassigned_to_user_id = $1,
          reassigned_at = NOW()
        WHERE id = (
          SELECT id
          FROM task_revocations
          WHERE task_id = $2
          ORDER BY revoked_at DESC, id DESC
          LIMIT 1
        )
      `,
      [reassignedToUserId, taskId]
    );
  }

  static async getLatestRevocation(taskId: string): Promise<{
    id: number;
    revokedFromUserId: string | null;
    revokedByRole: 'ADMIN' | 'FE';
    revokedAt: string;
    reassigned: boolean;
  } | null> {
    const result = await query(
      `
        SELECT
          id,
          revoked_from_user_id,
          revoked_by_role,
          revoked_at,
          reassigned
        FROM task_revocations
        WHERE task_id = $1
        ORDER BY revoked_at DESC, id DESC
        LIMIT 1
      `,
      [taskId]
    );

    return (
      (result.rows[0] as
        | {
            id: number;
            revokedFromUserId: string | null;
            revokedByRole: 'ADMIN' | 'FE';
            revokedAt: string;
            reassigned: boolean;
          }
        | undefined) || null
    );
  }

  static async getRevokedAssignmentIdsForUser(userId: string): Promise<string[]> {
    const result = await query<{ taskId: string }>(
      `
        SELECT DISTINCT tr.task_id
        FROM task_revocations tr
        JOIN verification_tasks vt ON vt.id = tr.task_id
        WHERE tr.revoked_from_user_id = $1
          AND vt.status = 'REVOKED'
        ORDER BY tr.task_id
      `,
      [userId]
    );

    return result.rows.map(row => row.taskId);
  }
}
