/**
 * Characterization of productsController read surface — GET /api/products
 * (scoped list), /api/products/stats (active/inactive aggregate), and
 * /api/products/:id. Master data: auth + data-scoped reads (no permission
 * gate), integer ids.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

describe('productsController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('GET /api/products returns the scoped list envelope', async () => {
    const res = await request(app).get('/api/products').set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.pagination.total).toBe('number');
    expect(typeof res.body.pagination.totalPages).toBe('number');
  });

  it('GET /api/products/stats returns active/inactive aggregate', async () => {
    const res = await request(app).get('/api/products/stats').set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    const d = res.body.data;
    for (const k of ['total', 'active', 'inactive']) {
      expect(typeof d[k]).toBe('number');
    }
    expect(d.total).toBe(d.active + d.inactive);
  });

  it('GET /api/products/:id returns the requested product, 404 when missing', async () => {
    const { rows } = await query<{ id: number }>('SELECT id FROM products ORDER BY id LIMIT 1');
    const id = rows[0].id;

    const found = await request(app).get(`/api/products/${id}`).set('Authorization', adminAuth);
    expect(found.status).toBe(200);
    expect(Number(found.body?.data?.id)).toBe(id);

    const missing = await request(app)
      .get('/api/products/999999999')
      .set('Authorization', adminAuth);
    expect(missing.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });
});
