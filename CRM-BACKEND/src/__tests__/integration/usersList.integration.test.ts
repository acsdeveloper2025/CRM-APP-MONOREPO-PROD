/**
 * Characterization of usersController's core read surface — GET /api/users
 * (list: pagination + statistics envelope) and GET /api/users/:id — on the
 * integration harness. Pins the response contract, pagination invariants,
 * the deterministic seed count, RBAC, and the 404 path BEFORE any
 * decomposition of the 3673-LOC usersController (DEFERRED_ITEMS §7).
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

describe('usersController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('GET /api/users', () => {
    it('returns the list envelope (data + pagination + statistics) for an authorized user', async () => {
      const res = await request(app).get('/api/users').set('Authorization', adminAuth);

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const { pagination, statistics } = res.body;
      for (const k of ['page', 'limit', 'total', 'totalPages']) {
        expect(typeof pagination[k]).toBe('number');
      }
      for (const k of ['total', 'active', 'inactive']) {
        expect(typeof statistics[k]).toBe('number');
      }

      // Invariants guaranteed by the controller.
      expect(pagination.totalPages).toBe(Math.ceil(pagination.total / pagination.limit));
      expect(statistics.total).toBe(pagination.total);
      expect(statistics.total).toBe(statistics.active + statistics.inactive);
      expect(res.body.data.length).toBeLessThanOrEqual(pagination.limit);
    });

    it('honours the limit query param and never returns more rows than the page size', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=2')
        .set('Authorization', adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('total matches the live non-deleted user count in the seed DB', async () => {
      const { rows } = await query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM users WHERE deleted_at IS NULL'
      );
      const res = await request(app).get('/api/users').set('Authorization', adminAuth);
      expect(res.body.pagination.total).toBe(Number(rows[0].count));
    });

    it('rejects an invalid limit (>500) with 400', async () => {
      const res = await request(app)
        .get('/api/users?limit=9999')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });

    it('enforces user.view (FIELD_AGENT 403, unauthenticated 401)', async () => {
      const forbidden = await request(app)
        .get('/api/users')
        .set('Authorization', await authHeaderForRole('FIELD_AGENT'));
      expect(forbidden.status).toBe(403);

      const unauth = await request(app).get('/api/users');
      expect(unauth.status).toBe(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns the requested user', async () => {
      const { rows } = await query<{ id: string }>(
        'SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1'
      );
      const id = rows[0].id;

      const res = await request(app).get(`/api/users/${id}`).set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.data?.id).toBe(id);
    });

    it('returns 404 for a non-existent user id', async () => {
      const res = await request(app)
        .get(`/api/users/${NONEXISTENT_UUID}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
    });
  });
});
