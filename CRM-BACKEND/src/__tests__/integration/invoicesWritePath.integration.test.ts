/**
 * Characterization of the invoicesController WRITE surface (gates only, no
 * mutation) — PUT /:id (update), DELETE /:id, POST /:id/regenerate,
 * POST /:id/cancel. All gated by billing.generate (FIELD_AGENT lacks it).
 * Seed has 0 invoices, so a well-formed-but-absent id reaches the handler's
 * ensureInvoiceAccessible guard → 404 NOT_FOUND with no mutation. The happy
 * create path is covered by invoiceCreate.integration. Safety net ahead of
 * extracting the write handlers to invoices/write.ts (§7, money-critical).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

const ABSENT_ID = '999999999';

describe('invoicesController write endpoints (gates, non-mutating)', () => {
  let adminAuth: string;
  let agentAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
    agentAuth = await authHeaderForRole('FIELD_AGENT');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('PUT /api/invoices/:id (updateInvoice)', () => {
    it('401 unauthenticated', async () => {
      const res = await request(app).put(`/api/invoices/${ABSENT_ID}`).send({});
      expect(res.status).toBe(401);
    });
    it('403 for FIELD_AGENT (billing.generate)', async () => {
      const res = await request(app)
        .put(`/api/invoices/${ABSENT_ID}`)
        .set('Authorization', agentAuth)
        .send({});
      expect(res.status).toBe(403);
    });
    it('404 NOT_FOUND for an absent invoice (empty body passes all-optional validation)', async () => {
      const res = await request(app)
        .put(`/api/invoices/${ABSENT_ID}`)
        .set('Authorization', adminAuth)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/invoices/:id (deleteInvoice)', () => {
    it('401 unauthenticated', async () => {
      const res = await request(app).delete(`/api/invoices/${ABSENT_ID}`);
      expect(res.status).toBe(401);
    });
    it('403 for FIELD_AGENT (billing.generate)', async () => {
      const res = await request(app)
        .delete(`/api/invoices/${ABSENT_ID}`)
        .set('Authorization', agentAuth);
      expect(res.status).toBe(403);
    });
    it('404 NOT_FOUND for an absent invoice', async () => {
      const res = await request(app)
        .delete(`/api/invoices/${ABSENT_ID}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/invoices/:id/regenerate (regenerateInvoice)', () => {
    it('401 unauthenticated', async () => {
      const res = await request(app).post(`/api/invoices/${ABSENT_ID}/regenerate`);
      expect(res.status).toBe(401);
    });
    it('403 for FIELD_AGENT (billing.generate)', async () => {
      const res = await request(app)
        .post(`/api/invoices/${ABSENT_ID}/regenerate`)
        .set('Authorization', agentAuth);
      expect(res.status).toBe(403);
    });
    it('404 NOT_FOUND for an absent invoice', async () => {
      const res = await request(app)
        .post(`/api/invoices/${ABSENT_ID}/regenerate`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/invoices/:id/cancel (cancelInvoice -> transitionInvoiceStatus)', () => {
    it('401 unauthenticated', async () => {
      const res = await request(app).post(`/api/invoices/${ABSENT_ID}/cancel`).send({});
      expect(res.status).toBe(401);
    });
    it('403 for FIELD_AGENT (billing.generate)', async () => {
      const res = await request(app)
        .post(`/api/invoices/${ABSENT_ID}/cancel`)
        .set('Authorization', agentAuth)
        .send({});
      expect(res.status).toBe(403);
    });
    it('404 NOT_FOUND for an absent invoice', async () => {
      const res = await request(app)
        .post(`/api/invoices/${ABSENT_ID}/cancel`)
        .set('Authorization', adminAuth)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });
  });
});
