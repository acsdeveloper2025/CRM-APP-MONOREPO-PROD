/**
 * FULL HTTP PIPELINE TRACE — NOC (all 5 outcomes): Positive, Shifted, NSP, ERT, Untraceable
 *
 * V1 + V2 mutation each, field-isolation check via form_type column.
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
      'Idempotency-Key': `noc-all-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM noc_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}
async function countRows(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM noc_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  await pool.query(`DELETE FROM noc_verification_reports WHERE verification_task_id=$1`, [TASK_ID]);
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
  await pool.query(`UPDATE cases SET status='PENDING' WHERE id=$1`, [CASE_ID]);
}
async function resetTaskOnly(): Promise<void> {
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
}

// ==== baselines per outcome ====

function posBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    officeStatus: 'Open',
    metPerson: `NOC-${s}-POS-PERSON`,
    designation: v1 ? 'Secretary' : 'Chairman',
    authorisedSignature: `NOC-${s}-POS-AUTH`,
    nameOnNoc: `NOC-${s}-POS-NOCNAME`,
    flatNo: v1 ? 'A-301' : 'B-502',
    locality: 'Residential Society',
    addressStructure: '9',
    addressStructureColor: 'White',
    landmark1: 'Near Park',
    landmark2: 'Above Community Hall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `NOC-${s}-POS-OBS`,
    finalStatus: 'Positive',
    verificationOutcome: 'Positive & Door Open',
    outcome: 'Positive & Door Open',
  };
}

function shiftedBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    officeStatus: 'Open',
    metPerson: `NOC-${s}-SHF-PERSON`,
    designation: v1 ? 'Secretary' : 'Chairman',
    currentCompanyName: `NOC-${s}-SHF-NEWCO`,
    currentCompanyPeriodValue: v1 ? '2' : '5',
    currentCompanyPeriodUnit: 'Year',
    oldOfficeShiftedPeriodValue: v1 ? '8' : '14',
    oldOfficeShiftedPeriodUnit: 'Month',
    officeApproxArea: v1 ? '1500' : '2200',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: `NOC-${s}-SHF-NEWBOARD`,
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Residential Society',
    addressStructure: '9',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    landmark1: 'Near Park',
    landmark2: 'Above Community Hall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: `NOC-${s}-SHF-OBS`,
    finalStatus: 'Refer',
    verificationOutcome: 'Shifted & Door Open',
    outcome: 'Shifted & Door Open',
  };
}

function nspBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    officeStatus: 'Open',
    businessExistance: 'NOC Office Exist At',
    applicantExistance: 'No Such Person',
    metPerson: `NOC-${s}-NSP-PERSON`,
    designation: v1 ? 'Secretary' : 'Chairman',
    premisesStatus: 'Rented',
    currentCompanyName: `NOC-${s}-NSP-CURRENTCO`,
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: `NOC-${s}-NSP-BOARD`,
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    locality: 'Residential Society',
    addressStructure: '9',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    landmark1: 'Near Park',
    landmark2: 'Above Community Hall',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `NOC-${s}-NSP-OBS`,
    finalStatus: 'Negative',
    verificationOutcome: 'NSP & Door Open',
    outcome: 'NSP & Door Open',
  };
}

function ertBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    metPersonType: v1 ? 'Security' : 'Receptionist',
    nameOfMetPerson: `NOC-${s}-ERT-PERSON`,
    metPersonConfirmation: 'Confirmed',
    officeStatus: 'Office Exist At',
    locality: 'Residential Society',
    addressStructure: '9',
    addressStructureColor: 'White',
    landmark1: 'Near Park',
    landmark2: 'Above Community Hall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `NOC-${s}-ERT-OBS`,
    finalStatus: 'Refer',
    verificationOutcome: 'Entry Restricted',
    outcome: 'Entry Restricted',
  };
}

function untBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    contactPerson: `NOC-${s}-UNT-CONTACT`,
    callRemark: v1 ? 'Did Not Pick Up Call' : 'Refused to Guide Address',
    locality: v1 ? 'Residential Society' : 'Gated Colony',
    landmark1: 'Park',
    landmark2: 'Community Hall',
    landmark3: 'Temple',
    landmark4: 'Bank',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `NOC-${s}-UNT-OBS`,
    finalStatus: 'Negative',
    verificationOutcome: 'Untraceable',
    outcome: 'Untraceable',
  };
}

type Case = {
  name: string;
  outcome: string;
  templateKey: string;
  formTypeExpected: string;
  baseline: () => Record<string, unknown>;
  mutate: () => Record<string, unknown>;
  dbCheck: (r: Record<string, unknown>, phase: 'v1' | 'v2', s: Record<string, string>) => Record<string, boolean>;
  renderCheck: (r: string, v1: Record<string, string>, v2: Record<string, string>) => Record<string, boolean>;
};

const CASES: Case[] = [
  {
    name: 'POSITIVE (Door Open)',
    outcome: 'Positive & Door Open',
    templateKey: 'POSITIVE',
    formTypeExpected: 'POSITIVE',
    baseline: () => posBaseline('V1'),
    mutate: () => posBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=POSITIVE (isolation)`]: r.form_type === 'POSITIVE',
      [`${phase} office_status=Open`]: r.office_status === 'Open',
      [`${phase} authorised_signature=${s.auth}`]: r.authorised_signature === s.auth,
      [`${phase} name_on_noc=${s.nocname}`]: r.name_on_noc === s.nocname,
      [`${phase} flat_no=${s.flat}`]: r.flat_no === s.flat,
      [`${phase} met_person_name=${s.person}`]: r.met_person_name === s.person,
      [`${phase} address_rating=${s.rating}`]: r.address_rating === s.rating,
      [`${phase} other_observation=${s.obs}`]: r.other_observation === s.obs,
      [`${phase} final_status=Positive`]: r.final_status === 'Positive',
    }),
    renderCheck: (r, v1, v2) => ({
      'V2 other_observation in report': r.includes(v2.obs),
      'V1 other_observation absent': !r.includes(v1.obs),
      'V2 authorised_signature in report': r.includes(v2.auth),
      'V1 authorised_signature absent': !r.includes(v1.auth),
      'V2 name_on_noc in report': r.includes(v2.nocname),
      'V1 name_on_noc absent': !r.includes(v1.nocname),
      'V2 flat_no in report': r.includes(v2.flat),
      'V1 flat_no absent': !r.includes(v1.flat),
      'V2 address_rating in report': r.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !r.includes(`rated as ${v1.rating}`),
    }),
  },
  {
    name: 'SHIFTED (Door Open)',
    outcome: 'Shifted & Door Open',
    templateKey: 'SHIFTED',
    formTypeExpected: 'SHIFTED',
    baseline: () => shiftedBaseline('V1'),
    mutate: () => shiftedBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=SHIFTED (isolation)`]: r.form_type === 'SHIFTED',
      [`${phase} office_status=Open`]: r.office_status === 'Open',
      [`${phase} current_company_name=${s.newco}`]: r.current_company_name === s.newco,
      [`${phase} current_company_period composite (Year)`]:
        typeof r.current_company_period === 'string' && (r.current_company_period as string).includes('Year'),
      [`${phase} old_office_shifted_period composite (Month)`]:
        typeof r.old_office_shifted_period === 'string' && (r.old_office_shifted_period as string).includes('Month'),
      [`${phase} met_person_name=${s.person}`]: r.met_person_name === s.person,
      [`${phase} address_rating=${s.rating}`]: r.address_rating === s.rating,
      [`${phase} other_observation=${s.obs}`]: r.other_observation === s.obs,
      [`${phase} final_status=Refer`]: r.final_status === 'Refer',
    }),
    renderCheck: (r, v1, v2) => ({
      'V2 other_observation in report': r.includes(v2.obs),
      'V1 other_observation absent': !r.includes(v1.obs),
      'V2 address_rating in report': r.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !r.includes(`rated as ${v1.rating}`),
      'V2 old_office_shifted_period pluralized (14 Months)': /14\s+Months/i.test(r),
      'V1 old_office_shifted_period absent (8 Months)': !/8\s+Months/i.test(r),
      'V2 current_company_period pluralized (5 Years)': /5\s+Years/i.test(r),
    }),
  },
  {
    name: 'NSP (Door Open)',
    outcome: 'NSP & Door Open',
    templateKey: 'NSP',
    formTypeExpected: 'NSP',
    baseline: () => nspBaseline('V1'),
    mutate: () => nspBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=NSP (isolation)`]: r.form_type === 'NSP',
      [`${phase} office_status=Open`]: r.office_status === 'Open',
      [`${phase} current_company_name=${s.currentco}`]: r.current_company_name === s.currentco,
      [`${phase} met_person_name=${s.person}`]: r.met_person_name === s.person,
      [`${phase} address_rating=${s.rating}`]: r.address_rating === s.rating,
      [`${phase} other_observation=${s.obs}`]: r.other_observation === s.obs,
      [`${phase} final_status=Negative`]: r.final_status === 'Negative',
    }),
    renderCheck: (r, v1, v2) => ({
      'V2 other_observation in report': r.includes(v2.obs),
      'V1 other_observation absent': !r.includes(v1.obs),
      'V2 address_rating in report': r.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !r.includes(`rated as ${v1.rating}`),
    }),
  },
  {
    name: 'ERT',
    outcome: 'Entry Restricted',
    templateKey: 'ERT',
    formTypeExpected: 'ENTRY_RESTRICTED',
    baseline: () => ertBaseline('V1'),
    mutate: () => ertBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=ENTRY_RESTRICTED (isolation)`]: r.form_type === 'ENTRY_RESTRICTED',
      [`${phase} name_of_met_person=${s.person}`]: r.name_of_met_person === s.person,
      [`${phase} met_person_type present`]: typeof r.met_person_type === 'string',
      [`${phase} address_rating=${s.rating}`]: r.address_rating === s.rating,
      [`${phase} other_observation=${s.obs}`]: r.other_observation === s.obs,
      [`${phase} final_status=Refer`]: r.final_status === 'Refer',
    }),
    renderCheck: (r, v1, v2) => ({
      'V2 other_observation in report': r.includes(v2.obs),
      'V1 other_observation absent': !r.includes(v1.obs),
      'V2 name_of_met_person in report': r.includes(v2.person),
      'V1 name_of_met_person absent': !r.includes(v1.person),
      'V2 address_rating in report': r.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !r.includes(`rated as ${v1.rating}`),
    }),
  },
  {
    name: 'UNTRACEABLE',
    outcome: 'Untraceable',
    templateKey: 'UNTRACEABLE',
    formTypeExpected: 'UNTRACEABLE',
    baseline: () => untBaseline('V1'),
    mutate: () => untBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=UNTRACEABLE (isolation)`]: r.form_type === 'UNTRACEABLE',
      [`${phase} contact_person=${s.contact}`]: r.contact_person === s.contact,
      [`${phase} call_remark present`]: typeof r.call_remark === 'string',
      [`${phase} landmark3 present`]: r.landmark3 === 'Temple',
      [`${phase} landmark4 present`]: r.landmark4 === 'Bank',
      [`${phase} other_observation=${s.obs}`]: r.other_observation === s.obs,
      [`${phase} final_status=Negative`]: r.final_status === 'Negative',
    }),
    renderCheck: (r, v1, v2) => ({
      'V2 other_observation in report': r.includes(v2.obs),
      'V1 other_observation absent': !r.includes(v1.obs),
      'V2 contact_person in report': r.includes(v2.contact),
      'V1 contact_person absent': !r.includes(v1.contact),
      'V2 locality in report': r.includes(`The locality type is ${v2.locality}`),
      'V1 locality absent': !r.includes(`The locality type is ${v1.locality}`),
      'callRemarkText helper active':
        /the call was not picked up|the customer refused to guide/i.test(r),
    }),
  },
];

function mapDbToFormData(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    officeStatus: r.office_status,
    metPersonName: r.met_person_name,
    designation: r.met_person_designation || r.designation,
    authorisedSignature: r.authorised_signature,
    nameOnNoc: r.name_on_noc,
    flatNo: r.flat_no,
    currentCompanyName: r.current_company_name,
    currentCompanyPeriod: r.current_company_period,
    oldOfficeShiftedPeriod: r.old_office_shifted_period,
    companyNamePlateStatus: r.company_nameplate_status,
    nameOnBoard: r.name_on_company_board,
    nameOnCompanyBoard: r.name_on_company_board,
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
    landmark3: r.landmark3,
    landmark4: r.landmark4,
    nameOfMetPerson: r.name_of_met_person,
    metPersonType: r.met_person_type,
    metPersonConfirmation: r.met_person_confirmation,
    contactPerson: r.contact_person,
    callRemark: r.call_remark,
    politicalConnection: r.political_connection,
    dominatedArea: r.dominated_area,
    feedbackFromNeighbour: r.feedback_from_neighbour,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
  };
}

async function runCase(c: Case): Promise<{ name: string; checks: Record<string, boolean> }> {
  console.log(`\n${'═'.repeat(70)}\n  CASE: NOC → ${c.name}\n${'═'.repeat(70)}`);
  const checks: Record<string, boolean> = {};
  await resetTask();

  const { rows: preRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const attBefore = preRows[0].n as number;

  const v1FormData = c.baseline();
  const v1Images = await buildImages(5, 1);
  const v1Res = await postForm(
    {
      formType: 'NOC',
      data: {
        outcome: c.outcome,
        formData: v1FormData,
        geoLocation: GEO,
        photos: v1Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
        images: v1Images,
      },
    },
    `${c.name}-v1`,
  );
  console.log(`  V1 submit → HTTP ${v1Res.status}`);
  if (v1Res.status !== 200 && v1Res.status !== 201) {
    console.log(`  ❌ V1 body:`, JSON.stringify(v1Res.body).slice(0, 400));
    checks['V1 HTTP 200'] = false;
    return { name: c.name, checks };
  }
  checks['V1 HTTP 200'] = true;

  const row1 = await readLatest();
  if (!row1) {
    checks['V1 DB row'] = false;
    return { name: c.name, checks };
  }
  checks['V1 DB row'] = true;

  const suffix = c.templateKey === 'UNTRACEABLE' ? 'UNT' : c.templateKey === 'POSITIVE' ? 'POS' : c.templateKey === 'SHIFTED' ? 'SHF' : c.templateKey;
  const v1S = {
    obs: `NOC-V1-${suffix}-OBS`,
    person: c.templateKey === 'ERT' ? `NOC-V1-ERT-PERSON` : `NOC-V1-${suffix}-PERSON`,
    auth: `NOC-V1-POS-AUTH`,
    nocname: `NOC-V1-POS-NOCNAME`,
    flat: 'A-301',
    newco: `NOC-V1-SHF-NEWCO`,
    currentco: `NOC-V1-NSP-CURRENTCO`,
    contact: `NOC-V1-UNT-CONTACT`,
    rating: (v1FormData.addressRating as string) || '',
    locality: (v1FormData.locality as string) || '',
  };
  Object.assign(checks, c.dbCheck(row1, 'v1', v1S));

  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  checks['V1 images delta=6'] = (postV1Rows[0].n as number) - attBefore === 6;

  await resetTaskOnly();
  const v2FormData = c.mutate();
  const v2Images = await buildImages(5, 1);
  const v2Res = await postForm(
    {
      formType: 'NOC',
      data: {
        outcome: c.outcome,
        formData: v2FormData,
        geoLocation: GEO,
        photos: v2Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
        images: v2Images,
      },
    },
    `${c.name}-v2`,
  );
  console.log(`  V2 submit → HTTP ${v2Res.status}`);
  if (v2Res.status !== 200 && v2Res.status !== 201) {
    console.log(`  ❌ V2 body:`, JSON.stringify(v2Res.body).slice(0, 400));
    checks['V2 HTTP 200'] = false;
    return { name: c.name, checks };
  }
  checks['V2 HTTP 200'] = true;
  checks['Total rows = 2'] = (await countRows()) === 2;

  const row2 = await readLatest();
  if (!row2) {
    checks['V2 DB row'] = false;
    return { name: c.name, checks };
  }
  const v2S = {
    obs: `NOC-V2-${suffix}-OBS`,
    person: c.templateKey === 'ERT' ? `NOC-V2-ERT-PERSON` : `NOC-V2-${suffix}-PERSON`,
    auth: `NOC-V2-POS-AUTH`,
    nocname: `NOC-V2-POS-NOCNAME`,
    flat: 'B-502',
    newco: `NOC-V2-SHF-NEWCO`,
    currentco: `NOC-V2-NSP-CURRENTCO`,
    contact: `NOC-V2-UNT-CONTACT`,
    rating: (v2FormData.addressRating as string) || '',
    locality: (v2FormData.locality as string) || '',
  };
  Object.assign(checks, c.dbCheck(row2, 'v2', v2S));
  checks['Latest row NOT V1 other_observation'] = row2.other_observation !== v1S.obs;

  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'NOC',
    outcome: c.templateKey,
    formData: mapDbToFormData(row2),
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test NOC Property',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  Object.assign(checks, c.renderCheck(report, v1S, v2S));

  console.log('\n  V2 render excerpt:');
  console.log(report.split('\n').slice(0, 5).map((l) => `    ${l}`).join('\n'));

  return { name: c.name, checks };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL HTTP TRACE — NOC ALL outcomes (Positive re-check + 4)         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const results: { name: string; checks: Record<string, boolean> }[] = [];
  for (const c of CASES) {
    try {
      results.push(await runCase(c));
    } catch (err) {
      console.log(`  ❌ ${c.name} — threw:`, err);
      results.push({ name: c.name, checks: { thrown: false } });
    }
  }

  console.log('\n\n══════════════════════════════════════════════════════════════════════');
  console.log('  DETAILED RESULTS PER OUTCOME');
  console.log('══════════════════════════════════════════════════════════════════════');

  let overallPass = 0,
    overallTotal = 0;
  for (const r of results) {
    const total = Object.keys(r.checks).length;
    const pass = Object.values(r.checks).filter(Boolean).length;
    overallPass += pass;
    overallTotal += total;
    const ok = pass === total;
    console.log(`\n  ${ok ? '✅' : '❌'} ${r.name} — ${pass}/${total}`);
    if (!ok) for (const [k, v] of Object.entries(r.checks)) if (!v) console.log(`      ❌ ${k}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`  OVERALL: ${overallPass}/${overallTotal}`);
  console.log('══════════════════════════════════════════════════════════════════════');

  console.table(
    results.map((r) => {
      const total = Object.keys(r.checks).length;
      const pass = Object.values(r.checks).filter(Boolean).length;
      return { outcome: r.name, pass: `${pass}/${total}`, status: pass === total ? '✅' : '❌' };
    }),
  );

  await pool.end();
  process.exit(overallPass === overallTotal ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
