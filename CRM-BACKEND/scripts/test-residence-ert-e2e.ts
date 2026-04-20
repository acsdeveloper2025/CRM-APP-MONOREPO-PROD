/**
 * End-to-end validation for Residence ERT (Entry Restricted) outcome.
 * ERT is a single-path outcome (no Door Open / Door Locked sub-paths).
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
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    nameOfMetPerson: 'Ramesh Kumar',
    metPerson: 'Security',
    metPersonType: 'Security',
    metPersonConfirmation: 'Confirmed',
    applicantStayingStatus: 'Applicant is Staying At',
    locality: 'Resi Building',
    addressStructure: '10',
    applicantStayingFloor: '4',
    addressStructureColor: 'White',
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Flying Colors',
    landmark1: 'Near Mulund Check Naka Bus Depot',
    landmark2: 'Above Croma Showroom',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation:
      'Security restricted entry to the building. Confirmed applicant stays here.',
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
    name_of_met_person: form.nameOfMetPerson,
    met_person_type: form.metPersonType,
    met_person_confirmation: form.metPersonConfirmation,
    applicant_staying_status: form.applicantStayingStatus,
    locality: form.locality,
    address_structure: form.addressStructure,
    applicant_staying_floor: form.applicantStayingFloor,
    address_structure_color: form.addressStructureColor,
    society_nameplate_status: form.societyNamePlateStatus,
    name_on_society_board: form.nameOnSocietyBoard,
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
        `test-ert-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Residence ERT (Entry Restricted) E2E test ===\n');
  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-ert-%'],
  );
  await pool.query(
    'DELETE FROM residence_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  const id = await insertReport(caseId);
  console.log(`\n✓ Inserted ERT record: ${id}`);
  await insertAttachments(caseId);
  console.log('✓ Inserted 6 attachment rows (5 general + 1 selfie)');

  const verify = await pool.query(
    `SELECT form_type, verification_outcome, name_of_met_person, met_person_type,
            met_person_confirmation, applicant_staying_status, final_status,
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
    outcome: 'Entry Restricted',
    formData: form,
    caseDetails: {
      caseId: 'TEST-ERT',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        '406-B, 4th Floor, Neptune Flying Colors, Din Daayal Upadhyay Road, Near Mulund Check Naka Depot Mulund West, Mumbai - 400080',
    },
  });
  console.log('\n================= ERT REPORT =================\n');
  console.log(rpt.success ? rpt.report : rpt.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
