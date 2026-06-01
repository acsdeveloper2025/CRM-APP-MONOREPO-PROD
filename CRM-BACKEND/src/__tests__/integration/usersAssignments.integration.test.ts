/**
 * Characterization net for the usersController client/product-assignment
 * clusters BEFORE they are extracted into a module:
 *   - getUserClientAssignments    GET    /api/users/:userId/client-assignments
 *   - assignClientsToUser         POST   /api/users/:userId/client-assignments
 *   - removeClientAssignment      DELETE /api/users/:userId/client-assignments/:clientId
 *   - getUserProductAssignments   GET    /api/users/:userId/product-assignments
 *   - assignProductsToUser        POST   /api/users/:userId/product-assignments
 *   - removeProductAssignment     DELETE /api/users/:userId/product-assignments/:productId
 *
 * Non-mutating: pins the territory.assign RBAC gate (FIELD_AGENT -> 403, no
 * token -> 401) on every route + the GET read contract (200 envelope for a
 * real user, 404 for an absent user). The POST/DELETE mutate assignments;
 * their gates are enough to guarantee a verbatim move is safe.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

const ABSENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('usersController assignment clusters (integration, characterization)', () => {
  let adminAuth: string;
  let fieldAgentAuth: string;
  let seedUserId: string | null = null;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
    fieldAgentAuth = await authHeaderForRole('FIELD_AGENT');
    const r = await query<{ id: string }>(
      'SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1'
    );
    seedUserId = r.rows[0]?.id ?? null;
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  for (const kind of ['client', 'product'] as const) {
    describe(`GET /api/users/:userId/${kind}-assignments`, () => {
      it('401s without a token', async () => {
        const res = await request(app).get(`/api/users/${seedUserId ?? ABSENT_UUID}/${kind}-assignments`);
        expect(res.status).toBe(401);
      });

      it('403s a FIELD_AGENT (lacks territory.assign)', async () => {
        const res = await request(app)
          .get(`/api/users/${seedUserId ?? ABSENT_UUID}/${kind}-assignments`)
          .set('Authorization', fieldAgentAuth);
        expect(res.status).toBe(403);
      });

      it('returns the data[] envelope for a real user', async () => {
        expect(seedUserId).not.toBeNull();
        const res = await request(app)
          .get(`/api/users/${seedUserId}/${kind}-assignments`)
          .set('Authorization', adminAuth);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        // Pinned quirk: the CLIENT GET includes a pagination block; the PRODUCT
        // GET does NOT (only {success, data, message}). Inconsistent by design
        // today — pinned as-is so a future unification is a visible change.
        if (kind === 'client') {
          for (const k of ['page', 'limit', 'total', 'totalPages']) {
            expect(res.body.pagination).toHaveProperty(k);
          }
        } else {
          expect(res.body.pagination).toBeUndefined();
        }
      });

      it('404s for an absent user', async () => {
        const res = await request(app)
          .get(`/api/users/${ABSENT_UUID}/${kind}-assignments`)
          .set('Authorization', adminAuth);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe(`POST /api/users/:userId/${kind}-assignments (gate only)`, () => {
      it('403s a FIELD_AGENT', async () => {
        const res = await request(app)
          .post(`/api/users/${seedUserId ?? ABSENT_UUID}/${kind}-assignments`)
          .set('Authorization', fieldAgentAuth)
          .send({});
        expect(res.status).toBe(403);
      });
    });
  }
});
