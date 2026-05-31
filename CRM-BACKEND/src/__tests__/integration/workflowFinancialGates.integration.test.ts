/**
 * Characterization of the RBAC + validation GATES on the high-risk workflow
 * and financial mutation endpoints — task assign/revoke/complete, invoice
 * create, commission rate-type create. Every assertion rejects BEFORE any
 * mutation (401 unauth / 403 wrong-permission / 400 bad-body), so nothing in
 * acs_db_test changes. Pins the permission boundary on the money + workflow
 * surface.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

const TASK = '00000000-0000-0000-0000-000000000000';

describe('workflow + financial endpoint gates', () => {
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

  describe('task assign (case.reassign)', () => {
    const path = `/api/verification-tasks/${TASK}/assign`;
    it('FIELD_AGENT is forbidden', async () => {
      const res = await request(app).post(path).set('Authorization', fieldAuth).send({ assignedTo: TASK });
      expect(res.status).toBe(403);
    });
    it('unauthenticated is rejected', async () => {
      expect((await request(app).post(path).send({})).status).toBe(401);
    });
  });

  describe('task revoke (task.revoke)', () => {
    const path = `/api/verification-tasks/${TASK}/revoke`;
    it('FIELD_AGENT HAS task.revoke → passes authz, hits 404 on the fake task (pinned)', async () => {
      // Finding: FIELD_AGENT is granted task.revoke in this RBAC seed, so it
      // does NOT 403 here — it passes the permission gate and the handler
      // returns 404 for the non-existent task. Pins actual behavior.
      const res = await request(app).post(path).set('Authorization', fieldAuth).send({ reason: 'x' });
      expect(res.status).toBe(404);
    });
    it('unauthenticated is rejected', async () => {
      expect((await request(app).post(path).send({})).status).toBe(401);
    });
  });

  describe('task complete (visit.submit)', () => {
    it('unauthenticated is rejected', async () => {
      expect((await request(app).post(`/api/verification-tasks/${TASK}/complete`).send({})).status).toBe(401);
    });
  });

  describe('invoice create (billing.generate)', () => {
    it('FIELD_AGENT is forbidden', async () => {
      const res = await request(app).post('/api/invoices').set('Authorization', fieldAuth).send({});
      expect(res.status).toBe(403);
    });
    it('unauthenticated is rejected', async () => {
      expect((await request(app).post('/api/invoices').send({})).status).toBe(401);
    });
    it('an empty body is rejected with 400 (validation, pre-insert)', async () => {
      const res = await request(app).post('/api/invoices').set('Authorization', adminAuth).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('commission rate-type create (billing.approve)', () => {
    const path = '/api/commission-management/rate-types';
    it('FIELD_AGENT is forbidden', async () => {
      const res = await request(app).post(path).set('Authorization', fieldAuth).send({});
      expect(res.status).toBe(403);
    });
    it('unauthenticated is rejected', async () => {
      expect((await request(app).post(path).send({})).status).toBe(401);
    });
  });
});
