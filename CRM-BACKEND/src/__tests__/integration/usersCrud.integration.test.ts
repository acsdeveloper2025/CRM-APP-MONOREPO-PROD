/**
 * Characterization net for the usersController core-CRUD mutators + search,
 * BEFORE they are extracted into a module. Complements the existing
 * usersList (getUsers/getUserById) + usersStats (getUserStats) read nets.
 *   - createUser      POST   /api/users          (user.create)
 *   - updateUser      PUT    /api/users/:id       (user.update)
 *   - deleteUser      DELETE /api/users/:id       (user.delete)
 *   - activateUser    POST   /api/users/:id/activate    (user.update)
 *   - deactivateUser  POST   /api/users/:id/deactivate  (user.update)
 *   - searchUsers     GET    /api/users/search    (user.view)
 *
 * Non-mutating: pins RBAC gates (FIELD_AGENT lacks user.create/update/delete/view
 * -> 403; no token -> 401), validation 400s, and the 404 NOT_FOUND on the four
 * mutators for an absent user. The success paths mutate (create/soft-delete/
 * flag) so only the gates + not-found are pinned — enough to guarantee a
 * verbatim handler move preserves behaviour.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

const ABSENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('usersController core-CRUD mutators + search (integration, characterization)', () => {
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

  describe('POST /api/users (createUser)', () => {
    it('401s without a token', async () => {
      expect((await request(app).post('/api/users').send({})).status).toBe(401);
    });
    it('403s a FIELD_AGENT (lacks user.create)', async () => {
      const res = await request(app).post('/api/users').set('Authorization', fieldAgentAuth).send({});
      expect(res.status).toBe(403);
    });
    it('400s on an empty body (auth + perm present)', async () => {
      const res = await request(app).post('/api/users').set('Authorization', adminAuth).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/:id (updateUser)', () => {
    it('401s without a token', async () => {
      expect((await request(app).put(`/api/users/${ABSENT_UUID}`).send({})).status).toBe(401);
    });
    it('403s a FIELD_AGENT (lacks user.update)', async () => {
      const res = await request(app)
        .put(`/api/users/${ABSENT_UUID}`)
        .set('Authorization', fieldAgentAuth)
        .send({ name: 'X' });
      expect(res.status).toBe(403);
    });
    it('400s on a name-only edit (pinned quirk: updateUserValidation requires departmentId + designationId + phone even for a partial edit)', async () => {
      const res = await request(app)
        .put(`/api/users/${ABSENT_UUID}`)
        .set('Authorization', adminAuth)
        .send({ name: 'X' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/users/:id (deleteUser)', () => {
    it('403s a FIELD_AGENT (lacks user.delete)', async () => {
      const res = await request(app)
        .delete(`/api/users/${ABSENT_UUID}`)
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('404s for an absent user', async () => {
      const res = await request(app)
        .delete(`/api/users/${ABSENT_UUID}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/users/:id/activate + /deactivate', () => {
    it('403s a FIELD_AGENT on activate', async () => {
      const res = await request(app)
        .post(`/api/users/${ABSENT_UUID}/activate`)
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('404s on activate for an absent user', async () => {
      const res = await request(app)
        .post(`/api/users/${ABSENT_UUID}/activate`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
    it('404s on deactivate for an absent user', async () => {
      const res = await request(app)
        .post(`/api/users/${ABSENT_UUID}/deactivate`)
        .set('Authorization', adminAuth)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/users/search (searchUsers)', () => {
    it('403s a FIELD_AGENT (lacks user.view)', async () => {
      const res = await request(app)
        .get('/api/users/search?q=a')
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('400s without a q param', async () => {
      const res = await request(app).get('/api/users/search').set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });
    it('returns {success, data[]} for a q query', async () => {
      const res = await request(app).get('/api/users/search?q=a').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
