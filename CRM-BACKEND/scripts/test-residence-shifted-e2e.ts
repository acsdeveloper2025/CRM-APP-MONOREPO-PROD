/**
 * End-to-end validation for Residence SHIFTED submit flow + report render.
 *
 * Mirrors test-residence-positive-e2e.ts but for SHIFTED outcome.
 * Covers both Door Open (met person informs shift) and Door Locked
 * (TPC reveals shift, premises status captured).
 *
 * Run:
 *   cd CRM-BACKEND && npx ts-node -r tsconfig-paths/register --transpile-only \
 *     scripts/test-residence-shifted-e2e.ts
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

function sampleFormData(doorOpen: boolean) {
  const base = {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    houseStatus: doorOpen ? 'Open' : 'Closed',
    shiftedPeriod: '8 Month',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Resi Building',
    addressStructure: '10',
    addressFloor: '4',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: 'SHARMA (new tenant)',
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Flying Colors',
    landmark1: 'Near Mulund Check Naka Bus Depot',
    landmark2: 'Above Croma Showroom',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation:
      'Applicant has shifted from given address. TPC confirms shift.',
    finalStatus: 'Refer',
  };
  if (doorOpen) {
    return {
      ...base,
      metPersonName: 'Mr. Sharma',
      metPersonStatus: 'Current Tenant',
    };
  }
  return {
    ...base,
    premisesStatus: 'Rented',
  };
}

async function insertReport(
  caseId: string,
  doorOpen: boolean,
): Promise<string> {
  const form = sampleFormData(doorOpen);
  const snakeMap: Record<string, unknown> = {
    case_id: caseId,
    verification_task_id: TASK_ID,
    form_type: 'SHIFTED',
    verification_outcome: doorOpen
      ? 'Shifted & Door Open'
      : 'Shifted & Door Locked',
    customer_name: 'Nikhil Parab',
    address_locatable: form.addressLocatable,
    address_rating: form.addressRating,
    house_status: form.houseStatus,
    shifted_period: form.shiftedPeriod,
    tpc_met_person1: form.tpcMetPerson1,
    tpc_name1: form.tpcName1,
    tpc_confirmation1: form.tpcConfirmation1,
    tpc_met_person2: form.tpcMetPerson2,
    tpc_name2: form.tpcName2,
    tpc_confirmation2: form.tpcConfirmation2,
    locality: form.locality,
    address_structure: form.addressStructure,
    address_floor: form.addressFloor,
    address_structure_color: form.addressStructureColor,
    door_color: form.doorColor,
    door_nameplate_status: form.doorNamePlateStatus,
    name_on_door_plate: form.nameOnDoorPlate,
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
  if (doorOpen) {
    const fo = form as typeof form & {
      metPersonName: string;
      metPersonStatus: string;
    };
    Object.assign(snakeMap, {
      met_person_name: fo.metPersonName,
      met_person_status: fo.metPersonStatus,
    });
  } else {
    const fc = form as typeof form & { premisesStatus: string };
    snakeMap.premises_status = fc.premisesStatus;
  }
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
        path.join('uploads', 'verification', 'residence', '4d73e7f1-4443-463b-a4ce-2886cef1e827', filename),
        USER_ID,
        photoType,
        `test-shifted-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Residence SHIFTED E2E test ===\n');

  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-shifted-%'],
  );
  await pool.query(
    'DELETE FROM residence_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  // --- Door Open path ---
  const openId = await insertReport(caseId, true);
  console.log(`\n✓ Inserted Door Open record: ${openId}`);
  await insertAttachments(caseId);
  console.log('✓ Inserted 6 attachment rows (5 general + 1 selfie)');

  const verify = await pool.query(
    `SELECT form_type, verification_outcome, house_status, met_person_name, met_person_status,
            shifted_period, final_status,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1) AS attach_count,
            (SELECT COUNT(*) FROM verification_attachments WHERE verification_task_id=$1 AND photo_type='selfie') AS selfie_count
     FROM residence_verification_reports WHERE id=$2`,
    [TASK_ID, openId],
  );
  console.log('\nDB verification (Door Open):');
  console.table(verify.rows);

  const openForm = sampleFormData(true);
  const openReport = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE',
    outcome: 'Shifted & Door Open',
    formData: openForm,
    caseDetails: {
      caseId: 'TEST-002',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        '406-B, 4th Floor, Neptune Flying Colors, Din Daayal Upadhyay Road, Near Mulund Check Naka Depot Mulund West, Mumbai - 400080',
    },
  });
  console.log('\n================= SHIFTED — DOOR OPEN REPORT =================\n');
  console.log(openReport.success ? openReport.report : openReport.error);

  // --- Door Locked path ---
  await pool.query('DELETE FROM residence_verification_reports WHERE id=$1', [
    openId,
  ]);
  const lockedId = await insertReport(caseId, false);
  console.log(`\n✓ Inserted Door Locked record: ${lockedId}`);

  const verify2 = await pool.query(
    `SELECT form_type, verification_outcome, house_status, premises_status,
            shifted_period, met_person_name, final_status
       FROM residence_verification_reports WHERE id=$1`,
    [lockedId],
  );
  console.log('\nDB verification (Door Locked):');
  console.table(verify2.rows);

  const lockedForm = sampleFormData(false);
  const lockedReport = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE',
    outcome: 'Shifted & Door Locked',
    formData: lockedForm,
    caseDetails: {
      caseId: 'TEST-002',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        '406-B, 4th Floor, Neptune Flying Colors, Din Daayal Upadhyay Road, Near Mulund Check Naka Depot Mulund West, Mumbai - 400080',
    },
  });
  console.log('\n================= SHIFTED — DOOR LOCKED REPORT =================\n');
  console.log(lockedReport.success ? lockedReport.report : lockedReport.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
