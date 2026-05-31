/**
 * Characterization of clientsController MUTATION paths — createClient +
 * deleteClient — the first real write-path integration test. Exercises the
 * insert (with unique-code dup guard) and delete handlers + settings.manage
 * RBAC. Self-cleaning: uses a unique code per run and removes the row in
 * afterAll so acs_db_test is not polluted.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

// 2-10 char unique code (validation requires 2..10).
const testCode = ('Z' + Date.now().toString(36).toUpperCase()).slice(0, 10);

describe('clientsController write paths', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    // Safety cleanup in case a test left the row behind.
    await query('DELETE FROM clients WHERE code = $1', [testCode]).catch(() => undefined);
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('creates a client, then deletes it (full mutation round-trip)', async () => {
    // CREATE
    const create = await request(app)
      .post('/api/clients')
      .set('Authorization', adminAuth)
      .send({ name: 'WritePath Test Client', code: testCode });
    expect([200, 201]).toContain(create.status);
    expect(create.body?.success).toBe(true);

    // Verify the row was actually inserted.
    const inserted = await query<{ id: number }>('SELECT id FROM clients WHERE code = $1', [testCode]);
    expect(inserted.rows.length).toBe(1);
    const id = inserted.rows[0].id;

    // DELETE (fresh client has no cases → deletes cleanly)
    const del = await request(app).delete(`/api/clients/${id}`).set('Authorization', adminAuth);
    expect(del.status).toBe(200);
    expect(del.body?.success).toBe(true);
  });

  it('rejects a duplicate client code with 400', async () => {
    // Use an existing seed client's code.
    const existing = await query<{ code: string }>('SELECT code FROM clients ORDER BY id LIMIT 1');
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', adminAuth)
      .send({ name: 'Dup', code: existing.rows[0].code });
    expect(res.status).toBe(400);
  });

  it('rejects a too-short code with 400 (validation)', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', adminAuth)
      .send({ name: 'X', code: 'A' });
    expect(res.status).toBe(400);
  });

  it('enforces settings.manage (FIELD_AGENT 403, unauthenticated 401)', async () => {
    const forbidden = await request(app)
      .post('/api/clients')
      .set('Authorization', await authHeaderForRole('FIELD_AGENT'))
      .send({ name: 'Nope', code: 'ZNO1' });
    expect(forbidden.status).toBe(403);

    const unauth = await request(app).post('/api/clients').send({ name: 'Nope', code: 'ZNO2' });
    expect(unauth.status).toBe(401);
  });
});
