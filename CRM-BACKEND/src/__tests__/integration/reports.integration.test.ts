/**
 * Characterization of reportsController read surface — the aggregate
 * analytics endpoints (case-analytics, agent-performance). The whole
 * /api/reports router is gated by authorize('report.generate'), so this
 * also pins that RBAC boundary. Safety net ahead of decomposing the
 * 2238-LOC reportsController (§7).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

describe('reportsController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('GET /api/reports/case-analytics returns an aggregate payload', async () => {
    const res = await request(app)
      .get('/api/reports/case-analytics')
      .set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body.data).toBe('object');
    expect(res.body.data).not.toBeNull();
  });

  it('GET /api/reports/agent-performance returns an aggregate payload', async () => {
    const res = await request(app)
      .get('/api/reports/agent-performance')
      .set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body.data).toBe('object');
    expect(res.body.data).not.toBeNull();
  });

  it('enforces report.generate (FIELD_AGENT 403, unauthenticated 401)', async () => {
    const forbidden = await request(app)
      .get('/api/reports/case-analytics')
      .set('Authorization', await authHeaderForRole('FIELD_AGENT'));
    expect(forbidden.status).toBe(403);

    const unauth = await request(app).get('/api/reports/case-analytics');
    expect(unauth.status).toBe(401);
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await request(app)
      .get('/api/reports/case-analytics?status=NONSENSE')
      .set('Authorization', adminAuth);
    expect(res.status).toBe(400);
  });
});
