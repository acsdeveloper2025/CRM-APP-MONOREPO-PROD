/**
 * Characterization of master-data + dashboard read endpoints —
 * verification-types, departments (+stats), designations, document-types,
 * and dashboard/kpi. Broad liveness + RBAC coverage across the
 * configuration surface on the integration harness.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

describe('master-data + dashboard read endpoints', () => {
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

  const okList = async (path: string) => {
    const res = await request(app).get(path).set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    return res;
  };

  it('GET /api/verification-types returns a list', () => okList('/api/verification-types'));
  it('GET /api/verification-types/stats returns an aggregate', () =>
    okList('/api/verification-types/stats'));
  it('GET /api/document-types returns a list', () => okList('/api/document-types'));
  it('GET /api/departments returns a list', () => okList('/api/departments'));
  it('GET /api/departments/stats returns an aggregate', () => okList('/api/departments/stats'));
  it('GET /api/designations returns a list', () => okList('/api/designations'));

  it('departments enforce user.view (FIELD_AGENT 403)', async () => {
    const res = await request(app).get('/api/departments').set('Authorization', fieldAuth);
    expect(res.status).toBe(403);
  });

  it('GET /api/dashboard/kpi is allowed for admin and forbidden for FIELD_AGENT', async () => {
    const ok = await request(app).get('/api/dashboard/kpi').set('Authorization', adminAuth);
    expect(ok.status).toBe(200);

    const forbidden = await request(app).get('/api/dashboard/kpi').set('Authorization', fieldAuth);
    expect(forbidden.status).toBe(403);
  });

  it('rejects unauthenticated master-data requests', async () => {
    const res = await request(app).get('/api/verification-types');
    expect(res.status).toBe(401);
  });
});
