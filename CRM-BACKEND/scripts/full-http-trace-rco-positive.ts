/**
 * FULL HTTP PIPELINE TRACE — Residence-cum-Office POSITIVE (Door Open)
 *
 * Submits a V1 RCO Positive form via real HTTP, then a V2 mutation, and
 * verifies that both residence-side AND business-side fields propagate
 * correctly through API → preprocess → mapping → DB INSERT → Path-2 remap
 * → template rendering.
 */

import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import sharp from 'sharp';
import { templateReportService } from '../src/services/TemplateReportService';

const API = 'http://localhost:3000';
const TASK_ID = '877da91d-3a95-42cc-90c9-193be02bb4f6';
const CASE_ID = '5f814068-34d8-4679-a7ac-76c872211042';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://acs_user:acs_password@localhost:5432/acs_db',
});

const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjOWE2ODBkOS1jY2E5LTRjZDEtYjUwMC01NGYzMDFjMTFjN2EiLCJpYXQiOjE3NzY2NzEwNTEsImV4cCI6MTc3NzI3NTg1MX0.8XAZGqbGW8bDDaH_LqZOBTiCmTf23jlSACS7JaBecrY';

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'x-app-version': '2.0.0',
  'x-platform': 'ANDROID',
};

const GEO = { latitude: 19.1725, longitude: 72.9567, accuracy: 10 };

async function makeJpeg(seed: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: (seed * 37) % 256, g: (seed * 79) % 256, b: (seed * 113) % 256 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function buildImages(n: number, sel: number): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let seed = Math.floor(Math.random() * 10000);
  for (let i = 0; i < n + sel; i++) {
    const buf = await makeJpeg(++seed);
    out.push({
      dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
      type: i < n ? 'building' : 'selfie',
      geoLocation: GEO,
    });
  }
  return out;
}

