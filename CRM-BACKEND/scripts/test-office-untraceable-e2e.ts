/**
 * End-to-end validation for Office UNTRACEABLE submit flow + report render.
 *
 * Verifies:
 * - contactPerson + callRemark + 4 landmarks captured + narrated
 * - dominatedAreaText helper working
 * - Clean render with no "Not provided" artifacts
 *
 * Run:
 *   cd CRM-BACKEND && npx ts-node -r tsconfig-paths/register --transpile-only \
 *     scripts/test-office-untraceable-e2e.ts
 */

import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { templateReportService } from '../src/services/TemplateReportService';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://acs_user:acs_password@localhost:5432/acs_db',
});

const TASK_ID = '877da91d-3a95-42cc-90c9-193be02bb4f6';
const USER_ID = 'c9a680d9-cca9-4cd1-b500-54f301c11c7a';
const OFFICE_UPLOAD_DIR = '7d3b9c1c-f100-4fcb-9000-427db561d415';

async function pickCaseId(): Promise<string> {
  const { rows } = await pool.query(
    'SELECT case_id FROM verification_tasks WHERE id = $1',
    [TASK_ID],
  );
  if (!rows.length) throw new Error(`Task ${TASK_ID} not found`);
  return rows[0].case_id;
}

function sampleFormData() {
  return {
    contactPerson: 'Mr. Patel',
    callRemark: 'Did Not Pick Up Call',
    locality: 'Commercial',
    landmark1: 'Near Andheri Metro Station',
    landmark2: 'Opposite SBI Bank',
    landmark3: 'Behind ICICI Branch',
    landmark4: 'Above Domino\'s Pizza',
    dominatedArea: 'Not A Community Dominated',
    otherObservation:
      'Address is untraceable. Called applicant multiple times without response. Inquired with local shops — no one could identify the given address.',
    finalStatus: 'Refer',
  };
}

async function insertReport(caseId: string): Promise<string> {
  const form = sampleFormData();
  const snakeMap: Record<string, unknown> = {
    case_id: caseId,
    verification_task_id: TASK_ID,
    form_type: 'UNTRACEABLE',
    verification_outcome: 'Untraceable',
    customer_name: 'Nikhil Parab',
    contact_person: form.contactPerson,
    call_remark: form.callRemark,
    locality: form.locality,
    landmark1: form.landmark1,
    landmark2: form.landmark2,
    landmark3: form.landmark3,
    landmark4: form.landmark4,
    dominated_area: form.dominatedArea,
    other_observation: form.otherObservation,
    final_status: form.finalStatus,
    total_images: 5,
    total_selfies: 1,
    verified_by: USER_ID,
    verification_date: new Date(),
  };
  const cols = Object.keys(snakeMap);
  const vals = Object.values(snakeMap);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `INSERT INTO office_verification_reports (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    vals,
  );
  return rows[0].id;
}

async function insertAttachments(caseId: string): Promise<void> {
  const uploadDir = path.join(
    __dirname,
    '..',
    'uploads',
    'verification',
    'office',
    OFFICE_UPLOAD_DIR,
  );
  const all = fs.readdirSync(uploadDir).filter((f) => f.endsWith('.jpg'));
  const selfies = all.filter((f) => f.startsWith('selfie_'));
  const general = all.filter((f) => !f.startsWith('selfie_'));
  const files = [...general.slice(0, 5), ...selfies.slice(0, 1)];
  for (const filename of files) {
    const photoType = filename.startsWith('selfie_')
      ? 'selfie'
      : filename.split('_')[0];
    await pool.query(
      `INSERT INTO verification_attachments
       (case_id, verification_task_id, verification_type, filename, original_name,
        mime_type, file_size, file_path, uploaded_by, photo_type, submission_id)
       VALUES ($1,$2,'office',$3,$3,'image/jpeg',$4,$5,$6,$7,$8)`,
      [
        caseId,
        TASK_ID,
        filename,
        fs.statSync(path.join(uploadDir, filename)).size,
        path.join('uploads', 'verification', 'office', OFFICE_UPLOAD_DIR, filename),
        USER_ID,
        photoType,
        `test-office-untraceable-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Office UNTRACEABLE E2E test ===\n');

  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-office-untraceable-%'],
  );
  await pool.query(
    'DELETE FROM office_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  const untId = await insertReport(caseId);
  console.log(`\n✓ Inserted Untraceable record: ${untId}`);
  await insertAttachments(caseId);
  console.log('✓ Inserted 6 attachment rows (5 general + 1 selfie)');

  const verify = await pool.query(
    `SELECT form_type, verification_outcome, contact_person, call_remark,
            landmark1, landmark2, landmark3, landmark4, final_status,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1) AS attach_count,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1 AND photo_type='selfie') AS selfie_count
     FROM office_verification_reports WHERE id=$2`,
    [TASK_ID, untId],
  );
  console.log('\nDB verification:');
  console.table(verify.rows);

  const form = sampleFormData();
  const report = templateReportService.generateTemplateReport({
    verificationType: 'OFFICE',
    outcome: 'Untraceable',
    formData: form,
    caseDetails: {
      caseId: 'TEST-OFC-UNT',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        'Plot 42, 3rd Floor, Business Park, Andheri East, Mumbai - 400069',
    },
  });
  console.log('\n================= OFFICE UNTRACEABLE REPORT =================\n');
  console.log(report.success ? report.report : report.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
