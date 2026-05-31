/**
 * Happy-path characterization of POST /api/verification-tasks/:taskId/start —
 * the ASSIGNED → IN_PROGRESS workflow transition, gated by visit.start with
 * task ownership. The owning field agent starts their own assigned task;
 * we verify the status + started_at flip in the DB and reset it afterward.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { mintAccessToken } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

let taskId: string;
let ownerToken: string;

describe('POST /api/verification-tasks/:taskId/start (happy path)', () => {
  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    const { rows } = await query<{ id: string; owner: string; token_version: number }>(
      `SELECT vt.id, vt.assigned_to AS owner, u.token_version
         FROM verification_tasks vt
         JOIN users u ON u.id = vt.assigned_to
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles_v2 r ON r.id = ur.role_id
        WHERE r.name = 'FIELD_AGENT' AND u.is_active = true AND vt.status = 'ASSIGNED'
        LIMIT 1`
    );
    if (rows.length === 0) throw new Error('No ASSIGNED field-agent task in seed');
    taskId = rows[0].id;
    ownerToken = `Bearer ${mintAccessToken({
      id: rows[0].owner,
      username: 'owner',
      tokenVersion: rows[0].token_version,
    })}`;
  });

  afterAll(async () => {
    // Reset the task back to its pre-test state.
    if (taskId) {
      await query(
        `UPDATE verification_tasks SET status = 'ASSIGNED', started_at = NULL WHERE id = $1`,
        [taskId]
      ).catch(() => undefined);
    }
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('the owning field agent transitions the task ASSIGNED → IN_PROGRESS', async () => {
    const res = await request(app)
      .post(`/api/verification-tasks/${taskId}/start`)
      .set('Authorization', ownerToken);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const after = await query<{ status: string; started_at: string | null }>(
      'SELECT status, started_at FROM verification_tasks WHERE id = $1',
      [taskId]
    );
    expect(after.rows[0].status).toBe('IN_PROGRESS');
    expect(after.rows[0].started_at).not.toBeNull();
  });
});
