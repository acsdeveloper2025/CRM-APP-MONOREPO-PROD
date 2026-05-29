/**
 * Characterization of casesController read surface — GET /api/cases
 * (NESTED envelope: data.data[] + data.pagination), GET /api/cases/stats
 * (status breakdown), GET /api/cases/:id (uuid + validateCaseAccess).
 * Safety net ahead of decomposing the 3470-LOC casesController (§7).
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

describe('casesController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('GET /api/cases', () => {
    it('returns the nested list envelope (data.data + data.pagination)', async () => {
      const res = await request(app).get('/api/cases').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);

      const p = res.body.data.pagination;
      for (const k of ['page', 'limit', 'total', 'totalPages']) {
        expect(typeof p[k]).toBe('number');
      }
      expect(p.totalPages).toBe(Math.ceil(p.total / p.limit));
      expect(res.body.data.data.length).toBeLessThanOrEqual(p.limit);
    });

    it('honours the limit query param', async () => {
      const res = await request(app)
        .get('/api/cases?page=1&limit=2')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.data.length).toBeLessThanOrEqual(2);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/cases');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/cases/stats', () => {
    it('returns a numeric status breakdown', async () => {
      const res = await request(app).get('/api/cases/stats').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const d = res.body.data;
      for (const k of ['total', 'pending', 'assigned', 'inProgress', 'completed', 'revoked']) {
        expect(typeof d[k]).toBe('number');
      }
      expect(d.total).toBeGreaterThanOrEqual(0);
      expect(d.total).toBeGreaterThanOrEqual(d.completed);
    });
  });

  describe('GET /api/cases/:id', () => {
    it('returns the requested case', async () => {
      const { rows } = await query<{ id: string }>('SELECT id FROM cases ORDER BY created_at LIMIT 1');
      const id = rows[0].id;
      const res = await request(app).get(`/api/cases/${id}`).set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
    });

    it('returns 404 for a non-existent case id', async () => {
      const res = await request(app)
        .get(`/api/cases/${NONEXISTENT_UUID}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
    });
  });
});