async function postForm(payload: Record<string, unknown>, label: string) {
  const res = await fetch(`${API}/api/mobile/verification-tasks/${TASK_ID}/forms`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Idempotency-Key': `rco-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM residence_cum_office_verification_reports
     WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}

async function countRows(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM residence_cum_office_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  await pool.query(
    `DELETE FROM residence_cum_office_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  await pool.query(
    `UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`,
    [TASK_ID],
  );
  await pool.query(`UPDATE cases SET status='PENDING' WHERE id=$1`, [CASE_ID]);
}
async function resetTaskOnly(): Promise<void> {
  await pool.query(
    `UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`,
    [TASK_ID],
  );
}

function baseline(
  suffix: 'V1' | 'V2',
): Record<string, unknown> {
  const v1 = suffix === 'V1';
  return {
    // Common
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    resiCumOfficeStatus: 'Open',
    // Residence-side
    residenceSetup: v1 ? 'SIGHTED' : 'NOT SIGHTED',
    stayingPeriodValue: v1 ? '5' : '10',
    stayingPeriodUnit: 'Year',
    stayingStatus: v1 ? 'On a Self Owned Basis' : 'On a Rented Basis',
    metPerson: `RCO-${suffix}-PERSON`, // The "met person" during visit
    relation: v1 ? 'Self' : 'Brother',
    approxArea: v1 ? '1200' : '1500',
    documentShownStatus: 'Showed',
    documentType: 'Aadhar Card',
    applicantStayingFloor: '3',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: `RCO-${suffix}-DOOR`,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: `RCO-${suffix}-SOCIETY`,
    // Office/Business-side
    businessSetup: v1 ? 'SIGHTED' : 'NOT SIGHTED',
    companyNatureOfBusiness: v1 ? 'RCO-V1-BUSINESS' : 'RCO-V2-BUSINESS',
    businessPeriodValue: v1 ? '3' : '7',
    businessPeriodUnit: 'Year',
    businessStatus: v1 ? 'Self Employee - Proprietorship' : 'Partnership Firm',
    businessLocation: 'At Same Address',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: `RCO-${suffix}-COMPANY`,
    // TPC
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    // Area
    locality: 'Mixed Use Building',
    addressStructure: '12',
    addressStructureColor: 'Cream',
    doorColor: 'Teak',
    landmark1: 'Near Andheri Station',
    landmark2: 'Opposite SBI Bank',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `RCO-${suffix}-OBS`,
    finalStatus: 'Positive',
    // Explicit outcome so form-type detection picks the right mapping.
    verificationOutcome: 'Positive & Door Open',
    outcome: 'Positive & Door Open',
  };
}

function mapDbToFormData(r: Record<string, unknown>): Record<string, unknown> {
  // Aligns with templateReportsController.ts RCO branch (explicit remaps).
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    houseStatus: r.house_status,
    resiCumOfficeStatus: r.office_status || r.house_status, // mirrored
    residenceSetup: r.residence_setup,
    businessSetup: r.business_setup,
    businessStatus: r.business_status,
    // businessLocation is stored in `sitting_location` per mapping (line 125 of
    // residenceCumOfficeFormFieldMapping.ts). Read it back for the template helper.
    businessLocation: r.sitting_location,
    businessOperatingAddress: r.business_operating_address,
    metPersonName: r.met_person_name,
    metPersonRelation: r.met_person_relation,
    stayingPeriod: r.staying_period,
    stayingStatus: r.staying_status,
    approxArea: r.approx_area,
    documentShownStatus: r.document_shown_status,
    documentType: r.document_type,
    companyNatureOfBusiness: r.company_nature_of_business,
    businessPeriod: r.business_period,
    companyNamePlateStatus: r.company_nameplate_status,
    nameOnBoard: r.name_on_board,
    nameOnBoard: r.name_on_board,
    doorNamePlateStatus: r.door_nameplate_status,
    nameOnDoorPlate: r.name_on_door_plate,
    societyNamePlateStatus: r.society_nameplate_status,
    nameOnSocietyBoard: r.name_on_society_board,
    locality: r.locality,
    addressStructure: r.address_structure,
    applicantStayingFloor: r.applicant_staying_floor,
    addressStructureColor: r.address_structure_color,
    doorColor: r.door_color,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcConfirmation1: r.tpc_confirmation1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    tpcConfirmation2: r.tpc_confirmation2,
    landmark1: r.landmark1,
    landmark2: r.landmark2,
    politicalConnection: r.political_connection,
    dominatedArea: r.dominated_area,
    feedbackFromNeighbour: r.feedback_from_neighbour,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
  };
}

function log(title: string, obj?: unknown) {
  console.log(`\n${'─'.repeat(70)}\n  ${title}\n${'─'.repeat(70)}`);
  if (obj !== undefined) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    console.log(s.length > 1500 ? s.slice(0, 1500) + '\n...[truncated]' : s);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL HTTP TRACE — Residence-cum-Office POSITIVE (Door Open)        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const checks: Record<string, boolean> = {};

  await resetTask();
  const { rows: preRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const attBefore = preRows[0].n as number;

  // === V1 ===
  log('PHASE 1 — Submit V1 via real API (5 building + 1 selfie inline base64)');
  const v1FormData = baseline('V1');
  const v1Images = await buildImages(5, 1);
  const v1Payload = {
    formType: 'RESIDENCE_CUM_OFFICE',
    data: {
      outcome: 'Positive & Door Open',
      formData: v1FormData,
      geoLocation: GEO,
      photos: v1Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
      images: v1Images,
    },
  };

  const v1Res = await postForm(v1Payload, 'v1');
  console.log(`  V1 submit → HTTP ${v1Res.status}`);
  if (v1Res.status !== 200 && v1Res.status !== 201) {
    console.log(`  ❌ V1 response:`, JSON.stringify(v1Res.body).slice(0, 600));
    checks['V1 submit HTTP 200'] = false;
    await pool.end();
    process.exit(1);
  }
  checks['V1 submit HTTP 200'] = true;

  const row1 = await readLatest();
  if (!row1) {
    checks['V1 DB row inserted'] = false;
    await pool.end();
    process.exit(1);
  }
  checks['V1 DB row inserted'] = true;

  // === V1 DB checks — residence-side ===
  log('PHASE 2 — V1 DB validation (residence-side fields)');
  const v1DbRes: Record<string, boolean> = {
    'form_type=POSITIVE': row1.form_type === 'POSITIVE',
    'resiCumOfficeStatus → house_status & office_status mirrored (Open)':
      row1.house_status === 'Open' && row1.office_status === 'Open',
    'residence_setup = SIGHTED (V1)': row1.residence_setup === 'SIGHTED',
    'staying_period composite (5 Year)': row1.staying_period === '5 Year',
    'staying_status = On a Self Owned Basis (V1)':
      row1.staying_status === 'On a Self Owned Basis',
    'met_person_name = RCO-V1-PERSON': row1.met_person_name === 'RCO-V1-PERSON',
    'met_person_relation = Self (V1)': row1.met_person_relation === 'Self',
    'approx_area = 1200 (V1)': row1.approx_area === 1200,
    'name_on_door_plate = RCO-V1-DOOR': row1.name_on_door_plate === 'RCO-V1-DOOR',
    'name_on_society_board = RCO-V1-SOCIETY': row1.name_on_society_board === 'RCO-V1-SOCIETY',
    // RCO table stores applicantStayingFloor in `address_floor` column (no dedicated col).
    'applicantStayingFloor → address_floor=3': row1.address_floor === '3',
    'address_rating = Good (V1)': row1.address_rating === 'Good',
  };
  Object.assign(checks, v1DbRes);
  console.log(JSON.stringify(v1DbRes, null, 2));

  log('PHASE 3 — V1 DB validation (office/business-side fields)');
  const v1DbOfc: Record<string, boolean> = {
    'business_setup = SIGHTED (V1)': row1.business_setup === 'SIGHTED',
    'business_status = Self Employee - Proprietorship (V1)':
      row1.business_status === 'Self Employee - Proprietorship',
    'company_nature_of_business = RCO-V1-BUSINESS':
      row1.company_nature_of_business === 'RCO-V1-BUSINESS',
    'business_period composite (3 Year)': row1.business_period === '3 Year',
    'name_on_board = RCO-V1-COMPANY':
      row1.name_on_board === 'RCO-V1-COMPANY',
    'tpc_name1 = Mr. Shah': row1.tpc_name1 === 'Mr. Shah',
    'tpc_met_person1 = Neighbour': row1.tpc_met_person1 === 'Neighbour',
    'other_observation = RCO-V1-OBS': row1.other_observation === 'RCO-V1-OBS',
    'final_status = Positive': row1.final_status === 'Positive',
  };
  Object.assign(checks, v1DbOfc);
  console.log(JSON.stringify(v1DbOfc, null, 2));

  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  checks['V1 images delta=6 (5 building + 1 selfie)'] =
    (postV1Rows[0].n as number) - attBefore === 6;

  // === V2 MUTATION ===
  await resetTaskOnly();
  log('PHASE 4 — Submit V2 with mutated sentinels + 6 new images');
  const v2FormData = baseline('V2');
  const v2Images = await buildImages(5, 1);
  const v2Payload = {
    formType: 'RESIDENCE_CUM_OFFICE',
    data: {
      outcome: 'Positive & Door Open',
      formData: v2FormData,
      geoLocation: GEO,
      photos: v2Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
      images: v2Images,
    },
  };
  const v2Res = await postForm(v2Payload, 'v2');
  console.log(`  V2 submit → HTTP ${v2Res.status}`);
  if (v2Res.status !== 200 && v2Res.status !== 201) {
    console.log(`  ❌ V2 response:`, JSON.stringify(v2Res.body).slice(0, 600));
    checks['V2 submit HTTP 200'] = false;
    await pool.end();
    process.exit(1);
  }
  checks['V2 submit HTTP 200'] = true;
  checks['Total rows = 2 after V2'] = (await countRows()) === 2;

  const row2 = await readLatest();
  if (!row2) {
    checks['V2 latest row present'] = false;
    await pool.end();
    process.exit(1);
  }

  log('PHASE 5 — V2 DB validation (mutation integrity across both sides)');
  const v2DbChecks: Record<string, boolean> = {
    'residence_setup mutated to NOT SIGHTED': row2.residence_setup === 'NOT SIGHTED',
    'business_setup mutated to NOT SIGHTED': row2.business_setup === 'NOT SIGHTED',
    'business_status mutated to Partnership Firm':
      row2.business_status === 'Partnership Firm',
    'company_nature_of_business mutated to RCO-V2-BUSINESS':
      row2.company_nature_of_business === 'RCO-V2-BUSINESS',
    'business_period mutated to 7 Year': row2.business_period === '7 Year',
    'staying_period mutated to 10 Year': row2.staying_period === '10 Year',
    'staying_status mutated to Rented Basis':
      row2.staying_status === 'On a Rented Basis',
    'met_person_name mutated to RCO-V2-PERSON': row2.met_person_name === 'RCO-V2-PERSON',
    'name_on_door_plate mutated to RCO-V2-DOOR':
      row2.name_on_door_plate === 'RCO-V2-DOOR',
    'name_on_board mutated to RCO-V2-COMPANY':
      row2.name_on_board === 'RCO-V2-COMPANY',
    'other_observation mutated to RCO-V2-OBS': row2.other_observation === 'RCO-V2-OBS',
    'address_rating mutated to Average': row2.address_rating === 'Average',
    'Latest row NOT V1 values': row2.other_observation !== 'RCO-V1-OBS',
  };
  Object.assign(checks, v2DbChecks);
  console.log(JSON.stringify(v2DbChecks, null, 2));

  // === RENDER V2 ===
  log('PHASE 6 — Render V2 report from latest DB row');
  const formDataFromDb = mapDbToFormData(row2);
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE_CUM_OFFICE',
    outcome: 'POSITIVE',
    formData: formDataFromDb,
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test RCO Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  console.log(report);

  const renderChecks: Record<string, boolean> = {
    'RESIDENCE VERIFICATION section present': /RESIDENCE VERIFICATION:/i.test(report),
    'BUSINESS VERIFICATION section present': /BUSINESS VERIFICATION:/i.test(report),
    'V2 other_observation in report': report.includes('RCO-V2-OBS'),
    'V1 other_observation absent': !report.includes('RCO-V1-OBS'),
    'V2 company board in report': report.includes('RCO-V2-COMPANY'),
    'V1 company board absent': !report.includes('RCO-V1-COMPANY'),
    'V2 door plate in report': report.includes('RCO-V2-DOOR'),
    'V1 door plate absent': !report.includes('RCO-V1-DOOR'),
    'V2 company_nature_of_business in report': report.includes('RCO-V2-BUSINESS'),
    'V1 company_nature_of_business absent': !report.includes('RCO-V1-BUSINESS'),
    'V2 address_rating in report': report.includes('rated as Average'),
    'V1 address_rating absent': !report.includes('rated as Good'),
    'V2 business_status mentioned': report.includes('Partnership Firm'),
    'V1 business_status absent': !report.includes('Self Employee - Proprietorship'),
    'V2 staying_period pluralized (10 Years)': /10\s+Years/i.test(report),
    'V1 staying_period absent (5 Years)': !/5\s+Years/i.test(report),
    'V2 business_period pluralized (7 Years)': /7\s+Years/i.test(report),
    'V1 business_period absent (3 Years)': !/3\s+Years/i.test(report),
    'residence_setup_text=not sighted': /residence setup was not sighted/i.test(report),
    'business_setup_text=not sighted': /business setup was not sighted/i.test(report),
    'businessLocation helper "at the same address"':
      /at the same address/i.test(report),
  };
  Object.assign(checks, renderChecks);

  log('RENDER CHECK RESULTS', renderChecks);

  // === FINAL ===
  const pass = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  log('FINAL SUMMARY');
  console.log(`  ${pass}/${total} checks passed.`);
  if (pass !== total) {
    console.log('  Failing:');
    for (const [k, v] of Object.entries(checks)) if (!v) console.log(`    ❌ ${k}`);
  }

  await pool.end();
  process.exit(pass === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
