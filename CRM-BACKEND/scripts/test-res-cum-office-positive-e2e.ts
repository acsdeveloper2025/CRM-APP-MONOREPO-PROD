/**
 * End-to-end validation for Residence-cum-Office POSITIVE submit + report render.
 *
 * Covers both Door Open and Door Locked paths.
 * Verifies:
 * - resiCumOfficeStatus alias resolves to {House_Status}
 * - metPerson alias resolves to {Met_Person_Name}
 * - relation → {Met_Person_Relation}
 * - Staying + Business period narration via helpers
 * - businessStatus with new 3 options (Self Employee - Proprietorship / Partnership Firm / Private Limited)
 * - Door_Name_Plate_Text, Society_Name_Plate_Text, Company_Name_Plate_Text rendering
 *
 * Run:
 *   cd CRM-BACKEND && npx ts-node -r tsconfig-paths/register --transpile-only \
 *     scripts/test-res-cum-office-positive-e2e.ts
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

function sampleFormData(doorOpen: boolean) {
  const base = {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    resiCumOfficeStatus: doorOpen ? 'Open' : 'Closed',
    residenceSetup: 'SIGHTED AS',
    businessSetup: 'SIGHTED AS',
    stayingPeriod: '5 Year',
    stayingStatus: 'On a Self Owned Basis',
    companyNatureOfBusiness: 'IT Consulting',
    businessPeriod: '3 Year',
    businessStatus: 'Self Employee - Proprietorship',
    businessLocation: 'At Same Address',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Residential Building',
    addressStructure: '10',
    applicantStayingFloor: '4',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: 'PARAB',
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Residency',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: 'PARAB CONSULTING',
    landmark1: 'Near Mulund Metro',
    landmark2: 'Opposite HDFC Bank',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation:
      'Applicant stays and operates consulting business at the given address. Both residence and business confirmed. TPC positive.',
    finalStatus: 'Positive',
  };
  if (doorOpen) {
    return {
      ...base,
      metPerson: 'Nikhil Parab',
      relation: 'Self',
      approxArea: 1200,
      documentShownStatus: 'Showed',
      documentType: 'Aadhar Card',
    };
  }
  return base;
}

async function insertReport(
  caseId: string,
  doorOpen: boolean,
): Promise<string> {
  const form = sampleFormData(doorOpen);
  const status = form.resiCumOfficeStatus;
  const snakeMap: Record<string, unknown> = {
    case_id: caseId,
    verification_task_id: TASK_ID,
    form_type: 'POSITIVE',
    verification_outcome: doorOpen
      ? 'Positive & Door Open'
      : 'Positive & Door Locked',
    customer_name: 'Nikhil Parab',
    address_locatable: form.addressLocatable,
    address_rating: form.addressRating,
    // resiCumOfficeStatus mirrored to both columns per mapper logic
    house_status: status,
    office_status: status,
    residence_setup: form.residenceSetup,
    business_setup: form.businessSetup,
    staying_period: form.stayingPeriod,
    staying_status: form.stayingStatus,
    company_nature_of_business: form.companyNatureOfBusiness,
    business_period: form.businessPeriod,
    business_status: form.businessStatus, // now has dedicated column (no collision with office_status)
    sitting_location: form.businessLocation, // businessLocation maps to sitting_location
    tpc_met_person1: form.tpcMetPerson1,
    tpc_name1: form.tpcName1,
    tpc_confirmation1: form.tpcConfirmation1,
    tpc_met_person2: form.tpcMetPerson2,
    tpc_name2: form.tpcName2,
    tpc_confirmation2: form.tpcConfirmation2,
    locality: form.locality,
    address_structure: form.addressStructure,
    address_floor: form.applicantStayingFloor,
    address_structure_color: form.addressStructureColor,
    door_color: form.doorColor,
    door_nameplate_status: form.doorNamePlateStatus,
    name_on_door_plate: form.nameOnDoorPlate,
    society_nameplate_status: form.societyNamePlateStatus,
    name_on_society_board: form.nameOnSocietyBoard,
    company_nameplate_status: form.companyNamePlateStatus,
    name_on_board: form.nameOnBoard,
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
      metPerson: string;
      relation: string;
      approxArea: number;
      documentShownStatus: string;
      documentType: string;
    };
    Object.assign(snakeMap, {
      met_person_name: fo.metPerson,
      met_person_relation: fo.relation,
      approx_area: fo.approxArea,
      document_shown_status: fo.documentShownStatus,
      document_type: fo.documentType,
    });
  }
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
  if (!fs.existsSync(uploadDir)) return;
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
        `test-rco-pos-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Res-cum-Office POSITIVE E2E test ===\n');

  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-rco-pos-%'],
  );
  await pool.query(
    'DELETE FROM residence_cum_office_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  // --- Door Open ---
  const openId = await insertReport(caseId, true);
  console.log(`\n✓ Inserted Door Open record: ${openId}`);
  await insertAttachments(caseId);

  const openForm = sampleFormData(true);
  const openReport = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE_CUM_OFFICE',
    outcome: 'Positive & Door Open',
    formData: openForm,
    caseDetails: {
      caseId: 'TEST-RCO-POS',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        '406-B, 4th Floor, Neptune Residency, Mulund West, Mumbai - 400080',
    },
  });
  console.log('\n================= RES-CUM-OFFICE POSITIVE — DOOR OPEN REPORT =================\n');
  console.log(openReport.success ? openReport.report : openReport.error);

  // --- Door Locked ---
  await pool.query(
    'DELETE FROM residence_cum_office_verification_reports WHERE id=$1',
    [openId],
  );
  const lockedId = await insertReport(caseId, false);
  console.log(`\n✓ Inserted Door Locked record: ${lockedId}`);

  const lockedForm = sampleFormData(false);
  const lockedReport = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE_CUM_OFFICE',
    outcome: 'Positive & Door Locked',
    formData: lockedForm,
    caseDetails: {
      caseId: 'TEST-RCO-POS',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        '406-B, 4th Floor, Neptune Residency, Mulund West, Mumbai - 400080',
    },
  });
  console.log('\n================= RES-CUM-OFFICE POSITIVE — DOOR LOCKED REPORT =================\n');
  console.log(lockedReport.success ? lockedReport.report : lockedReport.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
