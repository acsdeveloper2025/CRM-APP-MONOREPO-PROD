/**
 * Regression lock for the photo-persist gate on the mobile verification-form
 * submit path (incident 2026-06-01, fix 3fa05402 —
 * project_mobile_form_submit_photo_gate_2026_06_01).
 *
 * The bug: rejectIfPhotosUnderStored counted images resolvable from the submit
 * REQUEST (getReferencedVerificationImages, matches submission_id/filename).
 * The mobile app uploads photos via the separate /attachments endpoint, where
 * rows have submission_id NULL and are referenced by numeric id — so the
 * resolver returned 0 and EVERY field completion was rejected 400
 * PHOTO_PERSIST_INCOMPLETE while photos were in fact stored, leaving tasks
 * stuck IN_PROGRESS. The fix counts photos persisted against the TASK
 * (countTaskAttachments → verification_attachments.verification_task_id).
 *
 * Test 1 (the lock): ≥5 photos stored against the task + attachmentIds that do
 *   NOT resolve (mimics the real mobile payload) → the gate must NOT fire.
 *   This FAILS under the pre-fix gate and PASSES with the stored-count gate.
 * Test 2 (safety net intact): 0 photos stored → the gate must still 400.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { mintAccessToken } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

// Numeric ids that match no real verification_attachments row, so
// getReferencedVerificationImages resolves them to nothing — exactly the
// mobile reality the pre-fix gate mis-handled. Length 5 clears the earlier
// input-count gate (INSUFFICIENT_PHOTOS) so we reach the stored-count gate.
const UNRESOLVABLE_IDS = ['999000001', '999000002', '999000003', '999000004', '999000005'];
const RESIDENCE_URL = (taskId: string) =>
  `/api/mobile/verification-tasks/${taskId}/verification/residence`;

let taskId: string;
let caseId: string;
let owner: string;
let ownerToken: string;

const body = {
  outcome: 'POSITIVE',
  verificationOutcome: 'POSITIVE',
  attachmentIds: UNRESOLVABLE_IDS,
  formData: { finalStatus: 'Positive', houseStatus: 'Open' },
};

const resetTaskInProgress = () =>
  query(
    `UPDATE verification_tasks
        SET status='IN_PROGRESS', started_at=NOW(), completed_at=NULL, verification_outcome=NULL, actual_amount=NULL
      WHERE id=$1`,
    [taskId]
  );

const clearTaskArtifacts = async () => {
  await query(`DELETE FROM commission_calculations WHERE verification_task_id=$1`, [taskId]).catch(
    () => undefined
  );
  await query(`DELETE FROM commission_calculations WHERE task_id=$1`, [taskId]).catch(
    () => undefined
  );
  await query(`DELETE FROM task_form_submissions WHERE verification_task_id=$1`, [taskId]).catch(
    () => undefined
  );
  await query(
    `DELETE FROM form_submissions WHERE verification_task_id=$1 OR (case_id=$2 AND verification_task_id IS NULL)`,
    [taskId, caseId]
  ).catch(() => undefined);
  await query(`DELETE FROM verification_attachments WHERE verification_task_id=$1`, [taskId]).catch(
    () => undefined
  );
};

const seedStoredPhotos = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await query(
      `INSERT INTO verification_attachments
        (verification_task_id, case_id, verification_type, filename, original_name,
         mime_type, file_path, photo_type, uploaded_by, submission_id)
       VALUES ($1, $2, 'RESIDENCE', $3, $3, 'image/jpeg', $4, 'verification', $5, NULL)`,
      [taskId, caseId, `gate_evidence_${i}.jpg`, `/tmp/gate_evidence_${i}.jpg`, owner]
    );
  }
};

describe('mobile verification submit — photo-persist gate counts STORED photos by task', () => {
  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    const { rows } = await query<{
      id: string;
      case_id: string;
      assigned_to: string;
      token_version: number;
    }>(
      `SELECT vt.id, vt.case_id, vt.assigned_to, u.token_version
         FROM verification_tasks vt
         JOIN users u ON u.id = vt.assigned_to
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles_v2 r ON r.id = ur.role_id
        WHERE r.name = 'FIELD_AGENT' AND u.is_active = true AND vt.case_id IS NOT NULL
        LIMIT 1`
    );
    if (rows.length === 0) throw new Error('No field-agent task with a case in seed');
    taskId = rows[0].id;
    caseId = rows[0].case_id;
    owner = rows[0].assigned_to;
    ownerToken = `Bearer ${mintAccessToken({ id: owner, username: 'owner', tokenVersion: rows[0].token_version })}`;
    await clearTaskArtifacts();
    // ASSIGNED -> IN_PROGRESS is a valid transition; do it once. The negative
    // test leaves the task IN_PROGRESS (gate blocks before completion), then the
    // positive test completes it — avoiding a COMPLETED->IN_PROGRESS reset,
    // which the status-transition trigger forbids.
    await resetTaskInProgress();
  });

  afterAll(async () => {
    if (taskId) {
      await clearTaskArtifacts();
      await query(
        `UPDATE verification_tasks SET status='ASSIGNED', started_at=NULL, completed_at=NULL, verification_outcome=NULL, actual_amount=NULL WHERE id=$1`,
        [taskId]
      ).catch(() => undefined);
    }
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  // Runs first: task is IN_PROGRESS with zero stored photos → gate must block.
  it('still rejects with PHOTO_PERSIST_INCOMPLETE when no photos are stored (safety net intact)', async () => {
    await clearTaskArtifacts(); // zero stored photos; task stays IN_PROGRESS

    const res = await request(app)
      .post(RESIDENCE_URL(taskId))
      .set('Authorization', ownerToken)
      .set('x-app-version', '99.0.0')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('PHOTO_PERSIST_INCOMPLETE');
  });

  // Runs second: seed >=5 photos against the still-IN_PROGRESS task → gate
  // passes → completion runs. This is the exact case the regression broke.
  it('does NOT reject with PHOTO_PERSIST_INCOMPLETE when >=5 photos are stored against the task (even if attachmentIds do not resolve)', async () => {
    await clearTaskArtifacts();
    await seedStoredPhotos(5);

    const res = await request(app)
      .post(RESIDENCE_URL(taskId))
      .set('Authorization', ownerToken)
      .set('x-app-version', '99.0.0')
      .send(body);

    // Pre-fix this returned 400 PHOTO_PERSIST_INCOMPLETE despite stored photos.
    expect(res.body?.error?.code).not.toBe('PHOTO_PERSIST_INCOMPLETE');
    // Gate passed → completion ran → task is COMPLETED on the backend.
    const after = await query<{ status: string }>(
      `SELECT status FROM verification_tasks WHERE id=$1`,
      [taskId]
    );
    expect(after.rows[0]?.status).toBe('COMPLETED');
  });
});
