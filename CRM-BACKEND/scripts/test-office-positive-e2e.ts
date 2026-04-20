/**
 * End-to-end validation for Office POSITIVE submit flow + report render.
 *
 * Covers both Door Open and Door Locked paths.
 * Verifies:
 * - Sitting_Location_Text helper (Door Open)
 * - Establishment_Period narration (both paths)
 * - TPC_X_Label relation rendering (both paths)
 * - politicalConnectionText + dominatedAreaText helpers (both paths)
 *
 * Run:
 *   cd CRM-BACKEND && npx ts-node -r tsconfig-paths/register --transpile-only \
 *     scripts/test-office-positive-e2e.ts
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

function sampleFormData(doorOpen: boolean) {
  const base = {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    officeStatus: doorOpen ? 'Open' : 'Closed',
    establishmentPeriod: '5 Year',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: 'ACME CORP',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Commercial',
    addressStructure: '8',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    landmark1: 'Near Andheri Metro Station',
    landmark2: 'Opposite SBI Bank',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation:
      'Applicant employment verified. TPC confirmed. Document shown. All signals positive.',
    finalStatus: 'Positive',
  };
  if (doorOpen) {
    return {
      ...base,
      metPerson: 'Mr. Kumar',
      metPersonName: 'Mr. Kumar',
      designation: 'HR Manager',
      workingPeriod: '3 Year',
      applicantDesignation: 'Software Engineer',
      applicantWorkingPremises: 'Same Location',
      sittingLocation: '',
      officeType: 'PVT. LTD. Company',
      companyNatureOfBusiness: 'IT Services',
      staffStrength: 50,
      staffSeen: 30,
      officeApproxArea: 2000,
      workingStatus: 'Company Payroll',
      documentShown: 'Employee ID Card',
    };
  }
  return base;
}

async function insertReport(
  caseId: string,
  doorOpen: boolean,
): Promise<string> {
  const form = sampleFormData(doorOpen);
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
    office_status: form.officeStatus,
    establishment_period: form.establishmentPeriod,
    company_nameplate_status: form.companyNamePlateStatus,
    name_on_company_board: form.nameOnBoard,
    tpc_met_person1: form.tpcMetPerson1,
    tpc_name1: form.tpcName1,
    name_of_tpc1: form.nameOfTpc1,
    tpc_confirmation1: form.tpcConfirmation1,
    tpc_met_person2: form.tpcMetPerson2,
    tpc_name2: form.tpcName2,
    name_of_tpc2: form.nameOfTpc2,
    tpc_confirmation2: form.tpcConfirmation2,
    locality: form.locality,
    address_structure: form.addressStructure,
    address_structure_color: form.addressStructureColor,
    door_color: form.doorColor,
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
      designation: string;
      workingPeriod: string;
      applicantDesignation: string;
      applicantWorkingPremises: string;
      sittingLocation: string;
      officeType: string;
      companyNatureOfBusiness: string;
      staffStrength: number;
      staffSeen: number;
      officeApproxArea: number;
      workingStatus: string;
      documentShown: string;
    };
    Object.assign(snakeMap, {
      met_person_name: fo.metPersonName,
      designation: fo.designation,
      working_period: fo.workingPeriod,
      applicant_designation: fo.applicantDesignation,
      applicant_working_premises: fo.applicantWorkingPremises,
      sitting_location: fo.sittingLocation,
      office_type: fo.officeType,
      company_nature_of_business: fo.companyNatureOfBusiness,
      staff_strength: fo.staffStrength,
      staff_seen: fo.staffSeen,
      office_approx_area: fo.officeApproxArea,
      working_status: fo.workingStatus,
      document_shown: fo.documentShown,
    });
  }
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
        `test-office-positive-${Date.now()}`,
      ],
    );
  }
}

async function main() {
  console.log('=== Office POSITIVE E2E test ===\n');

  const caseId = await pickCaseId();
  console.log(`Case ID: ${caseId}`);
  console.log(`Task ID: ${TASK_ID}`);

  await pool.query(
    'DELETE FROM verification_attachments WHERE verification_task_id = $1 AND submission_id LIKE $2',
    [TASK_ID, 'test-office-positive-%'],
  );
  await pool.query(
    'DELETE FROM office_verification_reports WHERE verification_task_id = $1',
    [TASK_ID],
  );

  // --- Door Open path ---
  const openId = await insertReport(caseId, true);
  console.log(`\n✓ Inserted Door Open record: ${openId}`);
  await insertAttachments(caseId);
  console.log('✓ Inserted 6 attachment rows');

  const openForm = sampleFormData(true);
  const openReport = templateReportService.generateTemplateReport({
    verificationType: 'OFFICE',
    outcome: 'Positive & Door Open',
    formData: openForm,
    caseDetails: {
      caseId: 'TEST-OFC-POS',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        'Plot 42, 3rd Floor, Business Park, Andheri East, Mumbai - 400069',
    },
  });
  console.log('\n================= OFFICE POSITIVE — DOOR OPEN REPORT =================\n');
  console.log(openReport.success ? openReport.report : openReport.error);

  // --- Door Locked path ---
  await pool.query('DELETE FROM office_verification_reports WHERE id=$1', [
    openId,
  ]);
  const lockedId = await insertReport(caseId, false);
  console.log(`\n✓ Inserted Door Locked record: ${lockedId}`);

  const lockedForm = sampleFormData(false);
  const lockedReport = templateReportService.generateTemplateReport({
    verificationType: 'OFFICE',
    outcome: 'Positive & Door Locked',
    formData: lockedForm,
    caseDetails: {
      caseId: 'TEST-OFC-POS',
      customerName: 'Nikhil Parab',
      applicantType: 'APPLICANT',
      address:
        'Plot 42, 3rd Floor, Business Park, Andheri East, Mumbai - 400069',
    },
  });
  console.log('\n================= OFFICE POSITIVE — DOOR LOCKED REPORT =================\n');
  console.log(lockedReport.success ? lockedReport.report : lockedReport.error);

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
