/**
 * Characterization of the case-creation GATE logic — POST /api/cases/config-
 * validation (the real business validation: pincode resolution, area↔pincode
 * mapping, rate-rule + rate-amount lookup) and the create-endpoint validation/
 * RBAC branches. All paths here are READ-ONLY or reject before any INSERT, so
 * they don't pollute acs_db_test. Risk-targeted: this is the financial/scope
 * gate before a case is created.
 *
 * Seed combo: client=1, product=1, verificationType=1, pincode=198, area=823.
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

const VALID = {
  clientId: 1,
  productId: 1,
  verificationTypeId: 1,
  pincodeId: 198,
  areaId: 823,
};

describe('case creation gate', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  describe('POST /api/cases/config-validation', () => {
    it('returns the validation contract for a real client/product/vt/pincode/area combo', async () => {
      const res = await request(app)
        .post('/api/cases/config-validation')
        .set('Authorization', adminAuth)
        .send(VALID);

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      const d = res.body.data;
      expect(typeof d.isValid).toBe('boolean');
      expect(typeof d.rateTypeRuleFound).toBe('boolean');
      expect(typeof d.rateAmountFound).toBe('boolean');
      expect(d.resolved.areaId).toBe(VALID.areaId);
      expect(d.resolved.pincodeId).toBeTruthy();
    });

    it('rejects a non-existent pincode with 400', async () => {
      const res = await request(app)
        .post('/api/cases/config-validation')
        .set('Authorization', adminAuth)
        .send({ ...VALID, pincodeId: 99999999 });
      expect(res.status).toBe(400);
    });

    it('rejects a missing clientId with 400 (body validation)', async () => {
      const { clientId, ...rest } = VALID;
      void clientId;
      const res = await request(app)
        .post('/api/cases/config-validation')
        .set('Authorization', adminAuth)
        .send(rest);
      expect(res.status).toBe(400);
    });

    it('enforces case.create (FIELD_AGENT 403, unauthenticated 401)', async () => {
      const forbidden = await request(app)
        .post('/api/cases/config-validation')
        .set('Authorization', await authHeaderForRole('FIELD_AGENT'))
        .send(VALID);
      expect(forbidden.status).toBe(403);

      const unauth = await request(app).post('/api/cases/config-validation').send(VALID);
      expect(unauth.status).toBe(401);
    });
  });

  describe('POST /api/cases/create', () => {
    it('rejects an empty body with 400 before any insert', async () => {
      const res = await request(app)
        .post('/api/cases/create')
        .set('Authorization', adminAuth)
        .send({});
      expect(res.status).toBe(400);
    });

    it('enforces case.create (unauthenticated 401)', async () => {
      const res = await request(app).post('/api/cases/create').send({});
      expect(res.status).toBe(401);
    });
  });
});
