/**
 * Characterization of commissionManagementController read surface —
 * /api/commission-management/rate-types, /stats, /calculations. All gated by
 * the billing.download permission. Safety net ahead of decomposing the
 * 2036-LOC commissionManagementController (§7).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

const BASE = '/api/commission-management';

describe('commissionManagementController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('GET /rate-types returns a list for an authorized user', async () => {
    const res = await request(app).get(`${BASE}/rate-types`).set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /stats returns an aggregate object', async () => {
    const res = await request(app).get(`${BASE}/stats`).set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body.data).toBe('object');
    expect(res.body.data).not.toBeNull();
  });

  it('GET /calculations responds for an authorized user', async () => {
    const res = await request(app).get(`${BASE}/calculations`).set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('enforces billing.download (FIELD_AGENT 403, unauthenticated 401)', async () => {
    const forbidden = await request(app)
      .get(`${BASE}/rate-types`)
      .set('Authorization', await authHeaderForRole('FIELD_AGENT'));
    expect(forbidden.status).toBe(403);

    const unauth = await request(app).get(`${BASE}/rate-types`);
    expect(unauth.status).toBe(401);
  });
});
