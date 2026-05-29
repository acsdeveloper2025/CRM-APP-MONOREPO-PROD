/**
 * Characterization of clientsController read surface — GET /api/clients
 * (scoped list + pagination), GET /api/clients/stats (canonical 5-card),
 * and GET /api/clients/:id. Clients are auth + data-scoped (no permission
 * gate) with integer ids. Pins behavior on the harness.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

describe('clientsController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('GET /api/clients', () => {
    it('returns the scoped list envelope', async () => {
      const res = await request(app).get('/api/clients').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const { pagination } = res.body;
      for (const k of ['page', 'limit', 'total', 'totalPages']) {
        expect(typeof pagination[k]).toBe('number');
      }
      expect(pagination.totalPages).toBe(Math.ceil(pagination.total / pagination.limit));
      expect(res.body.data.length).toBeLessThanOrEqual(pagination.limit);
    });

    it('honours the limit query param', async () => {
      const res = await request(app)
        .get('/api/clients?page=1&limit=2')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('rejects an invalid limit (>500) with 400', async () => {
      const res = await request(app)
        .get('/api/clients?limit=9999')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/clients/stats', () => {
    it('returns the canonical 5-card shape with consistent totals', async () => {
      const res = await request(app).get('/api/clients/stats').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const d = res.body.data;
      for (const k of ['total', 'active', 'inactive', 'recentlyAddedCount', 'withoutProductsCount']) {
        expect(typeof d[k]).toBe('number');
      }
      expect(d.total).toBe(d.active + d.inactive);
    });

    it('list total and stats total agree for a cross-tenant admin', async () => {
      const list = await request(app).get('/api/clients').set('Authorization', adminAuth);
      const stats = await request(app).get('/api/clients/stats').set('Authorization', adminAuth);
      expect(list.body.pagination.total).toBe(stats.body.data.total);
    });
  });

  describe('GET /api/clients/:id', () => {
    it('returns the requested client', async () => {
      const { rows } = await query<{ id: number }>(
        'SELECT id FROM clients ORDER BY id LIMIT 1'
      );
      const id = rows[0].id;
      const res = await request(app).get(`/api/clients/${id}`).set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(Number(res.body?.data?.id)).toBe(id);
    });

    it('rejects a non-integer id with 400', async () => {
      const res = await request(app).get('/api/clients/not-a-number').set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });
  });
});
