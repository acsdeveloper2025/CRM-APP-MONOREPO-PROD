/**
 * FULL HTTP PIPELINE TRACE — Builder Verification POSITIVE (Door Open)
 *
 * Real HTTP → preprocess → validate → map → INSERT → attachments → Path-2 remap → render.
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
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjOWE2ODBkOS1jY2E5LTRjZDEtYjUwMC01NGYzMDFjMTFjN2EiLCJpYXQiOjE3NzY1NDI2NjUsImV4cCI6MTc3NjYyOTA2NX0.FgBXUmv1KWr23u_Eyutsd2gA4WVHZHlbBLUUbvGs2y0';

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
      'Idempotency-Key': `bld-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM builder_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}

async function countRows(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM builder_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  await pool.query(
    `DELETE FROM builder_verification_reports WHERE verification_task_id=$1`,
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
    officeStatus: 'Open',
    metPerson: `BLD-${s}-PERSON`,
    designation: v1 ? 'Project Manager' : 'Director',
    // Mobile uses businessType + nameOfCompanyOwners; Builder mapping aliases
    // businessType → builder_type, nameOfCompanyOwners → builder_owner_name.
    businessType: v1 ? 'Residential Construction' : 'Commercial Construction',
    nameOfCompanyOwners: v1 ? 'BLD-V1-OWNER' : 'BLD-V2-OWNER',
    ownershipType: 'Pvt Ltd',
    addressStatus: 'Same Address',
    companyNatureOfBusiness: v1 ? 'BLD-V1-PROJECT' : 'BLD-V2-PROJECT',
    businessPeriodValue: v1 ? '6' : '12',
    businessPeriodUnit: 'Year',
    officeApproxArea: v1 ? '2500' : '4000',
    staffStrength: v1 ? '45' : '90',
    staffSeen: v1 ? '30' : '70',
    companyNamePlateStatus: 'SIGHTED AS',
    // Sentinel doubles as "builder_name" via Path-2 remap (name_on_company_board
    // aliased + builder_name populated from the same source).
    nameOnBoard: v1 ? 'BLD-V1-NAME' : 'BLD-V2-NAME',
    documentShown: 'GST + RERA Certificate',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Commercial',
    addressStructure: '15',
    addressStructureColor: 'Cream',
    doorColor: 'Teak',
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `BLD-${s}-OBS`,
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
    businessStatus: r.office_status, // Builder reuses business_status token via Office_Status
    metPersonName: r.met_person_name,
    designation: r.designation,
    businessType: r.builder_type,
    builderType: r.builder_type,
    builderOwnerName: r.builder_owner_name,
    builderName: r.builder_name || r.name_on_company_board,
    ownershipType: r.ownership_type,
    companyNatureOfBusiness: r.company_nature_of_business,
    businessPeriod: r.business_period,
    officeApproxArea: r.office_approx_area,
    staffStrength: r.staff_strength,
    staffSeen: r.staff_seen,
    companyNamePlateStatus: r.company_nameplate_status,
    nameOnBoard: r.name_on_company_board,
    nameOnCompanyBoard: r.name_on_company_board,
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
  console.log('║  FULL HTTP TRACE — Builder POSITIVE (Door Open)                     ║');
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
      formType: 'BUILDER',
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

  log('PHASE 2 — V1 DB validation (Builder fields)');
  const v1Db: Record<string, boolean> = {
    'form_type=POSITIVE (isolation)': row1.form_type === 'POSITIVE',
    'office_status=Open': row1.office_status === 'Open',
    'builder_type=Residential Construction (aliased from businessType)':
      row1.builder_type === 'Residential Construction',
    'builder_owner_name=BLD-V1-OWNER (aliased from nameOfCompanyOwners)':
      row1.builder_owner_name === 'BLD-V1-OWNER',
    'met_person_name=BLD-V1-PERSON': row1.met_person_name === 'BLD-V1-PERSON',
    'designation=Project Manager': row1.designation === 'Project Manager',
    'ownership_type=Pvt Ltd': row1.ownership_type === 'Pvt Ltd',
    'company_nature_of_business=BLD-V1-PROJECT':
      row1.company_nature_of_business === 'BLD-V1-PROJECT',
    'business_period composite merged (6 Year)': row1.business_period === '6 Year',
    'staff_strength=45': row1.staff_strength === 45,
    'staff_seen=30': row1.staff_seen === 30,
    'office_approx_area=2500': row1.office_approx_area === 2500,
    'company_nameplate_status=SIGHTED AS':
      row1.company_nameplate_status === 'SIGHTED AS',
    'name_on_company_board=BLD-V1-NAME': row1.name_on_company_board === 'BLD-V1-NAME',
    'document_shown=GST + RERA Certificate':
      row1.document_shown === 'GST + RERA Certificate',
    'address_rating=Good': row1.address_rating === 'Good',
    'other_observation=BLD-V1-OBS': row1.other_observation === 'BLD-V1-OBS',
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
  log('PHASE 3 — Submit V2 with mutations');
  const v2FormData = baseline('V2');
  const v2Images = await buildImages(5, 1);
  const v2Res = await postForm(
    {
      formType: 'BUILDER',
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
    'V2 builder_type=Commercial Construction':
      row2.builder_type === 'Commercial Construction',
    'V2 builder_owner_name=BLD-V2-OWNER': row2.builder_owner_name === 'BLD-V2-OWNER',
    'V2 designation=Director': row2.designation === 'Director',
    'V2 company_nature_of_business=BLD-V2-PROJECT':
      row2.company_nature_of_business === 'BLD-V2-PROJECT',
    'V2 name_on_company_board=BLD-V2-NAME': row2.name_on_company_board === 'BLD-V2-NAME',
    'V2 business_period=12 Year': row2.business_period === '12 Year',
    'V2 staff_strength=90': row2.staff_strength === 90,
    'V2 office_approx_area=4000': row2.office_approx_area === 4000,
    'V2 address_rating=Average': row2.address_rating === 'Average',
    'V2 other_observation=BLD-V2-OBS': row2.other_observation === 'BLD-V2-OBS',
    'Latest row NOT V1 other_observation': row2.other_observation !== 'BLD-V1-OBS',
  };
  Object.assign(checks, v2Db);
  console.log(JSON.stringify(v2Db, null, 2));

  // Render
  log('PHASE 5 — Render V2 report from latest DB row');
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'BUILDER',
    outcome: 'POSITIVE',
    formData: mapDbToFormData(row2),
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Builder Site',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  console.log(report);

  const renderChecks: Record<string, boolean> = {
    'V2 other_observation in report': report.includes('BLD-V2-OBS'),
    'V1 other_observation absent': !report.includes('BLD-V1-OBS'),
    'V2 company_nature_of_business in report': report.includes('BLD-V2-PROJECT'),
    'V1 company_nature_of_business absent': !report.includes('BLD-V1-PROJECT'),
    'V2 name_on_company_board in report': report.includes('BLD-V2-NAME'),
    'V1 name_on_company_board absent': !report.includes('BLD-V1-NAME'),
    // Builder POSITIVE_DOOR_OPEN template doesn't render {Builder_Owner_Name};
    // {Builder_Name} is driven by name_on_company_board alias. Owner name is
    // still persisted in DB (checked above) — no render assertion needed.
    'V1 builder_owner_name absent': !report.includes('BLD-V1-OWNER'),
    'V2 address_rating in report': report.includes('rated as Average'),
    'V1 address_rating absent': !report.includes('rated as Good'),
    'V2 builder_type appears': report.includes('Commercial Construction'),
    'V1 builder_type absent (Residential)': !report.includes('Residential Construction'),
    'V2 business_period pluralized (12 Years)': /12\s+Years/i.test(report),
    'V1 business_period absent (6 Years)': !/6\s+Years/i.test(report),
    'TPC_1_Label with relation': /Mr\. Shah \(Neighbour\)/.test(report),
    'Builder-specific phrasing present': /builder/i.test(report),
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
