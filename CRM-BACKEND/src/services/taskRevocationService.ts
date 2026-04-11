import { query } from '@/config/database';
import { isFieldExecutionActor } from '@/security/rbacAccess';
import type { AuthenticatedRequest } from '@/middleware/auth';

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

type RecordRevocationInput = {
  taskId: string;
  revokedByUserId: string;
  revokedByRole: 'ADMIN' | 'FE';
  revokedFromUserId: string | null;
  revokeReason: string;
  previousStatus: string;
};

export class TaskRevocationService {
  static deriveRevokedByRole(
    user: Pick<NonNullable<AuthenticatedRequest['user']>, 'permissionCodes'> | undefined
  ): 'ADMIN' | 'FE' {
    return isFieldExecutionActor(
      user ? ({ permissionCodes: user.permissionCodes } as AuthenticatedRequest['user']) : undefined
    )
      ? 'FE'
      : 'ADMIN';
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
