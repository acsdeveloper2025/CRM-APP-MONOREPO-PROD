/**
 * FULL HTTP PIPELINE TRACE — Property Individual Verification POSITIVE & DOOR LOCKED
 *
 * Real HTTP → preprocess → validate → map → INSERT → attachments → Path-2 remap → render.
 * V1 + V2 mutation with sentinel values covering owner, TPC, locality mutations.
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
      'Idempotency-Key': `propind-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM property_individual_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}
async function countRows(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM property_individual_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  await pool.query(
    `DELETE FROM property_individual_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  // Also clear prior DSA rows to avoid cross-type leftovers distorting isolation checks
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
  await pool.query(`UPDATE cases SET status='PENDING' WHERE id=$1`, [CASE_ID]);
}
async function resetTaskOnly(): Promise<void> {
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
}

function baseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  // Door Locked path: flatStatus='Closed', so metPerson/relationship/propertyOwnerName/approxArea
  // are NOT captured per mobile UI conditional rules.
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    buildingStatus: v1 ? 'Opened' : 'Under Construction',
    flatStatus: 'Closed',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: v1 ? `PROPIND-${s}-TPC1-NAME` : `PROPIND-${s}-TPC1-NAME`,
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: v1 ? `PROPIND-${s}-TPC2-NAME` : `PROPIND-${s}-TPC2-NAME`,
    tpcConfirmation2: 'Confirmed',
    locality: v1 ? 'Residential' : 'Mixed',
    addressStructure: v1 ? '4' : '7',
    addressExistAt: v1 ? '2nd' : '5th',
    addressStructureColor: v1 ? 'White' : 'Cream',
    doorColor: v1 ? 'Brown' : 'Grey',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: `PROPIND-${s}-DOOR-NAME`,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: `PROPIND-${s}-SOCIETY-NAME`,
    landmark1: v1 ? 'Near Temple' : 'Near Park',
    landmark2: v1 ? 'Above Grocery' : 'Above Pharmacy',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `PROPIND-${s}-OBS`,
    finalStatus: 'Positive',
    verificationOutcome: 'Positive & Door Locked',
    outcome: 'Positive & Door Locked',
  };
}

function mapDbToFormData(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    // DB stores buildingStatus as property_status and flatStatus as premises_status per mapping
    buildingStatus: r.property_status,
    flatStatus: r.premises_status,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcConfirmation1: r.tpc_confirmation1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    tpcConfirmation2: r.tpc_confirmation2,
    locality: r.locality,
    addressStructure: r.address_structure,
    addressExistAt: r.address_exist_at,
    addressStructureColor: r.address_structure_color,
    doorColor: r.door_color,
    doorNamePlateStatus: r.door_name_plate,
    nameOnDoorPlate: r.name_on_door_plate,
    societyNamePlateStatus: r.society_name_plate,
    nameOnSocietyBoard: r.name_on_society_board,
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
  console.log('║  FULL HTTP TRACE — Property Individual POSITIVE & DOOR LOCKED       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const checks: Record<string, boolean> = {};
  await resetTask();

  const { rows: preRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const attBefore = preRows[0].n as number;

  // Capture pre-trace counts in OTHER verification tables to verify THIS trace
  // doesn't leak Property Individual data into any other type's table.
  const preIsoRes = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM residence_verification_reports WHERE verification_task_id=$1) r,
      (SELECT COUNT(*)::int FROM office_verification_reports WHERE verification_task_id=$1) o,
      (SELECT COUNT(*)::int FROM business_verification_reports WHERE verification_task_id=$1) b,
      (SELECT COUNT(*)::int FROM builder_verification_reports WHERE verification_task_id=$1) bl,
      (SELECT COUNT(*)::int FROM noc_verification_reports WHERE verification_task_id=$1) n,
      (SELECT COUNT(*)::int FROM dsa_connector_verification_reports WHERE verification_task_id=$1) d`,
    [TASK_ID],
  );
  const preIso = preIsoRes.rows[0];

  // V1
  log('PHASE 1 — Submit V1 via real API');
  const v1FormData = baseline('V1');
  const v1Images = await buildImages(5, 1);
  const v1Res = await postForm(
    {
      formType: 'PROPERTY_INDIVIDUAL',
      data: {
        outcome: 'Positive & Door Locked',
        formData: v1FormData,
        geoLocation: GEO,
        photos: v1Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
        images: v1Images,
      },
    },
    'v1',
  );
  console.log(`  V1 submit → HTTP ${v1Res.status}`);
  if (v1Res.status !== 200 && v1Res.status !== 201) {
    console.log(`  ❌ V1 body:`, JSON.stringify(v1Res.body).slice(0, 600));
    checks['V1 HTTP 200'] = false;
    await pool.end();
    process.exit(1);
  }
  checks['V1 HTTP 200'] = true;

  const row1 = await readLatest();
  if (!row1) {
    checks['V1 DB row'] = false;
    await pool.end();
    process.exit(1);
  }
  checks['V1 DB row'] = true;

  log('PHASE 2 — V1 DB validation (Property Individual-specific fields)');
  const v1Db: Record<string, boolean> = {
    'form_type=POSITIVE (isolation)': row1.form_type === 'POSITIVE',
    'property_status=Opened (buildingStatus→property_status)':
      row1.property_status === 'Opened',
    'premises_status=Closed (flatStatus→premises_status, Door Locked)':
      row1.premises_status === 'Closed',
    'address_rating=Good': row1.address_rating === 'Good',
    'address_exist_at=2nd': row1.address_exist_at === '2nd',
    'address_structure=4': row1.address_structure === '4',
    'address_structure_color=White': row1.address_structure_color === 'White',
    'door_color=Brown': row1.door_color === 'Brown',
    'door_name_plate=SIGHTED AS': row1.door_name_plate === 'SIGHTED AS',
    'name_on_door_plate=PROPIND-V1-DOOR-NAME':
      row1.name_on_door_plate === 'PROPIND-V1-DOOR-NAME',
    'society_name_plate=SIGHTED AS': row1.society_name_plate === 'SIGHTED AS',
    'name_on_society_board=PROPIND-V1-SOCIETY-NAME':
      row1.name_on_society_board === 'PROPIND-V1-SOCIETY-NAME',
    'tpc_met_person1=Neighbour': row1.tpc_met_person1 === 'Neighbour',
    'tpc_name1=PROPIND-V1-TPC1-NAME': row1.tpc_name1 === 'PROPIND-V1-TPC1-NAME',
    'tpc_confirmation1=Confirmed': row1.tpc_confirmation1 === 'Confirmed',
    'tpc_met_person2=Security': row1.tpc_met_person2 === 'Security',
    'tpc_name2=PROPIND-V1-TPC2-NAME': row1.tpc_name2 === 'PROPIND-V1-TPC2-NAME',
    'tpc_confirmation2=Confirmed': row1.tpc_confirmation2 === 'Confirmed',
    'locality=Residential': row1.locality === 'Residential',
    'landmark1=Near Temple': row1.landmark1 === 'Near Temple',
    'landmark2=Above Grocery': row1.landmark2 === 'Above Grocery',
    'political_connection set': !!row1.political_connection,
    'dominated_area set': !!row1.dominated_area,
    'feedback_from_neighbour=Positive': row1.feedback_from_neighbour === 'Positive',
    'other_observation=PROPIND-V1-OBS': row1.other_observation === 'PROPIND-V1-OBS',
    'final_status=Positive': row1.final_status === 'Positive',
    // Door Locked = met_person_* / owner_* / property_area must be null (conditional-on-Open fields)
    'met_person_name NULL (Door Locked path)': row1.met_person_name == null,
    'met_person_relation NULL (Door Locked path)': row1.met_person_relation == null,
    'owner_name NULL (Door Locked path)': row1.owner_name == null,
    'property_area NULL (Door Locked path)': row1.property_area == null,
  };
  Object.assign(checks, v1Db);
  console.log(JSON.stringify(v1Db, null, 2));

  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  checks['V1 images delta=6'] = (postV1Rows[0].n as number) - attBefore === 6;

  // Field isolation — Property Individual data must not appear in other type tables
  const isolation = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM residence_verification_reports WHERE verification_task_id=$1) r,
      (SELECT COUNT(*)::int FROM office_verification_reports WHERE verification_task_id=$1) o,
      (SELECT COUNT(*)::int FROM business_verification_reports WHERE verification_task_id=$1) b,
      (SELECT COUNT(*)::int FROM builder_verification_reports WHERE verification_task_id=$1) bl,
      (SELECT COUNT(*)::int FROM noc_verification_reports WHERE verification_task_id=$1) n,
      (SELECT COUNT(*)::int FROM dsa_connector_verification_reports WHERE verification_task_id=$1) d`,
    [TASK_ID],
  );
  const iso = isolation.rows[0];
  checks['Isolation: residence delta=0'] = iso.r - preIso.r === 0;
  checks['Isolation: office delta=0'] = iso.o - preIso.o === 0;
  checks['Isolation: business delta=0'] = iso.b - preIso.b === 0;
  checks['Isolation: builder delta=0'] = iso.bl - preIso.bl === 0;
  checks['Isolation: NOC delta=0'] = iso.n - preIso.n === 0;
  checks['Isolation: DSA delta=0'] = iso.d - preIso.d === 0;

  // V2
  await resetTaskOnly();
  log('PHASE 3 — Submit V2 with mutated sentinels');
  const v2FormData = baseline('V2');
  const v2Images = await buildImages(5, 1);
  const v2Res = await postForm(
    {
      formType: 'PROPERTY_INDIVIDUAL',
      data: {
        outcome: 'Positive & Door Locked',
        formData: v2FormData,
        geoLocation: GEO,
        photos: v2Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
        images: v2Images,
      },
    },
    'v2',
  );
  console.log(`  V2 submit → HTTP ${v2Res.status}`);
  if (v2Res.status !== 200 && v2Res.status !== 201) {
    console.log(`  ❌ V2 body:`, JSON.stringify(v2Res.body).slice(0, 600));
    checks['V2 HTTP 200'] = false;
    await pool.end();
    process.exit(1);
  }
  checks['V2 HTTP 200'] = true;
  checks['Total rows = 2'] = (await countRows()) === 2;

  const row2 = await readLatest();
  if (!row2) {
    checks['V2 DB row'] = false;
    await pool.end();
    process.exit(1);
  }

  log('PHASE 4 — V2 DB mutation integrity');
  const v2Db: Record<string, boolean> = {
    'V2 property_status=Under Construction (mutated)':
      row2.property_status === 'Under Construction',
    'V2 premises_status=Closed (Door Locked)': row2.premises_status === 'Closed',
    'V2 address_rating=Average': row2.address_rating === 'Average',
    'V2 address_exist_at=5th': row2.address_exist_at === '5th',
    'V2 address_structure=7': row2.address_structure === '7',
    'V2 locality=Mixed': row2.locality === 'Mixed',
    'V2 landmark1=Near Park': row2.landmark1 === 'Near Park',
    'V2 landmark2=Above Pharmacy': row2.landmark2 === 'Above Pharmacy',
    'V2 name_on_door_plate=PROPIND-V2-DOOR-NAME':
      row2.name_on_door_plate === 'PROPIND-V2-DOOR-NAME',
    'V2 name_on_society_board=PROPIND-V2-SOCIETY-NAME':
      row2.name_on_society_board === 'PROPIND-V2-SOCIETY-NAME',
    'V2 tpc_name1=PROPIND-V2-TPC1-NAME': row2.tpc_name1 === 'PROPIND-V2-TPC1-NAME',
    'V2 tpc_name2=PROPIND-V2-TPC2-NAME': row2.tpc_name2 === 'PROPIND-V2-TPC2-NAME',
    'V2 other_observation=PROPIND-V2-OBS': row2.other_observation === 'PROPIND-V2-OBS',
    'Latest row NOT V1 values': row2.other_observation !== 'PROPIND-V1-OBS',
  };
  Object.assign(checks, v2Db);
  console.log(JSON.stringify(v2Db, null, 2));

  // Render
  log('PHASE 5 — Render V2 report from latest DB row');
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'PROPERTY_INDIVIDUAL',
    outcome: 'Positive & Door Locked',
    formData: mapDbToFormData(row2),
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Property Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  console.log(report);

  const renderChecks: Record<string, boolean> = {
    'Template is POSITIVE_DOOR_LOCKED variant': report.includes('POSITIVE & DOOR LOCKED'),
    'V2 other_observation in report': report.includes('PROPIND-V2-OBS'),
    'V1 other_observation absent': !report.includes('PROPIND-V1-OBS'),
    'V2 name_on_door_plate in report': report.includes('PROPIND-V2-DOOR-NAME'),
    'V1 name_on_door_plate absent': !report.includes('PROPIND-V1-DOOR-NAME'),
    'V2 name_on_society_board in report': report.includes('PROPIND-V2-SOCIETY-NAME'),
    'V1 name_on_society_board absent': !report.includes('PROPIND-V1-SOCIETY-NAME'),
    'V2 TPC1 name in report': report.includes('PROPIND-V2-TPC1-NAME'),
    'V1 TPC1 name absent': !report.includes('PROPIND-V1-TPC1-NAME'),
    'V2 TPC2 name in report': report.includes('PROPIND-V2-TPC2-NAME'),
    'V1 TPC2 name absent': !report.includes('PROPIND-V1-TPC2-NAME'),
    'V2 address_rating in report': report.includes('rated as Average'),
    'V1 address_rating absent': !report.includes('rated as Good'),
    'V2 building_status in report': report.includes('Under Construction'),
    'V2 landmark1 in report': report.includes('Near Park'),
    'V2 landmark2 in report': report.includes('Above Pharmacy'),
    'V1 landmark1 absent': !report.includes('Near Temple'),
    'V1 landmark2 absent': !report.includes('Above Grocery'),
    'V2 address_exist_at=5th in report': /5th/.test(report),
    'V2 locality=Mixed in report': report.includes('Mixed'),
    'Door Locked prose: "flat was closed"': /flat was closed/i.test(report),
    'No Door Open prose leakage': !/flat was open/i.test(report),
    'TPC_1_Label with relation': /\(Neighbour\)/.test(report),
    'TPC_2_Label with relation': /\(Security\)/.test(report),
    'Final_Status resolved': report.includes('Positive'),
    'No unresolved {placeholders}': !/\{[A-Z][A-Za-z0-9_]+\}/.test(report),
  };
  Object.assign(checks, renderChecks);
  log('RENDER CHECK RESULTS', renderChecks);

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
