/**
 * Happy-path characterization of POST /api/verification-tasks/:taskId/complete
 * — the highest-value money-flow write path. completeTask enforces inline
 * evidence (a locations row, >=5 verification_attachments, a
 * task_form_submissions row submitted after the location), flips the task to
 * COMPLETED, and runs the commission finalizer (snapshotFinancials +
 * post-completion hooks) + case-status recompute.
 *
 * This builds the full multi-table evidence fixture, completes as the owning
 * field agent, asserts COMPLETED, and tears the fixture down.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { mintAccessToken } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

let taskId: string;
let caseId: string;
let owner: string;
let ownerToken: string;
let locationId: string | null = null;
let formSubmissionId: string | null = null;

describe('POST /api/verification-tasks/:taskId/complete (happy path)', () => {
  beforeAll(async () => {
    await connectRedis().catch(() => undefined);

    const { rows } = await query<{ id: string; case_id: string; assigned_to: string; token_version: number }>(
      `SELECT vt.id, vt.case_id, vt.assigned_to, u.token_version
         FROM verification_tasks vt
         JOIN users u ON u.id = vt.assigned_to
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles_v2 r ON r.id = ur.role_id
        WHERE r.name = 'FIELD_AGENT' AND u.is_active = true
          AND vt.status = 'ASSIGNED' AND vt.case_id IS NOT NULL
        LIMIT 1`
    );
    if (rows.length === 0) throw new Error('No completable field-agent task in seed');
    taskId = rows[0].id;
    caseId = rows[0].case_id;
    owner = rows[0].assigned_to;
    ownerToken = `Bearer ${mintAccessToken({ id: owner, username: 'owner', tokenVersion: rows[0].token_version })}`;

    // Put the task IN_PROGRESS.
    await query(`UPDATE verification_tasks SET status='IN_PROGRESS', started_at=NOW() WHERE id=$1`, [taskId]);

    // Evidence 1: a location capture (10 min ago, so the form is "after" it).
    const loc = await query<{ id: string }>(
      `INSERT INTO locations (case_id, latitude, longitude, recorded_by, recorded_at)
       VALUES ($1, 19.0760, 72.8777, $2, NOW() - INTERVAL '10 minutes') RETURNING id`,
      [caseId, owner]
    );
    locationId = loc.rows[0].id;

    // Evidence 2: 5 photos.
    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO verification_attachments
          (verification_task_id, case_id, verification_type, filename, original_name, mime_type, file_path, uploaded_by)
         VALUES ($1, $2, 'RESIDENCE', $3, $3, 'image/jpeg', $4, $5)`,
        [taskId, caseId, `evidence_${i}.jpg`, `/tmp/evidence_${i}.jpg`, owner]
      );
    }

    // Evidence 3: a form narrative (parent form_submissions + task_form_submissions).
    const fs = await query<{ id: string }>(
      `INSERT INTO form_submissions (case_id, form_type, submitted_by) VALUES ($1, 'RESIDENCE', $2) RETURNING id`,
      [caseId, owner]
    );
    formSubmissionId = fs.rows[0].id;
    await query(
      `INSERT INTO task_form_submissions (verification_task_id, case_id, form_submission_id, form_type, submitted_by)
       VALUES ($1, $2, $3, 'RESIDENCE', $4)`,
      [taskId, caseId, formSubmissionId, owner]
    );
  });

  afterAll(async () => {
    if (taskId) {
      await query(`UPDATE verification_tasks SET status='ASSIGNED', started_at=NULL, completed_at=NULL, verification_outcome=NULL, actual_amount=NULL WHERE id=$1`, [taskId]).catch(() => undefined);
      await query(`DELETE FROM commission_calculations WHERE verification_task_id=$1`, [taskId]).catch(() => undefined);
      await query(`DELETE FROM commission_calculations WHERE task_id=$1`, [taskId]).catch(() => undefined);
      await query(`DELETE FROM task_form_submissions WHERE verification_task_id=$1`, [taskId]).catch(() => undefined);
      await query(`DELETE FROM verification_attachments WHERE verification_task_id=$1`, [taskId]).catch(() => undefined);
    }
    if (formSubmissionId) await query(`DELETE FROM form_submissions WHERE id=$1`, [formSubmissionId]).catch(() => undefined);
    if (locationId) await query(`DELETE FROM locations WHERE id=$1`, [locationId]).catch(() => undefined);
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('the owning field agent completes the task with full evidence', async () => {
    const res = await request(app)
      .post(`/api/verification-tasks/${taskId}/complete`)
      .set('Authorization', ownerToken)
      .send({ verificationOutcome: 'POSITIVE', actualAmount: 110 });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const after = await query<{ status: string; verification_outcome: string; completed_at: string | null }>(
      'SELECT status, verification_outcome, completed_at FROM verification_tasks WHERE id = $1',
      [taskId]
    );
    expect(after.rows[0].status).toBe('COMPLETED');
    expect(after.rows[0].verification_outcome).toBe('POSITIVE');
    expect(after.rows[0].completed_at).not.toBeNull();
  });
});
