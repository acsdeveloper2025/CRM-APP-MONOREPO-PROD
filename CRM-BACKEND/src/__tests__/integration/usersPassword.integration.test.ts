/**
 * Characterization net for the usersController password-management cluster
 * BEFORE it is extracted into its own module:
 *   - generateTemporaryPassword  POST /api/users/:id/generate-temp-password
 *   - changePassword             POST /api/users/:id/change-password
 *   - resetPassword              POST /api/users/reset-password
 *
 * Non-mutating: pins RBAC + validation gates only (the success paths mutate
 * password hashes + send email; the gates are enough to guarantee a verbatim
 * handler move preserves behaviour — the mutation bodies are unchanged by an
 * extraction).
 *
 * Pinned behaviour:
 *   - generate-temp-password requires user.update (FIELD_AGENT -> 403; no token -> 401).
 *   - change-password requires only auth (no token -> 401) + validates the new
 *     password strength (weak newPassword -> 400). Cross-user change is blocked by
 *     an in-controller self-check, not a route gate.
 *   - reset-password requires user.update (FIELD_AGENT -> 403; no token -> 401) +
 *     validates body (missing username -> 400).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

const SOME_UUID = '00000000-0000-0000-0000-000000000000';

describe('usersController password cluster (integration, characterization)', () => {
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

  describe('POST /api/users/:id/generate-temp-password', () => {
    it('401s without a token', async () => {
      const res = await request(app).post(`/api/users/${SOME_UUID}/generate-temp-password`);
      expect(res.status).toBe(401);
    });

    it('403s a FIELD_AGENT (lacks user.update)', async () => {
      const res = await request(app)
        .post(`/api/users/${SOME_UUID}/generate-temp-password`)
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/users/:id/change-password', () => {
    it('401s without a token', async () => {
      const res = await request(app)
        .post(`/api/users/${SOME_UUID}/change-password`)
        .send({ currentPassword: 'x', newPassword: 'Abcdef1!' });
      expect(res.status).toBe(401);
    });

    it('400s on a weak new password (auth present)', async () => {
      const res = await request(app)
        .post(`/api/users/${SOME_UUID}/change-password`)
        .set('Authorization', adminAuth)
        .send({ currentPassword: 'whatever', newPassword: 'weak' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/users/reset-password', () => {
    it('401s without a token', async () => {
      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ username: 'someone', newPassword: 'Abcdef1!' });
      expect(res.status).toBe(401);
    });

    it('403s a FIELD_AGENT (lacks user.update)', async () => {
      const res = await request(app)
        .post('/api/users/reset-password')
        .set('Authorization', fieldAgentAuth)
        .send({ username: 'someone', newPassword: 'Abcdef1!' });
      expect(res.status).toBe(403);
    });

    it('400s on a missing username (auth + perm present)', async () => {
      const res = await request(app)
        .post('/api/users/reset-password')
        .set('Authorization', adminAuth)
        .send({ newPassword: 'Abcdef1!' });
      expect(res.status).toBe(400);
    });
  });
});
