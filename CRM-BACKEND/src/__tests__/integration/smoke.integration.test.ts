/**
 * Proof-of-harness integration test. Exercises the full wiring the BE
 * integration fixture layer provides:
 *   - the real Express app under supertest (no app.listen)
 *   - DATABASE_URL pointed at the isolated acs_db_test database
 *   - a minted access token for a seeded user passing authenticateToken
 *
 * This is intentionally minimal — it proves the loop end-to-end so later
 * controller suites can be written on top. Run: npm run test:integration.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

describe('integration harness smoke', () => {
  beforeAll(async () => {
    // Mirror real startup so cache / rate-limit paths have a live client.
    await connectRedis().catch(() => undefined);
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('GET /health returns 200 (app boots under supertest)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/me with a seeded SUPER_ADMIN token returns the user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', await authHeaderForRole('SUPER_ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.id).toBeTruthy();
  });

  it('GET /api/auth/me without a token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
