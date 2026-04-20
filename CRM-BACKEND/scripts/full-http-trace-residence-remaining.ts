/**
 * FULL HTTP PIPELINE TRACE — Residence SHIFTED / NSP / ERT / UNTRACEABLE
 *
 * Same methodology as full-http-trace-residence-positive.ts:
 *   For each outcome:
 *     1. Reset task to ASSIGNED + clean reports table
 *     2. POST V1 via real HTTP /api/mobile/verification-tasks/:taskId/forms
 *        — all mandatory fields filled, 5 building photos + 1 selfie inline base64
 *     3. Read DB, assert V1 sentinels landed
 *     4. Reset task (transitions allow it)
 *     5. POST V2 with mutated sentinels + new images
 *     6. Read DB, assert V2 latest row, V1 still preserved as history
 *     7. Render report from latest DB row; assert V2 values rendered, V1 absent
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

async function buildImages(
  numBuilding: number,
  numSelfie: number,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let seed = Math.floor(Math.random() * 10000);
  for (let i = 0; i < numBuilding + numSelfie; i++) {
    const buf = await makeJpeg(++seed);
    out.push({
      dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
      type: i < numBuilding ? 'building' : 'selfie',
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
      'Idempotency-Key': `trace-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatestReport(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM residence_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}

async function countReports(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM residence_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  // Reset both task status and clean reports so each run starts fresh.
  await pool.query(
    `DELETE FROM residence_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  await pool.query(
    `UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`,
    [TASK_ID],
  );
  await pool.query(
    `UPDATE cases SET status='PENDING' WHERE id=$1`,
    [CASE_ID],
  );
}

async function resetTaskForV2(): Promise<void> {
  // After V1 submit, task is COMPLETED. Transition back to ASSIGNED so V2 can submit.
  await pool.query(
    `UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`,
    [TASK_ID],
  );
}

// --------- outcome-specific builders ---------
type Outcome = {
  name: string;
  outcome: string; // goes into `data.outcome`
  formTypeExpected: string; // goes into DB form_type column
  templateOutcomeKey: string; // for templateReportService.generateTemplateReport
  baseline: () => Record<string, unknown>; // formData V1
  mutate: (
    fd: Record<string, unknown>,
  ) => { formData: Record<string, unknown>; v1Sentinel: string; v2Sentinel: string; textCol: string; dropCol: string; dropV1: string; dropV2: string };
  numBuilding: number;
  numSelfie: number;
  dbCheck: (
    row: Record<string, unknown>,
    phase: 'v1' | 'v2',
    sentinels: Record<string, string>,
  ) => Record<string, boolean>;
  renderCheck: (
    report: string,
    v1: Record<string, string>,
    v2: Record<string, string>,
  ) => Record<string, boolean>;
};

// SHIFTED Door Open — all mandatory fields from legacyShiftedResidenceFields
function shiftedBaseline(suffix: 'V1' | 'V2'): Record<string, unknown> {
  const isV1 = suffix === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: isV1 ? 'Good' : 'Average',
    houseStatus: 'Open',
    metPersonName: isV1 ? `TRACE-${suffix}-MET` : `TRACE-${suffix}-MET`,
    metPersonStatus: isV1 ? 'Current Tenant' : 'Owner',
    shiftedPeriodValue: isV1 ? '8' : '14',
    shiftedPeriodUnit: 'Month',
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
    nameOnDoorPlate: `TRACE-${suffix}-PLATE`,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Flying Colors',
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: `TRACE-${suffix}-OBS`,
    finalStatus: 'Refer',
  };
}

function nspBaseline(suffix: 'V1' | 'V2'): Record<string, unknown> {
  const isV1 = suffix === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: isV1 ? 'Good' : 'Average',
    houseStatus: 'Open',
    metPersonName: `TRACE-${suffix}-MET`,
    metPersonStatus: isV1 ? 'Current Resident' : 'New Occupant',
    stayingPeriodValue: isV1 ? '10' : '15',
    stayingPeriodUnit: 'Year',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    locality: 'Resi Building',
    addressStructure: '10',
    applicantStayingFloor: '4',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: `TRACE-${suffix}-PLATE`,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Flying Colors',
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `TRACE-${suffix}-OBS`,
    finalStatus: 'Negative',
  };
}

function ertBaseline(suffix: 'V1' | 'V2'): Record<string, unknown> {
  const isV1 = suffix === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: isV1 ? 'Good' : 'Average',
    nameOfMetPerson: `TRACE-${suffix}-MET`,
    metPerson: isV1 ? 'Security' : 'Receptionist',
    metPersonConfirmation: 'Confirmed',
    applicantStayingStatus: 'Applicant is Staying At',
    locality: 'Resi Building',
    addressStructure: '10',
    applicantStayingFloor: '4',
    addressStructureColor: 'White',
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Flying Colors',
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `TRACE-${suffix}-OBS`,
    finalStatus: 'Refer',
  };
}

function untBaseline(suffix: 'V1' | 'V2'): Record<string, unknown> {
  const isV1 = suffix === 'V1';
  return {
    contactPerson: `TRACE-${suffix}-CONTACT`,
    callRemark: isV1 ? 'Did Not Pick Up Call' : 'Refused to Guide Address',
    locality: isV1 ? 'Chawl' : 'Slum',
    landmark1: 'Metro',
    landmark2: 'Mall',
    landmark3: 'Park',
    landmark4: 'Bank',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `TRACE-${suffix}-OBS`,
    finalStatus: 'Negative',
  };
}

const OUTCOMES: Outcome[] = [
  {
    name: 'SHIFTED (Door Open)',
    outcome: 'Shifted & Door Open',
    formTypeExpected: 'SHIFTED',
    templateOutcomeKey: 'SHIFTED',
    baseline: () => shiftedBaseline('V1'),
    mutate: () => ({
      formData: shiftedBaseline('V2'),
      v1Sentinel: 'TRACE-V1-OBS',
      v2Sentinel: 'TRACE-V2-OBS',
      textCol: 'other_observation',
      dropCol: 'address_rating',
      dropV1: 'Good',
      dropV2: 'Average',
    }),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=SHIFTED`]: row.form_type === 'SHIFTED',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} shifted_period composite merged`]: typeof row.shifted_period === 'string' && (row.shifted_period as string).includes('Month'),
      [`${phase} address_rating=${s.rating}`]: row.address_rating === s.rating,
      [`${phase} name_on_door_plate`]: row.name_on_door_plate === s.plate,
      [`${phase} house_status=Open`]: row.house_status === 'Open',
      [`${phase} final_status=Refer`]: row.final_status === 'Refer',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 name_on_door_plate in report': report.includes(v2.plate),
      'V1 name_on_door_plate absent': !report.includes(v1.plate),
      'V2 address_rating in report': report.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !report.includes(`rated as ${v1.rating}`),
      'V2 shifted_period pluralized correctly': /14\s+Months/i.test(report),
      'V1 shifted_period absent': !/8\s+Months/i.test(report),
    }),
  },
  {
    name: 'NSP (Door Open)',
    outcome: 'NSP & Door Open',
    formTypeExpected: 'NSP',
    templateOutcomeKey: 'NSP',
    baseline: () => nspBaseline('V1'),
    mutate: () => ({
      formData: nspBaseline('V2'),
      v1Sentinel: 'TRACE-V1-OBS',
      v2Sentinel: 'TRACE-V2-OBS',
      textCol: 'other_observation',
      dropCol: 'address_rating',
      dropV1: 'Good',
      dropV2: 'Average',
    }),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=NSP`]: row.form_type === 'NSP',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} staying_period composite merged`]: typeof row.staying_period === 'string' && (row.staying_period as string).includes('Year'),
      [`${phase} address_rating=${s.rating}`]: row.address_rating === s.rating,
      [`${phase} met_person_name`]: row.met_person_name === s.met,
      [`${phase} house_status=Open`]: row.house_status === 'Open',
      [`${phase} final_status=Negative`]: row.final_status === 'Negative',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 address_rating in report': report.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !report.includes(`rated as ${v1.rating}`),
      'V2 staying_period pluralized': /15\s+Years/i.test(report),
      'V1 staying_period absent': !/10\s+Years/i.test(report),
    }),
  },
  {
    name: 'ERT',
    outcome: 'Entry Restricted',
    formTypeExpected: 'ENTRY_RESTRICTED',
    templateOutcomeKey: 'ERT',
    baseline: () => ertBaseline('V1'),
    mutate: () => ({
      formData: ertBaseline('V2'),
      v1Sentinel: 'TRACE-V1-OBS',
      v2Sentinel: 'TRACE-V2-OBS',
      textCol: 'other_observation',
      dropCol: 'address_rating',
      dropV1: 'Good',
      dropV2: 'Average',
    }),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=ENTRY_RESTRICTED`]: row.form_type === 'ENTRY_RESTRICTED',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} name_of_met_person`]: row.name_of_met_person === s.met,
      [`${phase} met_person_type`]: typeof row.met_person_type === 'string',
      [`${phase} applicant_staying_status`]: row.applicant_staying_status === 'Applicant is Staying At',
      [`${phase} address_rating=${s.rating}`]: row.address_rating === s.rating,
      [`${phase} final_status=Refer`]: row.final_status === 'Refer',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 name_of_met_person in report': report.includes(v2.met),
      'V1 name_of_met_person absent': !report.includes(v1.met),
      'V2 address_rating in report': report.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !report.includes(`rated as ${v1.rating}`),
      'applicant_staying_status helper rendered': /the applicant is staying at the given address/i.test(report),
    }),
  },
  {
    name: 'UNTRACEABLE',
    outcome: 'Untraceable',
    formTypeExpected: 'UNTRACEABLE',
    templateOutcomeKey: 'UNTRACEABLE',
    baseline: () => untBaseline('V1'),
    mutate: () => ({
      formData: untBaseline('V2'),
      v1Sentinel: 'TRACE-V1-OBS',
      v2Sentinel: 'TRACE-V2-OBS',
      textCol: 'other_observation',
      dropCol: 'locality',
      dropV1: 'Chawl',
      dropV2: 'Slum',
    }),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=UNTRACEABLE`]: row.form_type === 'UNTRACEABLE',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} contact_person`]: row.contact_person === s.contact,
      [`${phase} call_remark`]: typeof row.call_remark === 'string',
      [`${phase} landmark3 present`]: row.landmark3 === 'Park',
      [`${phase} landmark4 present`]: row.landmark4 === 'Bank',
      [`${phase} final_status=Negative`]: row.final_status === 'Negative',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 contact_person in report': report.includes(v2.contact),
      'V1 contact_person absent': !report.includes(v1.contact),
      'V2 locality in report': report.includes(`The locality type is ${v2.locality}`),
      'V1 locality absent': !report.includes(`The locality type is ${v1.locality}`),
      'callRemarkText helper active': /the call was not picked up|the customer refused to guide/i.test(report),
    }),
  },
];

// Map formData from DB row to match controller's Path-2 camelCase (exact keys the resolver expects)
function mapDbRowToFormData(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    houseStatus: r.house_status,
    metPersonName: r.met_person_name,
    metPersonRelation: r.met_person_relation,
    metPersonStatus: r.met_person_status,
    stayingPeriod: r.staying_period,
    stayingStatus: r.staying_status,
    stayingPersonName: r.staying_person_name,
    totalFamilyMembers: r.total_family_members,
    totalEarningMember: r.total_earning_member,
    workingStatus: r.working_status,
    companyName: r.company_name,
    approxArea: r.approx_area,
    documentShownStatus: r.document_shown_status,
    documentType: r.document_type,
    doorNamePlateStatus: r.door_nameplate_status,
    nameOnDoorPlate: r.name_on_door_plate,
    societyNamePlateStatus: r.society_nameplate_status,
    nameOnSocietyBoard: r.name_on_society_board,
    locality: r.locality,
    addressStructure: r.address_structure,
    applicantStayingFloor: r.applicant_staying_floor,
    addressFloor: r.address_floor,
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
    shiftedPeriod: r.shifted_period,
    premisesStatus: r.premises_status,
    nameOfMetPerson: r.name_of_met_person,
    metPersonType: r.met_person_type,
    metPersonConfirmation: r.met_person_confirmation,
    applicantStayingStatus: r.applicant_staying_status,
    contactPerson: r.contact_person,
    callRemark: r.call_remark,
    dominatedArea: r.dominated_area,
    feedbackFromNeighbour: r.feedback_from_neighbour,
    politicalConnection: r.political_connection,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
  };
}

async function runOutcome(o: Outcome): Promise<{ name: string; checks: Record<string, boolean> }> {
  console.log(`\n${'═'.repeat(70)}\n  CASE: Residence → ${o.name}\n${'═'.repeat(70)}`);

  const allChecks: Record<string, boolean> = {};

  // === RESET ===
  await resetTask();

  // Capture attachment count before V1 submit so we can check delta.
  const { rows: preRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const attCountBeforeV1 = preRows[0].n as number;

  // === V1 SUBMIT ===
  const v1FormData = {
    ...o.baseline(),
    // CRITICAL: detection logic at formTypeDetection.ts:450 reads
    //   formData.verificationOutcome || formData.outcome || formData.finalStatus
    // If only finalStatus is present (e.g. 'Negative' for NSP/UT), it maps to
    // the invalid form_type 'NEGATIVE'. Passing verificationOutcome explicitly
    // forces Method-1 match on the full outcome string.
    verificationOutcome: o.outcome,
    outcome: o.outcome,
  };
  const v1Images = await buildImages(o.numBuilding, o.numSelfie);
  const v1Payload = {
    formType: 'RESIDENCE',
    data: {
      outcome: o.outcome,
      formData: v1FormData,
      geoLocation: GEO,
      photos: v1Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
      images: v1Images,
    },
  };
  const v1Res = await postForm(v1Payload, `${o.name}-v1`);
  console.log(`  V1 submit → HTTP ${v1Res.status}`);
  if (v1Res.status !== 200 && v1Res.status !== 201) {
    console.log(`  ❌ V1 response:`, JSON.stringify(v1Res.body).slice(0, 400));
    allChecks['V1 submit HTTP 200'] = false;
    return { name: o.name, checks: allChecks };
  }
  allChecks['V1 submit HTTP 200'] = true;

  // === V1 DB CHECK ===
  const row1 = await readLatestReport();
  if (!row1) {
    allChecks['V1 DB row inserted'] = false;
    return { name: o.name, checks: allChecks };
  }
  allChecks['V1 DB row inserted'] = true;

  const v1Sentinels = {
    obs: 'TRACE-V1-OBS',
    plate: 'TRACE-V1-PLATE',
    met: 'TRACE-V1-MET',
    contact: 'TRACE-V1-CONTACT',
    rating: v1FormData.addressRating as string,
    locality: v1FormData.locality as string,
  };
  const v1DbChecks = o.dbCheck(row1, 'v1', v1Sentinels);
  Object.assign(allChecks, v1DbChecks);

  // === V1 IMAGES CHECK (delta since before V1 submit) ===
  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE photo_type='selfie')::int AS selfies
     FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const delta = postV1Rows[0].n - attCountBeforeV1;
  allChecks['V1 images delta=6 (5 building + 1 selfie)'] = delta === 6;

  // === V2 SUBMIT ===
  await resetTaskForV2();
  const mut = o.mutate();
  const v2FormData = {
    ...mut.formData,
    verificationOutcome: o.outcome,
    outcome: o.outcome,
  };
  const v2Images = await buildImages(o.numBuilding, o.numSelfie);
  const v2Payload = {
    formType: 'RESIDENCE',
    data: {
      outcome: o.outcome,
      formData: v2FormData,
      geoLocation: GEO,
      photos: v2Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
      images: v2Images,
    },
  };
  const v2Res = await postForm(v2Payload, `${o.name}-v2`);
  console.log(`  V2 submit → HTTP ${v2Res.status}`);
  if (v2Res.status !== 200 && v2Res.status !== 201) {
    console.log(`  ❌ V2 response:`, JSON.stringify(v2Res.body).slice(0, 400));
    allChecks['V2 submit HTTP 200'] = false;
    return { name: o.name, checks: allChecks };
  }
  allChecks['V2 submit HTTP 200'] = true;

  const rowCount = await countReports();
  allChecks['Total rows = 2 after V2'] = rowCount === 2;

  const row2 = await readLatestReport();
  if (!row2) {
    allChecks['V2 latest row present'] = false;
    return { name: o.name, checks: allChecks };
  }
  const v2Sentinels = {
    obs: 'TRACE-V2-OBS',
    plate: 'TRACE-V2-PLATE',
    met: 'TRACE-V2-MET',
    contact: 'TRACE-V2-CONTACT',
    rating: v2FormData.addressRating as string,
    locality: v2FormData.locality as string,
  };
  const v2DbChecks = o.dbCheck(row2, 'v2', v2Sentinels);
  Object.assign(allChecks, v2DbChecks);
  allChecks['Latest row NOT V1 values'] = row2.other_observation !== v1Sentinels.obs;

  // === RENDER REPORT FROM LATEST DB ROW ===
  const formDataFromDb = mapDbRowToFormData(row2);
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE',
    outcome: o.templateOutcomeKey,
    formData: formDataFromDb,
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');

  const renderChecks = o.renderCheck(report, v1Sentinels, v2Sentinels);
  Object.assign(allChecks, renderChecks);

  // Print excerpt of rendered report for visual trace
  console.log('\n  Rendered V2 report (excerpt):');
  console.log(report.split('\n').slice(0, 6).map((l) => `    ${l}`).join('\n'));

  return { name: o.name, checks: allChecks };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL HTTP TRACE — Residence remaining outcomes (V1 + V2 mutation)  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const results: { name: string; checks: Record<string, boolean> }[] = [];
  for (const o of OUTCOMES) {
    try {
      const res = await runOutcome(o);
      results.push(res);
    } catch (err) {
      console.log(`  ❌ ${o.name} — threw error:`, err);
      results.push({ name: o.name, checks: { thrown: false } });
    }
  }

  console.log('\n\n══════════════════════════════════════════════════════════════════════');
  console.log('  DETAILED RESULTS PER OUTCOME');
  console.log('══════════════════════════════════════════════════════════════════════');

  let overallPass = 0;
  let overallTotal = 0;
  for (const r of results) {
    const total = Object.keys(r.checks).length;
    const pass = Object.values(r.checks).filter(Boolean).length;
    overallPass += pass;
    overallTotal += total;

    const ok = pass === total;
    console.log(`\n  ${ok ? '✅' : '❌'} ${r.name} — ${pass}/${total} checks passed`);
    if (!ok) {
      for (const [k, v] of Object.entries(r.checks)) {
        if (!v) console.log(`      ❌ ${k}`);
      }
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`  OVERALL: ${overallPass}/${overallTotal} checks passed across all 4 outcomes`);
  console.log('══════════════════════════════════════════════════════════════════════');

  // Final matrix
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
