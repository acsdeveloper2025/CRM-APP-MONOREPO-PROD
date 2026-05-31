/**
 * Characterization net for GET /api/cases/:id/summary
 * (casesController.getCaseSummaryWithTasks). Pins the ACTUAL response
 * contract BEFORE that ~245-LOC handler is decomposed in a later slice.
 * Read-only; resolves a real seed case id at runtime.
 *
 * Pinned quirks (characterization = behaviour as-is, not as-designed):
 *  - `data.case` is camelCase-MAPPED, not raw DB columns (caseNumber,
 *    customerName, clientName, productName, createdByName, ...).
 *  - taskSummary reads `cancelledTasks`/`onHoldTasks` from the SQL row,
 *    but the SQL only selects pending/assigned/in_progress/completed/
 *    revoked counts → those two parse to NaN (serialised as null in JSON).
 *    Pinned so a future refactor that "fixes" the mismatch is a conscious,
 *    visible change.
 *  - the `:id/summary` route has NO uuid validator, so a non-uuid id
 *    reaches the query and Postgres throws 22P02 → 500 (NOT 404). The
 *    404 path requires a well-formed-but-absent uuid.
 *  - top-level activity key is `recentActivities` (not `tasks`).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';
import { authHeaderForRole } from '@/test-support/auth';

const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/cases/:id/summary (integration, characterization)', () => {
  let adminAuth: string;
  let seedCaseId: string | null = null;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
    const r = await query<{ id: string }>('SELECT id FROM cases ORDER BY created_at LIMIT 1');
    seedCaseId = r.rows[0]?.id ?? null;
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('returns the camelCase case + taskSummary + financialSummary + recentActivities envelope', async () => {
    expect(seedCaseId, 'seed must contain at least one case').not.toBeNull();
    const res = await request(app)
      .get(`/api/cases/${seedCaseId}/summary`)
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Case summary retrieved successfully');

    const data = res.body.data;
    expect(data).toBeTruthy();

    // case block — the camelCase mapping (NOT raw client_name/product_name)
    const c = data.case;
    expect(c).toBeTruthy();
    for (const k of [
      'id',
      'caseNumber',
      'customerName',
      'clientName',
      'productName',
      'status',
      'priority',
      'createdByName',
    ]) {
      expect(c).toHaveProperty(k);
    }

    // taskSummary — the camelCase status counts the handler emits
    const ts = data.taskSummary;
    expect(ts).toBeTruthy();
    expect(typeof ts.totalTasks).toBe('number');
    for (const k of ['pendingTasks', 'assignedTasks', 'inProgressTasks', 'completedTasks']) {
      expect(typeof ts[k]).toBe('number');
    }
    // Pinned quirk: SQL never selects cancelled/onHold → keys present but NaN→null.
    expect(ts).toHaveProperty('cancelledTasks');
    expect(ts).toHaveProperty('onHoldTasks');
    expect(ts.cancelledTasks).toBeNull();
    expect(ts.onHoldTasks).toBeNull();

    // financialSummary — money rollups + commission, all camelCase numbers
    const fin = data.financialSummary;
    expect(fin).toBeTruthy();
    for (const k of [
      'totalEstimatedAmount',
      'totalActualAmount',
      'completedAmount',
      'pendingAmount',
      'totalCommission',
      'paidCommission',
      'pendingCommission',
    ]) {
      expect(typeof fin[k]).toBe('number');
    }

    expect(Array.isArray(data.recentActivities)).toBe(true);
  });

  it('404s for a well-formed but non-existent case uuid', async () => {
    const res = await request(app)
      .get(`/api/cases/${NONEXISTENT_UUID}/summary`)
      .set('Authorization', adminAuth);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CASE_NOT_FOUND');
  });

  it('500s on a non-uuid id (route has no uuid validator — pinned quirk)', async () => {
    const res = await request(app)
      .get('/api/cases/999999999/summary')
      .set('Authorization', adminAuth);
    expect(res.status).toBe(500);
  });

  it('401s without a token', async () => {
    const res = await request(app).get(`/api/cases/${seedCaseId ?? NONEXISTENT_UUID}/summary`);
    expect(res.status).toBe(401);
  });
});
