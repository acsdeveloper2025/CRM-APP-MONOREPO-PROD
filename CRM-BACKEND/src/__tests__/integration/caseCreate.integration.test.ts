/**
 * Happy-path characterization of POST /api/cases/create — the full
 * case-creation mutation (the §7 god-controller's core write path). Exercises
 * createCase + the verification-task creation + the transactional inserts.
 * Uses the seed's billable config (client=1/product=1/vt=1/rateType=1,
 * pincode=198/area=823 → a real rate of 110). Verifies the case + task rows
 * via DB and cleans them up afterward.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

const customerName = `WP_TEST_${Date.now()}`;
let createdCaseId: string | null = null;

describe('POST /api/cases/create (happy path)', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    if (createdCaseId) {
      await query('DELETE FROM verification_tasks WHERE case_id = $1', [createdCaseId]).catch(() => undefined);
      await query('DELETE FROM cases WHERE id = $1', [createdCaseId]).catch(() => undefined);
    }
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('creates a case with one verification task from a valid billable config', async () => {
    const res = await request(app)
      .post('/api/cases/create')
      .set('Authorization', adminAuth)
      .send({
        caseDetails: {
          customerName,
          customerPhone: '9999999999',
          clientId: 1,
          productId: 1,
          backendContactNumber: '9876543210',
        },
        verificationTasks: [
          {
            verificationTypeId: 1,
            taskTitle: 'Residence Verification',
            rateTypeId: 1,
            pincodeId: 198,
            pincode: '410208',
            areaId: 823,
            address: '12 MG Road, Mumbai',
            trigger: 'Automated write-path test',
            assignedTo: '8415d9ff-9dbd-426e-9519-133a237f5564', // seed FIELD_AGENT
            applicantType: 'APPLICANT',
            priority: 'MEDIUM',
          },
        ],
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body?.success).toBe(true);

    // Verify the case row was actually persisted.
    const cases = await query<{ id: string }>('SELECT id FROM cases WHERE customer_name = $1', [
      customerName,
    ]);
    expect(cases.rows.length).toBe(1);
    createdCaseId = cases.rows[0].id;

    // Verify the verification task was created for that case.
    const tasks = await query<{ verification_type_id: number; status: string }>(
      'SELECT verification_type_id, status FROM verification_tasks WHERE case_id = $1',
      [createdCaseId]
    );
    expect(tasks.rows.length).toBe(1);
    expect(tasks.rows[0].verification_type_id).toBe(1);
    expect(typeof tasks.rows[0].status).toBe('string');
  });
});
