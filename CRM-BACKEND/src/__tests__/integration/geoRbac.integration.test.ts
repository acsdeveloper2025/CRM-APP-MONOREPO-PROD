/**
 * Characterization of geographic master-data reads (cities, states,
 * countries, pincodes, areas — auth only) and the RBAC catalog endpoints
 * (roles = role.manage, rbac = permission.manage). Broad liveness + RBAC
 * coverage on the integration harness.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

describe('geographic master-data + RBAC read endpoints', () => {
  let adminAuth: string;
  let fieldAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
    fieldAuth = await authHeaderForRole('FIELD_AGENT');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  for (const path of ['/api/cities', '/api/states', '/api/countries', '/api/pincodes', '/api/areas']) {
    it(`GET ${path} returns a list for an authenticated user`, async () => {
      const res = await request(app).get(path).set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
    });
  }

  it('GET /api/roles enforces role.manage (admin 200, FIELD_AGENT 403)', async () => {
    const ok = await request(app).get('/api/roles').set('Authorization', adminAuth);
    expect(ok.status).toBe(200);
    const forbidden = await request(app).get('/api/roles').set('Authorization', fieldAuth);
    expect(forbidden.status).toBe(403);
  });

  it('GET /api/rbac enforces permission.manage (admin 200, FIELD_AGENT 403)', async () => {
    const ok = await request(app).get('/api/rbac').set('Authorization', adminAuth);
    expect(ok.status).toBe(200);
    const forbidden = await request(app).get('/api/rbac').set('Authorization', fieldAuth);
    expect(forbidden.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/cities');
    expect(res.status).toBe(401);
  });
});
