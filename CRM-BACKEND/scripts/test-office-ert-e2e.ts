/**
 * End-to-end validation for Office ERT (Entry Restricted) submit flow + report render.
 *
 * Verifies:
 * - applicantWorkingStatus captured + stored + narrated via Applicant_Working_Status_Text helper
 * - Met_Person_Type / Name_of_Met_Person / Met_Person_Confirmation resolution
 * - ERT feedback unified to "from the met person"
 *
 * Run:
 *   cd CRM-BACKEND && npx ts-node -r tsconfig-paths/register --transpile-only \
 *     scripts/test-office-ert-e2e.ts
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
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    metPersonType: 'Security',
    nameOfMetPerson: 'Ramesh Kumar',
    metPersonConfirmation: 'Confirmed',
    applicantWorkingStatus: 'Applicant is Working At',
    officeStatus: 'Office Exist At',
    locality: 'Commercial',
    addressStructure: '8',
    officeExistFloor: '3',
    addressStructureColor: 'White',
    landmark1: 'Near Andheri Metro Station',
    landmark2: 'Opposite SBI Bank',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation:
      'Entry restricted by security. Security confirmed applicant works here. Visual verification done at gate only.',
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
    office_status: form.officeStatus,
    locality: form.locality,
    address_structure: form.addressStructure,
    address_floor: form.officeExistFloor,
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
        `test-office-ert-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Office ERT (Entry Restricted) E2E test ===\n');

  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-office-ert-%'],
  );
  await pool.query(
    'DELETE FROM office_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  const ertId = await insertReport(caseId);
  console.log(`\n✓ Inserted ERT record: ${ertId}`);
  await insertAttachments(caseId);
  console.log('✓ Inserted 6 attachment rows (5 general + 1 selfie)');

  const verify = await pool.query(
    `SELECT form_type, verification_outcome, met_person_type, name_of_met_person,
            met_person_confirmation, applicant_working_status, office_status, final_status,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1) AS attach_count,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1 AND photo_type='selfie') AS selfie_count
     FROM office_verification_reports WHERE id=$2`,
    [TASK_ID, ertId],
  );
  console.log('\nDB verification:');
  console.table(verify.rows);

  const form = sampleFormData();
  const report = templateReportService.generateTemplateReport({
    verificationType: 'OFFICE',
    outcome: 'Entry Restricted',
    formData: form,
    caseDetails: {
      caseId: 'TEST-OFC-ERT',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        'Plot 42, 3rd Floor, Business Park, Andheri East, Mumbai - 400069',
    },
  });
  console.log('\n================= OFFICE ERT REPORT =================\n');
  console.log(report.success ? report.report : report.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
