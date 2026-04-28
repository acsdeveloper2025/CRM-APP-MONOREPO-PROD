/**
 * FULL HTTP PIPELINE TRACE — DSA / DST / Connector Verification POSITIVE (Door Open)
 *
 * Real HTTP → preprocess → validate → map → INSERT → attachments → Path-2 remap → render.
 * V1 + V2 mutation with sentinel values covering agent, firm, business type mutations.
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
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjOWE2ODBkOS1jY2E5LTRjZDEtYjUwMC01NGYzMDFjMTFjN2EiLCJpYXQiOjE3NzcyOTM0NDYsImV4cCI6MTc3Nzg5ODI0Nn0.R-5wTT4cKkTN1eaArJX3NNOr_h5VRhivtBxJ0-lmUJ0';

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
      'Idempotency-Key': `dsa-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dsa_connector_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}
async function countRows(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM dsa_connector_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  await pool.query(
    `DELETE FROM dsa_connector_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
  await pool.query(`UPDATE cases SET status='PENDING' WHERE id=$1`, [CASE_ID]);
}
async function resetTaskOnly(): Promise<void> {
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
}

function baseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    officeStatus: 'Open',
    metPerson: `AGENT-${s}-NAME`,
    designation: v1 ? 'Manager' : 'Director',
    businessType: v1 ? 'DSA' : 'DST',
    ownershipType: 'Proprietorship',
    nameOfCompanyOwners: `AGENT-${s}-FIRM`,
    addressStatus: 'Same Address',
    companyNatureOfBusiness: 'Loan Sourcing',
    businessPeriodValue: v1 ? '3' : '7',
    businessPeriodUnit: 'Year',
    officeApproxArea: v1 ? '500' : '900',
    staffStrength: v1 ? '8' : '15',
    staffSeen: v1 ? '5' : '10',
    activeClient: v1 ? 'AGENT-V1-CODE' : 'AGENT-V2-CODE',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: `AGENT-${s}-FIRM-BOARD`,
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Commercial',
    addressStructure: '4',
    addressStructureColor: 'White',
    doorColor: 'Grey',
    landmark1: 'Near Bank',
    landmark2: 'Above ATM',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `AGENT-${s}-OBS`,
    finalStatus: 'Positive',
    verificationOutcome: 'Positive & Door Open',
    outcome: 'Positive & Door Open',
  };
}

function mapDbToFormData(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    officeStatus: r.office_status,
    metPersonName: r.met_person_name,
    designation: r.met_person_designation || r.designation,
    businessType: r.business_type,
    ownershipType: r.ownership_type,
    nameOfCompanyOwners: r.name_of_company_owners,
    businessOwnerName: r.name_of_company_owners,
    addressStatus: r.address_status,
    companyNatureOfBusiness: r.company_nature_of_business,
    businessPeriod: r.business_period,
    officeApproxArea: r.office_area,
    staffStrength: r.staff_strength,
    staffSeen: r.staff_seen,
    activeClient: r.active_client,
    companyNamePlateStatus: r.company_nameplate_status,
    nameOnBoard: r.name_on_board,
    nameOnBoard: r.name_on_board,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcConfirmation1: r.tpc_confirmation1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    tpcConfirmation2: r.tpc_confirmation2,
    locality: r.locality,
    addressStructure: r.address_structure,
    addressStructureColor: r.address_structure_color,
    doorColor: r.door_color,
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
  console.log('║  FULL HTTP TRACE — DSA/DST/Connector POSITIVE (Door Open)           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const checks: Record<string, boolean> = {};
  await resetTask();

  const { rows: preRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const attBefore = preRows[0].n as number;

  // V1
  log('PHASE 1 — Submit V1 via real API');
  const v1FormData = baseline('V1');
  const v1Images = await buildImages(5, 1);
  const v1Res = await postForm(
    {
      formType: 'DSA_CONNECTOR',
      data: {
        outcome: 'Positive & Door Open',
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

  log('PHASE 2 — V1 DB validation (DSA-specific fields)');
  const v1Db: Record<string, boolean> = {
    'form_type=POSITIVE (isolation)': row1.form_type === 'POSITIVE',
    'office_status=Open': row1.office_status === 'Open',
    'business_type=DSA (channel type)': row1.business_type === 'DSA',
    'ownership_type=Proprietorship': row1.ownership_type === 'Proprietorship',
    'name_of_company_owners=AGENT-V1-FIRM': row1.name_of_company_owners === 'AGENT-V1-FIRM',
    'active_client=AGENT-V1-CODE': row1.active_client === 'AGENT-V1-CODE',
    'company_nature_of_business=Loan Sourcing':
      row1.company_nature_of_business === 'Loan Sourcing',
    'business_period composite (3 Year)': row1.business_period === '3 Year',
    'office_area=500 (from officeApproxArea)': Number(row1.office_area) === 500,
    // DSA DB uses `total_staff` (not `staff_strength`); mapping staffStrength→total_staff.
    'total_staff=8 (from staffStrength)': row1.total_staff === 8,
    'name_on_board=AGENT-V1-FIRM-BOARD': row1.name_on_board === 'AGENT-V1-FIRM-BOARD',
    'met_person_name=AGENT-V1-NAME': row1.met_person_name === 'AGENT-V1-NAME',
    'address_rating=Good': row1.address_rating === 'Good',
    'other_observation=AGENT-V1-OBS': row1.other_observation === 'AGENT-V1-OBS',
    'final_status=Positive': row1.final_status === 'Positive',
  };
  Object.assign(checks, v1Db);
  console.log(JSON.stringify(v1Db, null, 2));

  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  checks['V1 images delta=6'] = (postV1Rows[0].n as number) - attBefore === 6;

  // V2
  await resetTaskOnly();
  log('PHASE 3 — Submit V2 with mutated channel type + all sentinels');
  const v2FormData = baseline('V2');
  const v2Images = await buildImages(5, 1);
  const v2Res = await postForm(
    {
      formType: 'DSA_CONNECTOR',
      data: {
        outcome: 'Positive & Door Open',
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
    'V2 business_type=DST (channel type mutated)': row2.business_type === 'DST',
    'V2 name_of_company_owners=AGENT-V2-FIRM':
      row2.name_of_company_owners === 'AGENT-V2-FIRM',
    'V2 active_client=AGENT-V2-CODE': row2.active_client === 'AGENT-V2-CODE',
    'V2 met_person_name=AGENT-V2-NAME': row2.met_person_name === 'AGENT-V2-NAME',
    'V2 designation=Director':
      row2.met_person_designation === 'Director' || row2.designation === 'Director',
    'V2 name_on_board=AGENT-V2-FIRM-BOARD': row2.name_on_board === 'AGENT-V2-FIRM-BOARD',
    'V2 business_period=7 Year': row2.business_period === '7 Year',
    'V2 office_area=900': Number(row2.office_area) === 900,
    'V2 total_staff=15': row2.total_staff === 15,
    'V2 address_rating=Average': row2.address_rating === 'Average',
    'V2 other_observation=AGENT-V2-OBS': row2.other_observation === 'AGENT-V2-OBS',
    'Latest row NOT V1 values': row2.name_of_company_owners !== 'AGENT-V1-FIRM',
  };
  Object.assign(checks, v2Db);
  console.log(JSON.stringify(v2Db, null, 2));

  // Render
  log('PHASE 5 — Render V2 report from latest DB row');
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'DSA_CONNECTOR',
    outcome: 'POSITIVE',
    formData: mapDbToFormData(row2),
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test DSA Office',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  console.log(report);

  const renderChecks: Record<string, boolean> = {
    'V2 other_observation in report': report.includes('AGENT-V2-OBS'),
    'V1 other_observation absent': !report.includes('AGENT-V1-OBS'),
    'V2 name_of_company_owners in report': report.includes('AGENT-V2-FIRM'),
    'V1 name_of_company_owners absent': !report.includes('AGENT-V1-FIRM'),
    'V2 active_client/code in report': report.includes('AGENT-V2-CODE'),
    'V1 active_client/code absent': !report.includes('AGENT-V1-CODE'),
    'V2 business_type=DST in report': report.includes('DST'),
    'V1 business_type=DSA absent':
      !/\bDSA\b/.test(report.replace(/DSA\/Connector/gi, '')), // ignore hardcoded "DSA/Connector"
    'V2 address_rating in report': report.includes('rated as Average'),
    'V1 address_rating absent': !report.includes('rated as Good'),
    'V2 business_period pluralized (7 Years)': /7\s+Years/i.test(report),
    'V1 business_period absent (3 Years)': !/3\s+Years/i.test(report),
    'DSA/Connector-specific phrasing present': /DSA\/Connector/i.test(report),
    'TPC_1_Label with relation': /Mr\. Shah \(Neighbour\)/.test(report),
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
