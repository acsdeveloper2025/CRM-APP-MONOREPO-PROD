/**
 * End-to-end validation for Residence UNTRACEABLE outcome (single path).
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
    contactPerson: 'Ramesh (local tea vendor)',
    callRemark: 'Did Not Pick Up Call',
    locality: 'Chawl',
    landmark1: 'Near Mulund Check Naka Bus Depot',
    landmark2: 'Above Croma Showroom',
    landmark3: 'Opposite Municipal Park',
    landmark4: 'Lane behind SBI ATM',
    dominatedArea: 'Not A Community Dominated',
    otherObservation:
      'Address untraceable — repeated searches with landmarks failed; contact person could not guide.',
    finalStatus: 'Negative',
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
    `INSERT INTO residence_verification_reports (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
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
    'residence',
    '4d73e7f1-4443-463b-a4ce-2886cef1e827',
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
       VALUES ($1,$2,'residence',$3,$3,'image/jpeg',$4,$5,$6,$7,$8)`,
      [
        caseId,
        TASK_ID,
        filename,
        fs.statSync(path.join(uploadDir, filename)).size,
        path.join(
          'uploads',
          'verification',
          'residence',
          '4d73e7f1-4443-463b-a4ce-2886cef1e827',
          filename,
        ),
        USER_ID,
        photoType,
        `test-untr-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Residence UNTRACEABLE E2E test ===\n');
  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-untr-%'],
  );
  await pool.query(
    'DELETE FROM residence_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  const id = await insertReport(caseId);
  console.log(`\n✓ Inserted Untraceable record: ${id}`);
  await insertAttachments(caseId);
  console.log('✓ Inserted 6 attachment rows (5 general + 1 selfie)');

  const verify = await pool.query(
    `SELECT form_type, verification_outcome, contact_person, call_remark, locality,
            landmark1, landmark2, landmark3, landmark4, dominated_area, final_status,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1) AS attach_count,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1 AND photo_type='selfie') AS selfie_count
     FROM residence_verification_reports WHERE id=$2`,
    [TASK_ID, id],
  );
  console.log('\nDB verification:');
  console.table(verify.rows);

  const form = sampleFormData();
  const rpt = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE',
    outcome: 'Untraceable',
    formData: form,
    caseDetails: {
      caseId: 'TEST-UNTR',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        '406-B, 4th Floor, Neptune Flying Colors, Din Daayal Upadhyay Road, Near Mulund Check Naka Depot Mulund West, Mumbai - 400080',
    },
  });
  console.log('\n================= UNTRACEABLE REPORT =================\n');
  console.log(rpt.success ? rpt.report : rpt.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
