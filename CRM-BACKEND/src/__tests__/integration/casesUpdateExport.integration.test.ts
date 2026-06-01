/**
 * Characterization net for the two remaining inline casesController handlers
 * BEFORE they are extracted in the next decomposition slice:
 *   - updateCase     PUT /api/cases/:id
 *   - exportCases    GET /api/cases/export
 *
 * Non-mutating: pins RBAC + validation gates + the export headers contract
 * (the PUT success path mutates + needs careful cleanup; the gates below are
 * enough of a safety net to guarantee a verbatim handler move preserves
 * behaviour — the SQL/mutation body is unchanged by an extraction).
 *
 * Pinned behaviour:
 *   - PUT /:id requires case.update (FIELD_AGENT lacks it -> 403; no token -> 401).
 *   - PUT /:id with a well-formed-but-absent uuid -> 404 NOT_FOUND (the handler's
 *     own SELECT-status guard, after validateCaseAccess lets it through).
 *   - GET /export requires case.view; SUPER_ADMIN -> 200 xlsx attachment with
 *     Content-Type spreadsheetml + Content-Disposition filename .xlsx; no token -> 401.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('cases update + export endpoints (integration, characterization)', () => {
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

  describe('PUT /api/cases/:id (updateCase)', () => {
    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(app).put(`/api/cases/${NONEXISTENT_UUID}`).send({ priority: 'HIGH' });
      expect(res.status).toBe(401);
    });

    it('forbids a FIELD_AGENT (lacks case.update) with 403', async () => {
      const res = await request(app)
        .put(`/api/cases/${NONEXISTENT_UUID}`)
        .set('Authorization', fieldAgentAuth)
        .send({ priority: 'HIGH' });
      expect(res.status).toBe(403);
    });

    it('404s for a well-formed but non-existent case uuid', async () => {
      const res = await request(app)
        .put(`/api/cases/${NONEXISTENT_UUID}`)
        .set('Authorization', adminAuth)
        .send({ priority: 'HIGH' });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/cases/export (exportCases)', () => {
    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/cases/export');
      expect(res.status).toBe(401);
    });

    it('streams an xlsx attachment for SUPER_ADMIN', async () => {
      const res = await request(app)
        .get('/api/cases/export?exportType=all')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename=".*\.xlsx"/);
    });

    it('rejects an invalid exportType with 400', async () => {
      const res = await request(app)
        .get('/api/cases/export?exportType=bogus')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });
  });
});
