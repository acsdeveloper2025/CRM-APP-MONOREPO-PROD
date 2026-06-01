/**
 * Characterization net for the usersController import/export cluster BEFORE it
 * is extracted into a module:
 *   - exportUsers          GET  /api/users/export          (user.view)
 *   - downloadUserTemplate GET  /api/users/import-template (user.view)
 *   - bulkImportUsers      POST /api/users/import          (user.create + multer)
 *
 * Non-mutating: pins RBAC gates (FIELD_AGENT lacks user.view AND user.create ->
 * 403; no token -> 401) + the xlsx-attachment contract for the two GET
 * downloads. bulkImportUsers mutates (creates users) so only its gate is pinned.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

describe('usersController import/export cluster (integration, characterization)', () => {
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

  describe('GET /api/users/export', () => {
    it('401s without a token', async () => {
      const res = await request(app).get('/api/users/export');
      expect(res.status).toBe(401);
    });

    it('403s a FIELD_AGENT (lacks user.view)', async () => {
      const res = await request(app).get('/api/users/export').set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });

    it('streams an xlsx attachment for SUPER_ADMIN', async () => {
      const res = await request(app).get('/api/users/export').set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename=.*\.xlsx/);
    });
  });

  describe('GET /api/users/import-template', () => {
    it('401s without a token', async () => {
      const res = await request(app).get('/api/users/import-template');
      expect(res.status).toBe(401);
    });

    it('403s a FIELD_AGENT (lacks user.view)', async () => {
      const res = await request(app)
        .get('/api/users/import-template')
        .set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });

    it('streams the import-template xlsx for SUPER_ADMIN', async () => {
      const res = await request(app)
        .get('/api/users/import-template')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toMatch(/User_Import_Template\.xlsx/);
    });
  });

  describe('POST /api/users/import (gate only)', () => {
    it('401s without a token', async () => {
      const res = await request(app).post('/api/users/import');
      expect(res.status).toBe(401);
    });

    it('403s a FIELD_AGENT (lacks user.create)', async () => {
      const res = await request(app).post('/api/users/import').set('Authorization', fieldAgentAuth);
      expect(res.status).toBe(403);
    });
  });
});
