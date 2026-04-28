/**
 * FULL HTTP PIPELINE TRACE — Residence-cum-Office: SHIFTED / NSP / ERT / UNTRACEABLE
 *
 * For each outcome:
 *   1. Reset task + clear reports
 *   2. POST V1 via real HTTP with formType: 'RESIDENCE_CUM_OFFICE'
 *      + mobile-shaped payload (merged Residence + Business fields per outcome)
 *      + 5 building + 1 selfie inline base64
 *   3. DB check → V1 values landed in correct columns
 *   4. Reset task
 *   5. POST V2 with mutated sentinels + 6 new images
 *   6. DB check → V2 latest, V1 preserved as history
 *   7. Render report from fresh DB row → V2 present, V1 absent
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
      'Idempotency-Key': `rco-rem-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM residence_cum_office_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
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

// ==== baselines per outcome ====

function shiftedBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    resiCumOfficeStatus: 'Open',
    metPerson: `RCO-${s}-PERSON`,
    metPersonStatus: v1 ? 'Current Tenant' : 'Owner',
    shiftedPeriodValue: v1 ? '8' : '14',
    shiftedPeriodUnit: 'Month',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Mixed Use Building',
    addressStructure: '12',
    addressFloor: '4',
    addressStructureColor: 'Cream',
    doorColor: 'Teak',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: `RCO-${s}-DOOR`,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: `RCO-${s}-SOCIETY`,
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: `RCO-${s}-OBS`,
    finalStatus: 'Refer',
    verificationOutcome: 'Shifted & Door Open',
    outcome: 'Shifted & Door Open',
  };
}

function nspBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressTraceable: 'Yes',
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    resiCumOfficeStatus: 'Open',
    metPerson: `RCO-${s}-PERSON`,
    metPersonStatus: v1 ? 'Current Resident' : 'New Occupant',
    stayingPeriodValue: v1 ? '10' : '15',
    stayingPeriodUnit: 'Year',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    locality: 'Mixed Use Building',
    addressStructure: '12',
    applicantStayingFloor: '3',
    addressStructureColor: 'Cream',
    doorColor: 'Teak',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: `RCO-${s}-DOOR`,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: `RCO-${s}-SOCIETY`,
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `RCO-${s}-OBS`,
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
    nameOfMetPerson: `RCO-${s}-PERSON`,
    metPersonConfirmation: 'Confirmed',
    applicantWorkingStatus: 'Applicant is Working At',
    applicantStayingStatus: 'Applicant is Staying At',
    businessStatus: v1 ? 'Self Employee - Proprietorship' : 'Partnership Firm',
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: `RCO-${s}-SOCIETY`,
    locality: 'Mixed Use Building',
    addressStructure: '12',
    addressStructureColor: 'Cream',
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `RCO-${s}-OBS`,
    finalStatus: 'Refer',
    verificationOutcome: 'Entry Restricted',
    outcome: 'Entry Restricted',
  };
}

function untBaseline(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    contactPerson: `RCO-${s}-CONTACT`,
    callRemark: v1 ? 'Did Not Pick Up Call' : 'Refused to Guide Address',
    locality: v1 ? 'Commercial' : 'Industrial',
    landmark1: 'Metro',
    landmark2: 'Mall',
    landmark3: 'Park',
    landmark4: 'Bank',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `RCO-${s}-OBS`,
    finalStatus: 'Negative',
    verificationOutcome: 'Untraceable',
    outcome: 'Untraceable',
  };
}

type Case = {
  name: string;
  outcome: string;
  templateKey: string;
  baseline: () => Record<string, unknown>;
  mutate: () => Record<string, unknown>;
  dbCheck: (
    r: Record<string, unknown>,
    phase: 'v1' | 'v2',
    s: Record<string, string>,
  ) => Record<string, boolean>;
  renderCheck: (
    r: string,
    v1: Record<string, string>,
    v2: Record<string, string>,
  ) => Record<string, boolean>;
};

const CASES: Case[] = [
  {
    name: 'SHIFTED (Door Open)',
    outcome: 'Shifted & Door Open',
    templateKey: 'SHIFTED',
    baseline: () => shiftedBaseline('V1'),
    mutate: () => shiftedBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=SHIFTED`]: r.form_type === 'SHIFTED',
      [`${phase} house_status=Open (mirror)`]: r.house_status === 'Open',
      [`${phase} office_status=Open (mirror)`]: r.office_status === 'Open',
      [`${phase} shifted_period composite merged (Month)`]:
        typeof r.shifted_period === 'string' && (r.shifted_period as string).includes('Month'),
      [`${phase} met_person_name=${s.person}`]: r.met_person_name === s.person,
      [`${phase} name_on_door_plate=${s.plate}`]: r.name_on_door_plate === s.plate,
      [`${phase} address_rating=${s.rating}`]: r.address_rating === s.rating,
      [`${phase} other_observation=${s.obs}`]: r.other_observation === s.obs,
      [`${phase} final_status=Refer`]: r.final_status === 'Refer',
    }),
    renderCheck: (r, v1, v2) => ({
      'V2 other_observation in report': r.includes(v2.obs),
      'V1 other_observation absent': !r.includes(v1.obs),
      'V2 door plate in report': r.includes(v2.plate),
      'V1 door plate absent': !r.includes(v1.plate),
      'V2 address_rating in report': r.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !r.includes(`rated as ${v1.rating}`),
      'V2 shifted_period pluralized (14 Months)': /14\s+Months/i.test(r),
      'V1 shifted_period absent (8 Months)': !/8\s+Months/i.test(r),
    }),
  },
  {
    name: 'NSP (Door Open)',
    outcome: 'NSP & Door Open',
    templateKey: 'NSP',
    baseline: () => nspBaseline('V1'),
    mutate: () => nspBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=NSP`]: r.form_type === 'NSP',
      [`${phase} house_status=Open (mirror)`]: r.house_status === 'Open',
      [`${phase} office_status=Open (mirror)`]: r.office_status === 'Open',
      [`${phase} staying_period composite merged (Year)`]:
        typeof r.staying_period === 'string' && (r.staying_period as string).includes('Year'),
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
      // RCO NSP_DOOR_OPEN template intentionally doesn't render {Staying_Period};
      // the narrative is about current residents, not the applicant. Field is
      // still captured in DB (checked above).
      'NSP narrative references no such person':
        /no such person is staying or working/i.test(r),
    }),
  },
  {
    name: 'ERT',
    outcome: 'Entry Restricted',
    templateKey: 'ERT',
    baseline: () => ertBaseline('V1'),
    mutate: () => ertBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=ENTRY_RESTRICTED`]: r.form_type === 'ENTRY_RESTRICTED',
      [`${phase} name_of_met_person=${s.person}`]: r.name_of_met_person === s.person,
      [`${phase} met_person_type present`]: typeof r.met_person_type === 'string',
      [`${phase} applicant_working_status=Working At`]:
        r.applicant_working_status === 'Applicant is Working At',
      [`${phase} applicant_staying_status=Staying At`]:
        r.applicant_staying_status === 'Applicant is Staying At',
      [`${phase} business_status present`]: typeof r.business_status === 'string',
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
      'applicant_staying_status helper rendered':
        /the applicant is staying at the given address/i.test(r),
      'applicant_working_status helper rendered':
        /the applicant is working at the given address/i.test(r),
    }),
  },
  {
    name: 'UNTRACEABLE',
    outcome: 'Untraceable',
    templateKey: 'UNTRACEABLE',
    baseline: () => untBaseline('V1'),
    mutate: () => untBaseline('V2'),
    dbCheck: (r, phase, s) => ({
      [`form_type=UNTRACEABLE`]: r.form_type === 'UNTRACEABLE',
      [`${phase} contact_person=${s.contact}`]: r.contact_person === s.contact,
      [`${phase} call_remark present`]: typeof r.call_remark === 'string',
      [`${phase} landmark3 present`]: r.landmark3 === 'Park',
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
    houseStatus: r.house_status,
    resiCumOfficeStatus: r.house_status,
    metPersonName: r.met_person_name,
    metPersonRelation: r.met_person_relation,
    metPersonStatus: r.met_person_status,
    stayingPeriod: r.staying_period,
    stayingPersonName: r.staying_person_name,
    shiftedPeriod: r.shifted_period,
    premisesStatus: r.premises_status,
    residenceSetup: r.residence_setup,
    businessSetup: r.business_setup,
    businessStatus: r.business_status,
    businessLocation: r.sitting_location,
    businessOperatingAddress: r.business_operating_address,
    applicantStayingFloor: r.address_floor,
    doorNamePlateStatus: r.door_nameplate_status,
    nameOnDoorPlate: r.name_on_door_plate,
    societyNamePlateStatus: r.society_nameplate_status,
    nameOnSocietyBoard: r.name_on_society_board,
    companyNamePlateStatus: r.company_nameplate_status,
    nameOnBoard: r.name_on_board,
    nameOnBoard: r.name_on_board,
    companyNatureOfBusiness: r.company_nature_of_business,
    businessPeriod: r.business_period,
    locality: r.locality,
    addressStructure: r.address_structure,
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
    landmark3: r.landmark3,
    landmark4: r.landmark4,
    nameOfMetPerson: r.name_of_met_person,
    metPersonType: r.met_person_type,
    metPersonConfirmation: r.met_person_confirmation,
    applicantStayingStatus: r.applicant_staying_status,
    applicantWorkingStatus: r.applicant_working_status,
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
  console.log(`\n${'═'.repeat(70)}\n  CASE: RCO → ${c.name}\n${'═'.repeat(70)}`);
  const checks: Record<string, boolean> = {};
  await resetTask();

  const { rows: preRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const attBefore = preRows[0].n as number;

  // V1
  const v1FormData = c.baseline();
  const v1Images = await buildImages(5, 1);
  const v1Payload = {
    formType: 'RESIDENCE_CUM_OFFICE',
    data: {
      outcome: c.outcome,
      formData: v1FormData,
      geoLocation: GEO,
      photos: v1Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
      images: v1Images,
    },
  };
  const v1Res = await postForm(v1Payload, `${c.name}-v1`);
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

  const v1S = {
    obs: 'RCO-V1-OBS',
    person: 'RCO-V1-PERSON',
    plate: 'RCO-V1-DOOR',
    contact: 'RCO-V1-CONTACT',
    rating: (v1FormData.addressRating as string) || '',
    locality: (v1FormData.locality as string) || '',
  };
  Object.assign(checks, c.dbCheck(row1, 'v1', v1S));

  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  checks['V1 images delta=6'] = (postV1Rows[0].n as number) - attBefore === 6;

  // V2
  await resetTaskOnly();
  const v2FormData = c.mutate();
  const v2Images = await buildImages(5, 1);
  const v2Payload = {
    formType: 'RESIDENCE_CUM_OFFICE',
    data: {
      outcome: c.outcome,
      formData: v2FormData,
      geoLocation: GEO,
      photos: v2Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
      images: v2Images,
    },
  };
  const v2Res = await postForm(v2Payload, `${c.name}-v2`);
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
    obs: 'RCO-V2-OBS',
    person: 'RCO-V2-PERSON',
    plate: 'RCO-V2-DOOR',
    contact: 'RCO-V2-CONTACT',
    rating: (v2FormData.addressRating as string) || '',
    locality: (v2FormData.locality as string) || '',
  };
  Object.assign(checks, c.dbCheck(row2, 'v2', v2S));
  checks['Latest row NOT V1 other_observation'] = row2.other_observation !== v1S.obs;

  // Render
  const fd = mapDbToFormData(row2);
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE_CUM_OFFICE',
    outcome: c.templateKey,
    formData: fd,
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test RCO Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  Object.assign(checks, c.renderCheck(report, v1S, v2S));

  console.log('\n  V2 render excerpt:');
  console.log(report.split('\n').slice(0, 6).map((l) => `    ${l}`).join('\n'));

  return { name: c.name, checks };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL HTTP TRACE — RCO remaining outcomes (SHIFTED/NSP/ERT/UT)      ║');
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
    console.log(`\n  ${ok ? '✅' : '❌'} ${r.name} — ${pass}/${total} checks passed`);
    if (!ok) for (const [k, v] of Object.entries(r.checks)) if (!v) console.log(`      ❌ ${k}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`  OVERALL: ${overallPass}/${overallTotal} checks passed`);
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
