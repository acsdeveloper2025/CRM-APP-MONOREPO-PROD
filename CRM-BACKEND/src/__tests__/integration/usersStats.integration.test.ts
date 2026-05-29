/**
 * Characterization of GET /api/users/stats (usersController.getUserStats) —
 * the first real controller suite on the integration harness. Pins the
 * response contract (canonical 5-card shape + legacy aliases), internal
 * invariants, the deterministic seed count, and RBAC enforcement.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

describe('GET /api/users/stats', () => {
  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('returns the canonical 5-card shape + legacy aliases for an authorized user', async () => {
    const res = await request(app)
      .get('/api/users/stats')
      .set('Authorization', await authHeaderForRole('SUPER_ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const d = res.body.data;
    // Canonical 5-card fields are present and numeric.
    for (const k of ['total', 'active', 'inactive', 'recentlyAddedCount', 'mfaEnabledCount']) {
      expect(typeof d[k]).toBe('number');
    }
    // Internal invariant: every non-deleted user is either active or inactive.
    expect(d.total).toBe(d.active + d.inactive);
    // Canonical fields and their legacy aliases agree.
    expect(d.totalUsers).toBe(d.total);
    expect(d.activeUsers).toBe(d.active);
    expect(d.inactiveUsers).toBe(d.inactive);
    // Legacy breakdown fields are arrays.
    expect(Array.isArray(d.usersByRole)).toBe(true);
    expect(Array.isArray(d.usersByDepartment)).toBe(true);
    expect(Array.isArray(d.recentLogins)).toBe(true);
  });

  it('total matches the live non-deleted user count in the seed DB', async () => {
    const { rows } = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users WHERE deleted_at IS NULL'
    );
    const expected = Number(rows[0].count);

    const res = await request(app)
      .get('/api/users/stats')
      .set('Authorization', await authHeaderForRole('SUPER_ADMIN'));

    expect(res.body.data.total).toBe(expected);
  });

  it('enforces the user.view permission (FIELD_AGENT is forbidden)', async () => {
    const res = await request(app)
      .get('/api/users/stats')
      .set('Authorization', await authHeaderForRole('FIELD_AGENT'));

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/users/stats');
    expect(res.status).toBe(401);
  });
});
