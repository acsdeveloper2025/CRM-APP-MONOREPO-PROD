/**
 * Characterization of invoicesController read surface — GET /api/invoices
 * (data[] + pagination), /api/invoices/stats, /api/invoices/:id. Gated by
 * the billing.download permission (good RBAC signal). Seed has 0 invoices,
 * so the list/empty + 404 + RBAC paths are the focus. Safety net ahead of
 * decomposing the 2364-LOC invoicesController (§7).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

describe('invoicesController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('GET /api/invoices', () => {
    it('returns the list envelope (data[] + pagination)', async () => {
      const res = await request(app).get('/api/invoices').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const p = res.body.pagination;
      for (const k of ['page', 'limit', 'total', 'totalPages']) {
        expect(typeof p[k]).toBe('number');
      }
      expect(p.totalPages).toBe(Math.ceil(p.total / p.limit));
      expect(res.body.data.length).toBeLessThanOrEqual(p.limit);
    });

    it('honours the limit query param', async () => {
      const res = await request(app)
        .get('/api/invoices?page=1&limit=2')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('enforces billing.download (FIELD_AGENT 403, unauthenticated 401)', async () => {
      const forbidden = await request(app)
        .get('/api/invoices')
        .set('Authorization', await authHeaderForRole('FIELD_AGENT'));
      expect(forbidden.status).toBe(403);

      const unauth = await request(app).get('/api/invoices');
      expect(unauth.status).toBe(401);
    });
  });

  describe('GET /api/invoices/stats', () => {
    it('returns a stats object for an authorized user', async () => {
      const res = await request(app).get('/api/invoices/stats').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(typeof res.body.data).toBe('object');
      expect(res.body.data).not.toBeNull();
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('returns 404 for a non-existent invoice id', async () => {
      const res = await request(app)
        .get('/api/invoices/999999999')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
    });
  });
});
