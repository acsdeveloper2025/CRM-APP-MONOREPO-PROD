/**
 * Characterization net for the usersController activities cluster BEFORE it is
 * extracted into a module:
 *   - getUserActivities       GET /api/users/activities        (user.view)
 *   - getUserActivitiesStats  GET /api/users/activities/stats   (user.view)
 *   - exportUserActivities    GET /api/users/activities/export  (user.view)
 *
 * Pins the user.view RBAC gate (FIELD_AGENT -> 403, no token -> 401) + the read
 * contracts: list = {data[], pagination}, stats = the 5-card aggregate, export =
 * xlsx attachment.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

describe('usersController activities cluster (integration, characterization)', () => {
  let adminAuth: string;
  let fieldAgentAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
    fieldAgentAuth = await authHeaderForRole('FIELD_AGENT');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('GET /api/users/activities', () => {
    it('401s without a token', async () => {
      const res = await request(app).get('/api/users/activities');
      expect(res.status).toBe(401);
    });

    it('403s a FIELD_AGENT (lacks user.view)', async () => {
      const res = await request(app)
        .get('/api/users/activities')
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });

    it('returns the data[] + pagination envelope for SUPER_ADMIN', async () => {
      const res = await request(app).get('/api/users/activities').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const k of ['page', 'limit', 'total', 'totalPages']) {
        expect(res.body.pagination).toHaveProperty(k);
      }
    });
  });

  describe('GET /api/users/activities/stats', () => {
    it('403s a FIELD_AGENT', async () => {
      const res = await request(app)
        .get('/api/users/activities/stats')
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });

    it('returns the 5-card aggregate for SUPER_ADMIN', async () => {
      const res = await request(app)
        .get('/api/users/activities/stats')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const k of ['total', 'today', 'last7Days', 'last30Days', 'uniqueUsers']) {
        expect(typeof res.body.data[k]).toBe('number');
      }
    });
  });

  describe('GET /api/users/activities/export', () => {
    it('401s without a token', async () => {
      const res = await request(app).get('/api/users/activities/export');
      expect(res.status).toBe(401);
    });

    it('streams an xlsx attachment for SUPER_ADMIN', async () => {
      const res = await request(app)
        .get('/api/users/activities/export')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });
  });
});
