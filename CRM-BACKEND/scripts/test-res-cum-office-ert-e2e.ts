/**
 * End-to-end validation for Residence-cum-Office ERT submit + report render.
 *
 * Verifies the dual narration:
 * - {Applicant_Staying_Status_Text} → "the applicant is staying at the given address"
 * - {Applicant_Working_Status_Text} → "the applicant is working at the given address"
 * - Combined: "The met person also informed that X and Y"
 *
 * Run:
 *   cd CRM-BACKEND && npx ts-node -r tsconfig-paths/register --transpile-only \
 *     scripts/test-res-cum-office-ert-e2e.ts
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
const UPLOAD_DIR = '7f16eda9-07d8-4d42-8f87-d0b5a65be35c';

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
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    metPersonType: 'Security',
    nameOfMetPerson: 'Ramesh Kumar',
    metPersonConfirmation: 'Confirmed',
    applicantWorkingStatus: 'Applicant is Working At',
    applicantStayingStatus: 'Applicant is Staying At',
    businessStatus: 'Office Exist At',
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Residency',
    locality: 'Residential Building',
    addressStructure: '10',
    addressStructureColor: 'White',
    landmark1: 'Near Mulund Metro',
    landmark2: 'Opposite HDFC Bank',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation:
      'Entry restricted by security. Applicant stays and operates business here. Verified via security confirmation.',
    finalStatus: 'Refer',
  };
}

async function insertReport(caseId: string): Promise<string> {
  const form = sampleFormData();
  const snakeMap: Record<string, unknown> = {
    case_id: caseId,
    verification_task_id: TASK_ID,
    form_type: 'ENTRY_RESTRICTED',
    verification_outcome: 'Entry Restricted',
    customer_name: 'Nikhil Parab',
    address_locatable: form.addressLocatable,
    address_rating: form.addressRating,
    met_person_type: form.metPersonType,
    name_of_met_person: form.nameOfMetPerson,
    met_person_confirmation: form.metPersonConfirmation,
    applicant_working_status: form.applicantWorkingStatus,
    applicant_staying_status: form.applicantStayingStatus,
    office_status: form.businessStatus,
    society_nameplate_status: form.societyNamePlateStatus,
    name_on_society_board: form.nameOnSocietyBoard,
    locality: form.locality,
    address_structure: form.addressStructure,
    address_structure_color: form.addressStructureColor,
    landmark1: form.landmark1,
    landmark2: form.landmark2,
    political_connection: form.politicalConnection,
    dominated_area: form.dominatedArea,
    feedback_from_neighbour: form.feedbackFromNeighbour,
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
    `INSERT INTO residence_cum_office_verification_reports (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
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
    'residence_cum_office',
    UPLOAD_DIR,
  );
  if (!fs.existsSync(uploadDir)) {
    console.log(`⚠️ upload dir ${uploadDir} not found — skipping attachments`);
    return;
  }
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
       VALUES ($1,$2,'residence_cum_office',$3,$3,'image/jpeg',$4,$5,$6,$7,$8)`,
      [
        caseId,
        TASK_ID,
        filename,
        fs.statSync(path.join(uploadDir, filename)).size,
        path.join('uploads', 'verification', 'residence_cum_office', UPLOAD_DIR, filename),
        USER_ID,
        photoType,
        `test-rco-ert-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Residence-cum-Office ERT E2E test ===\n');

  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-rco-ert-%'],
  );
  await pool.query(
    'DELETE FROM residence_cum_office_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  const ertId = await insertReport(caseId);
  console.log(`\n✓ Inserted ERT record: ${ertId}`);
  await insertAttachments(caseId);

  const verify = await pool.query(
    `SELECT form_type, verification_outcome, met_person_type, name_of_met_person,
            applicant_working_status, applicant_staying_status, final_status
     FROM residence_cum_office_verification_reports WHERE id=$1`,
    [ertId],
  );
  console.log('\nDB verification:');
  console.table(verify.rows);

  const form = sampleFormData();
  const report = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE_CUM_OFFICE',
    outcome: 'Entry Restricted',
    formData: form,
    caseDetails: {
      caseId: 'TEST-RCO-ERT',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        '406-B, 4th Floor, Neptune Residency, Mulund West, Mumbai - 400080',
    },
  });
  console.log('\n================= RES-CUM-OFFICE ERT REPORT =================\n');
  console.log(report.success ? report.report : report.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
