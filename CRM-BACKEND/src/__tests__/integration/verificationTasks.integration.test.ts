/**
 * Characterization of VerificationTasksController read surface —
 * GET /api/verification-tasks (data.tasks[] + data.pagination + data.statistics),
 * /api/verification-tasks/stats, /api/verification-tasks/:taskId.
 * Safety net ahead of decomposing the 3159-LOC verificationTasksController (§7).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('verificationTasksController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('GET /api/verification-tasks', () => {
    it('returns data.tasks + data.pagination + data.statistics', async () => {
      const res = await request(app).get('/api/verification-tasks').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);

      const p = res.body.data.pagination;
      for (const k of ['page', 'limit', 'total', 'totalPages']) {
        expect(typeof p[k]).toBe('number');
      }
      expect(p.totalPages).toBe(Math.ceil(p.total / p.limit));
      expect(res.body.data.tasks.length).toBeLessThanOrEqual(p.limit);

      const s = res.body.data.statistics;
      for (const k of ['pending', 'assigned', 'inProgress', 'completed', 'revoked']) {
        expect(typeof s[k]).toBe('number');
      }
    });

    it('honours the limit query param', async () => {
      const res = await request(app)
        .get('/api/verification-tasks?page=1&limit=2')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.tasks.length).toBeLessThanOrEqual(2);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/verification-tasks');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/verification-tasks/stats', () => {
    it('returns a numeric status breakdown', async () => {
      const res = await request(app)
        .get('/api/verification-tasks/stats')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const d = res.body.data;
      for (const k of ['total', 'pending', 'assigned', 'inProgress', 'completed']) {
        expect(typeof d[k]).toBe('number');
      }
      expect(d.total).toBeGreaterThanOrEqual(0);
      expect(d.total).toBeGreaterThanOrEqual(d.completed);
    });
  });

  describe('GET /api/verification-tasks/:taskId', () => {
    it('returns the requested task', async () => {
      const { rows } = await query<{ id: string }>(
        'SELECT id FROM verification_tasks ORDER BY created_at LIMIT 1'
      );
      const id = rows[0].id;
      const res = await request(app)
        .get(`/api/verification-tasks/${id}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
    });

    it('returns 404 for a non-existent task id', async () => {
      const res = await request(app)
        .get(`/api/verification-tasks/${NONEXISTENT_UUID}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
    });
  });
});
