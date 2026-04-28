/**
 * FULL HTTP PIPELINE TRACE — Business Verification POSITIVE (Door Open)
 *
 * End-to-end: real HTTP POST → preprocess → validate → map → INSERT →
 * attachment rows → Path-2 remap → render. V1 + V2 mutation.
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
      'Idempotency-Key': `biz-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM business_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}

async function countRows(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM business_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  await pool.query(
    `DELETE FROM business_verification_reports WHERE verification_task_id=$1`,
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

function baseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    officeStatus: 'Open', // mobile uses officeStatus for Business; maps to business_status
    metPerson: `BIZ-${s}-PERSON`,
    designation: v1 ? 'Manager' : 'Director',
    businessType: v1 ? 'Retail' : 'Wholesale',
    nameOfCompanyOwners: v1 ? 'BIZ-V1-OWNER' : 'BIZ-V2-OWNER',
    ownershipType: 'Proprietorship',
    addressStatus: 'Same Address',
    companyNatureOfBusiness: v1 ? 'BIZ-V1-ACTIVITY' : 'BIZ-V2-ACTIVITY',
    businessPeriodValue: v1 ? '5' : '9',
    businessPeriodUnit: 'Year',
    officeApproxArea: v1 ? '800' : '1200',
    staffStrength: v1 ? '10' : '25',
    staffSeen: v1 ? '8' : '20',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: v1 ? 'BIZ-V1-NAME' : 'BIZ-V2-NAME',
    documentShown: 'GST Certificate',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Commercial',
    addressStructure: '6',
    addressStructureColor: 'White',
    doorColor: 'Grey',
    landmark1: 'Near Market',
    landmark2: 'Above Cafe',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `BIZ-${s}-OBS`,
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
    businessStatus: r.business_status,
    officeStatus: r.business_status, // alias back
    metPersonName: r.met_person_name,
    designation: r.designation,
    businessType: r.business_type,
    nameOfCompanyOwners: r.name_of_company_owners,
    businessOwnerName: r.name_of_company_owners, // alias for template token
    ownershipType: r.ownership_type,
    addressStatus: r.address_status,
    companyNatureOfBusiness: r.company_nature_of_business,
    businessPeriod: r.business_period,
    businessApproxArea: r.business_approx_area,
    staffStrength: r.staff_strength,
    staffSeen: r.staff_seen,
    companyNamePlateStatus: r.company_nameplate_status,
    nameOnBoard: r.name_on_board,
    nameOnBoard: r.name_on_board,
    documentShown: r.document_shown,
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
  console.log('║  FULL HTTP TRACE — Business POSITIVE (Door Open)                    ║');
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
      formType: 'BUSINESS',
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

  log('PHASE 2 — V1 DB validation (Business fields)');
  const v1Db: Record<string, boolean> = {
    'form_type=POSITIVE': row1.form_type === 'POSITIVE',
    'business_status=Open (officeStatus → business_status alias)': row1.business_status === 'Open',
    'met_person_name=BIZ-V1-PERSON': row1.met_person_name === 'BIZ-V1-PERSON',
    'designation=Manager': row1.designation === 'Manager',
    'business_type=Retail': row1.business_type === 'Retail',
    'name_of_company_owners=BIZ-V1-OWNER': row1.name_of_company_owners === 'BIZ-V1-OWNER',
    'ownership_type=Proprietorship': row1.ownership_type === 'Proprietorship',
    'company_nature_of_business=BIZ-V1-ACTIVITY':
      row1.company_nature_of_business === 'BIZ-V1-ACTIVITY',
    'business_period composite (5 Year)': row1.business_period === '5 Year',
    'staff_strength=10': row1.staff_strength === 10,
    'staff_seen=8': row1.staff_seen === 8,
    'business_approx_area=800 (officeApproxArea → business_approx_area)':
      row1.business_approx_area === 800,
    'company_nameplate_status=SIGHTED AS': row1.company_nameplate_status === 'SIGHTED AS',
    'name_on_board=BIZ-V1-NAME': row1.name_on_board === 'BIZ-V1-NAME',
    'document_shown=GST Certificate': row1.document_shown === 'GST Certificate',
    'address_rating=Good': row1.address_rating === 'Good',
    'other_observation=BIZ-V1-OBS': row1.other_observation === 'BIZ-V1-OBS',
    'final_status=Positive': row1.final_status === 'Positive',
  };
  Object.assign(checks, v1Db);
  console.log(JSON.stringify(v1Db, null, 2));

  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  checks['V1 images delta=6 (5 building + 1 selfie)'] =
    (postV1Rows[0].n as number) - attBefore === 6;

  // V2
  await resetTaskOnly();
  log('PHASE 3 — Submit V2 with mutated sentinels');
  const v2FormData = baseline('V2');
  const v2Images = await buildImages(5, 1);
  const v2Res = await postForm(
    {
      formType: 'BUSINESS',
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
    'V2 name_of_company_owners=BIZ-V2-OWNER': row2.name_of_company_owners === 'BIZ-V2-OWNER',
    'V2 company_nature_of_business=BIZ-V2-ACTIVITY':
      row2.company_nature_of_business === 'BIZ-V2-ACTIVITY',
    'V2 name_on_board=BIZ-V2-NAME': row2.name_on_board === 'BIZ-V2-NAME',
    'V2 designation=Director': row2.designation === 'Director',
    'V2 business_type=Wholesale': row2.business_type === 'Wholesale',
    'V2 business_period=9 Year': row2.business_period === '9 Year',
    'V2 business_approx_area=1200': row2.business_approx_area === 1200,
    'V2 staff_strength=25': row2.staff_strength === 25,
    'V2 address_rating=Average': row2.address_rating === 'Average',
    'V2 other_observation=BIZ-V2-OBS': row2.other_observation === 'BIZ-V2-OBS',
    'Latest row NOT V1 values': row2.other_observation !== 'BIZ-V1-OBS',
  };
  Object.assign(checks, v2Db);
  console.log(JSON.stringify(v2Db, null, 2));

  // Render
  log('PHASE 5 — Render V2 report from latest DB row');
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'BUSINESS',
    outcome: 'POSITIVE',
    formData: mapDbToFormData(row2),
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Business Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  console.log(report);

  const renderChecks: Record<string, boolean> = {
    'V2 other_observation in report': report.includes('BIZ-V2-OBS'),
    'V1 other_observation absent': !report.includes('BIZ-V1-OBS'),
    'V2 company_nature_of_business in report': report.includes('BIZ-V2-ACTIVITY'),
    'V1 company_nature_of_business absent': !report.includes('BIZ-V1-ACTIVITY'),
    'V2 name_on_board in report': report.includes('BIZ-V2-NAME'),
    'V1 name_on_board absent': !report.includes('BIZ-V1-NAME'),
    'V2 address_rating in report': report.includes('rated as Average'),
    'V1 address_rating absent': !report.includes('rated as Good'),
    'V2 business_type appears': report.includes('Wholesale'),
    'V1 business_type absent (Retail)': !/\bRetail\b/.test(report),
    'V2 business_period pluralized (9 Years)': /9\s+Years/i.test(report),
    'V1 business_period absent (5 Years)': !/5\s+Years/i.test(report),
    'business_status rendered lowercase (office was open)':
      /the business was open/i.test(report),
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
