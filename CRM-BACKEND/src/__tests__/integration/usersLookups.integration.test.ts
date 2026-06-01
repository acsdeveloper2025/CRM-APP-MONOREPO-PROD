/**
 * Characterization net for two small usersController clusters BEFORE they are
 * extracted into modules:
 *   lookups:      getDepartments  GET /api/users/departments       (user.view)
 *                 getDesignations GET /api/users/designations      (user.view)
 *                 getRolePermissions GET /api/users/roles/permissions (role.manage)
 *   field-agents: getAvailableFieldAgents GET /api/users/field-agents/available
 *                 getAssignableUsersByRole GET /api/users/assignable-by-role
 *                 (both authorizeAny user.view|case.create|case.assign|case.reassign)
 *
 * FIELD_AGENT lacks all of user.view / case.create / case.assign / case.reassign /
 * role.manage (verified against seed) -> 403 everywhere. Pins gates + read
 * contracts + the two required-query-param 400s.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

describe('usersController lookups + field-agents clusters (integration, characterization)', () => {
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

  describe('GET /api/users/departments', () => {
    it('401s without a token', async () => {
      expect((await request(app).get('/api/users/departments')).status).toBe(401);
    });
    it('403s a FIELD_AGENT (user.view)', async () => {
      const res = await request(app).get('/api/users/departments').set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('returns {success, data[]} for SUPER_ADMIN', async () => {
      const res = await request(app).get('/api/users/departments').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/users/designations', () => {
    it('403s a FIELD_AGENT', async () => {
      const res = await request(app).get('/api/users/designations').set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('returns {success, data[]} for SUPER_ADMIN', async () => {
      const res = await request(app).get('/api/users/designations').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/users/roles/permissions', () => {
    it('403s a FIELD_AGENT (role.manage)', async () => {
      const res = await request(app)
        .get('/api/users/roles/permissions')
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('returns {success, data} for SUPER_ADMIN', async () => {
      const res = await request(app)
        .get('/api/users/roles/permissions')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/users/field-agents/available', () => {
    it('401s without a token', async () => {
      expect((await request(app).get('/api/users/field-agents/available')).status).toBe(401);
    });
    it('403s a FIELD_AGENT (lacks the authorizeAny set)', async () => {
      const res = await request(app)
        .get('/api/users/field-agents/available?pincodeId=1')
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('400s without pincodeId (auth present)', async () => {
      const res = await request(app)
        .get('/api/users/field-agents/available')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/assignable-by-role', () => {
    it('403s a FIELD_AGENT', async () => {
      const res = await request(app)
        .get('/api/users/assignable-by-role?role=FIELD_AGENT')
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
    it('400s without a role param (auth present)', async () => {
      const res = await request(app)
        .get('/api/users/assignable-by-role')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });
  });
});
