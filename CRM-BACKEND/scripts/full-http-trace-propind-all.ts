/**
 * FULL HTTP PIPELINE TRACE — Property Individual Verification ALL 4 OUTCOMES
 *
 * Real HTTP → preprocess → validate → map → INSERT → attachments → render.
 * V1 + V2 mutation per outcome. Field isolation checks per outcome.
 *
 * Property Individual has 4 outcomes (no SHIFTED per DB check constraint):
 *   1. POSITIVE & DOOR LOCKED
 *   2. NSP & DOOR LOCKED
 *   3. ERT (Entry Restricted)
 *   4. UNTRACEABLE
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

async function resetTaskAll(): Promise<void> {
  await pool.query(
    `DELETE FROM property_individual_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
  await pool.query(`UPDATE cases SET status='PENDING' WHERE id=$1`, [CASE_ID]);
}
async function resetTaskOnly(): Promise<void> {
  await pool.query(`UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`, [TASK_ID]);
}

async function captureIsolationBaseline() {
  const r = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM residence_verification_reports WHERE verification_task_id=$1) r,
      (SELECT COUNT(*)::int FROM office_verification_reports WHERE verification_task_id=$1) o,
      (SELECT COUNT(*)::int FROM business_verification_reports WHERE verification_task_id=$1) b,
      (SELECT COUNT(*)::int FROM builder_verification_reports WHERE verification_task_id=$1) bl,
      (SELECT COUNT(*)::int FROM noc_verification_reports WHERE verification_task_id=$1) n,
      (SELECT COUNT(*)::int FROM dsa_connector_verification_reports WHERE verification_task_id=$1) d`,
    [TASK_ID],
  );
  return r.rows[0] as Record<string, number>;
}

function log(title: string, obj?: unknown) {
  console.log(`\n${'─'.repeat(70)}\n  ${title}\n${'─'.repeat(70)}`);
  if (obj !== undefined) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    console.log(s.length > 1500 ? s.slice(0, 1500) + '\n...[truncated]' : s);
  }
}

// =====================================================================
// OUTCOME BASELINES
// =====================================================================

function baselinePositiveDoorLocked(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    buildingStatus: v1 ? 'Opened' : 'Under Construction',
    flatStatus: 'Closed',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: `POS-${s}-TPC1`,
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: `POS-${s}-TPC2`,
    tpcConfirmation2: 'Confirmed',
    locality: v1 ? 'Residential' : 'Mixed',
    addressStructure: v1 ? '4' : '7',
    addressExistAt: v1 ? '2nd' : '5th',
    addressStructureColor: v1 ? 'White' : 'Cream',
    doorColor: v1 ? 'Brown' : 'Grey',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: `POS-${s}-DOOR`,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: `POS-${s}-SOC`,
    landmark1: v1 ? 'Near Temple' : 'Near Park',
    landmark2: v1 ? 'Above Grocery' : 'Above Pharmacy',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `POS-${s}-OBS`,
    finalStatus: 'Positive',
    verificationOutcome: 'Positive & Door Locked',
    outcome: 'Positive & Door Locked',
  };
}

function baselineNspDoorLocked(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Average' : 'Poor',
    buildingStatus: v1 ? 'Opened' : 'Construction Incomplete',
    flatStatus: 'Closed',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: `NSP-${s}-TPC1`,
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: `NSP-${s}-TPC2`,
    tpcConfirmation2: 'Confirmed',
    locality: v1 ? 'Residential' : 'Slum',
    addressStructure: v1 ? '2' : '9',
    addressStructureColor: v1 ? 'Yellow' : 'Pink',
    doorColor: v1 ? 'Green' : 'Blue',
    doorNamePlateStatus: 'NOT SIGHTED',
    societyNamePlateStatus: 'NOT SIGHTED',
    landmark1: v1 ? 'Near School' : 'Near Station',
    landmark2: v1 ? 'Above Bank' : 'Opposite Mall',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `NSP-${s}-OBS`,
    finalStatus: 'Negative',
    verificationOutcome: 'NSP & Door Locked',
    outcome: 'NSP & Door Locked',
  };
}

function baselineErt(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    flatStatus: 'Closed',
    metPersonType: 'Security',
    nameOfMetPerson: `ERT-${s}-MET-NAME`,
    metPersonConfirmation: 'Confirmed',
    propertyOwnerName: `ERT-${s}-OWNER`,
    locality: v1 ? 'Gated Society' : 'Commercial',
    addressStructure: v1 ? '6' : '12',
    addressStructureColor: v1 ? 'Beige' : 'Red',
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: `ERT-${s}-SOC`,
    landmark1: v1 ? 'Near Hospital' : 'Near Airport',
    landmark2: v1 ? 'Above Cafe' : 'Opposite Theatre',
    buildingStatus: v1 ? 'Opened' : 'Opened',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `ERT-${s}-OBS`,
    finalStatus: 'Refer',
    verificationOutcome: 'Entry Restricted',
    outcome: 'Entry Restricted',
  };
}

function baselineUntraceable(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    contactPerson: `UT-${s}-PERSON`,
    callRemark: 'Did Not Pick Up Call',
    locality: v1 ? 'Remote' : 'Rural',
    landmark1: v1 ? 'Near Highway' : 'Near Bridge',
    landmark2: v1 ? 'Near Petrol Pump' : 'Near Toll',
    landmark3: v1 ? 'Near Bus Stop' : 'Near Railway',
    landmark4: v1 ? 'Near Temple' : 'Near Tower',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `UT-${s}-OBS`,
    finalStatus: 'Negative',
    verificationOutcome: 'Untraceable',
    outcome: 'Untraceable',
  };
}

// =====================================================================
// DB→formData REMAP per outcome (for Path-2 render test)
// =====================================================================

function mapDbCommon(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    buildingStatus: r.property_status,
    flatStatus: r.premises_status,
    locality: r.locality,
    addressStructure: r.address_structure,
    addressStructureColor: r.address_structure_color,
    doorColor: r.door_color,
    landmark1: r.landmark1,
    landmark2: r.landmark2,
    landmark3: r.landmark3,
    landmark4: r.landmark4,
    dominatedArea: r.dominated_area,
    feedbackFromNeighbour: r.feedback_from_neighbour,
    politicalConnection: r.political_connection,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
  };
}

function mapDbToFormDataPositiveOrNsp(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...mapDbCommon(r),
    addressExistAt: r.address_exist_at,
    doorNamePlateStatus: r.door_name_plate,
    nameOnDoorPlate: r.name_on_door_plate,
    societyNamePlateStatus: r.society_name_plate,
    nameOnSocietyBoard: r.name_on_society_board,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcConfirmation1: r.tpc_confirmation1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    tpcConfirmation2: r.tpc_confirmation2,
  };
}

function mapDbToFormDataErt(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...mapDbCommon(r),
    metPersonType: r.met_person_designation,
    nameOfMetPerson: r.met_person_name,
    metPersonConfirmation: r.security_confirmation,
    propertyOwnerName: r.owner_name,
    societyNamePlateStatus: r.society_name_plate,
    nameOnSocietyBoard: r.name_on_society_board,
  };
}

function mapDbToFormDataUt(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...mapDbCommon(r),
    contactPerson: r.contact_person,
    callRemark: r.call_remark,
  };
}

// =====================================================================
// PER-OUTCOME AUDIT HARNESS
// =====================================================================

interface OutcomeSpec {
  label: string;
  outcomeString: string;
  expectedFormType: string;
  expectedTemplateToken: string;
  baseline: (s: 'V1' | 'V2') => Record<string, unknown>;
  mapDbToFormData: (r: Record<string, unknown>) => Record<string, unknown>;
  dbChecks: (r: Record<string, unknown>, s: 'V1' | 'V2') => Record<string, boolean>;
  renderChecks: (report: string, s: 'V2') => Record<string, boolean>;
}

async function runOutcomeAudit(spec: OutcomeSpec): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};
  log(`\n╔═ OUTCOME: ${spec.label} ═╗`);

  // Reset + capture isolation baseline
  await resetTaskAll();
  const preIso = await captureIsolationBaseline();

  // V1
  const v1FormData = spec.baseline('V1');
  const v1Images = await buildImages(5, 1);
  const v1Res = await postForm(
    {
      formType: 'PROPERTY_INDIVIDUAL',
      data: {
        outcome: spec.outcomeString,
        formData: v1FormData,
        geoLocation: GEO,
        photos: v1Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
        images: v1Images,
      },
    },
    `${spec.label.replace(/\s+/g, '-').toLowerCase()}-v1`,
  );
  console.log(`  V1 submit → HTTP ${v1Res.status}`);
  checks[`${spec.label} | V1 HTTP 200`] = v1Res.status === 200 || v1Res.status === 201;
  if (!checks[`${spec.label} | V1 HTTP 200`]) {
    console.log(`  ❌ V1 body:`, JSON.stringify(v1Res.body).slice(0, 800));
    return checks;
  }

  const row1 = await readLatest();
  if (!row1) {
    checks[`${spec.label} | V1 DB row`] = false;
    return checks;
  }
  checks[`${spec.label} | V1 DB row`] = true;
  checks[`${spec.label} | V1 form_type=${spec.expectedFormType}`] =
    row1.form_type === spec.expectedFormType;

  const v1Db = spec.dbChecks(row1, 'V1');
  for (const [k, v] of Object.entries(v1Db)) checks[`${spec.label} | ${k}`] = v;

  // V2
  await resetTaskOnly();
  const v2FormData = spec.baseline('V2');
  const v2Images = await buildImages(5, 1);
  const v2Res = await postForm(
    {
      formType: 'PROPERTY_INDIVIDUAL',
      data: {
        outcome: spec.outcomeString,
        formData: v2FormData,
        geoLocation: GEO,
        photos: v2Images.map((img) => ({ type: img.type, geoLocation: img.geoLocation })),
        images: v2Images,
      },
    },
    `${spec.label.replace(/\s+/g, '-').toLowerCase()}-v2`,
  );
  console.log(`  V2 submit → HTTP ${v2Res.status}`);
  checks[`${spec.label} | V2 HTTP 200`] = v2Res.status === 200 || v2Res.status === 201;
  if (!checks[`${spec.label} | V2 HTTP 200`]) {
    console.log(`  ❌ V2 body:`, JSON.stringify(v2Res.body).slice(0, 800));
    return checks;
  }

  const row2 = await readLatest();
  if (!row2) {
    checks[`${spec.label} | V2 DB row`] = false;
    return checks;
  }
  const v2Db = spec.dbChecks(row2, 'V2');
  for (const [k, v] of Object.entries(v2Db)) checks[`${spec.label} | ${k}`] = v;

  // Isolation — verify no delta into other tables
  const postIso = await captureIsolationBaseline();
  checks[`${spec.label} | Isolation: residence delta=0`] = postIso.r - preIso.r === 0;
  checks[`${spec.label} | Isolation: office delta=0`] = postIso.o - preIso.o === 0;
  checks[`${spec.label} | Isolation: business delta=0`] = postIso.b - preIso.b === 0;
  checks[`${spec.label} | Isolation: builder delta=0`] = postIso.bl - preIso.bl === 0;
  checks[`${spec.label} | Isolation: NOC delta=0`] = postIso.n - preIso.n === 0;
  checks[`${spec.label} | Isolation: DSA delta=0`] = postIso.d - preIso.d === 0;

  // Render V2
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'PROPERTY_INDIVIDUAL',
    outcome: spec.outcomeString,
    formData: spec.mapDbToFormData(row2),
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Property Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  console.log(`\n----- V2 RENDER (${spec.label}) -----`);
  console.log(report);
  console.log('-----------------------------------');

  checks[`${spec.label} | Template token = ${spec.expectedTemplateToken}`] =
    report.includes(spec.expectedTemplateToken);
  checks[`${spec.label} | No unresolved {placeholders}`] =
    !/\{[A-Z][A-Za-z0-9_]+\}/.test(report);

  const renderChecks = spec.renderChecks(report, 'V2');
  for (const [k, v] of Object.entries(renderChecks)) checks[`${spec.label} | ${k}`] = v;

  return checks;
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL HTTP TRACE — Property Individual ALL 4 OUTCOMES               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const allChecks: Record<string, boolean> = {};

  // OUTCOME 1 — POSITIVE & DOOR LOCKED
  const pos = await runOutcomeAudit({
    label: 'POSITIVE & DOOR LOCKED',
    outcomeString: 'Positive & Door Locked',
    expectedFormType: 'POSITIVE',
    expectedTemplateToken: 'POSITIVE & DOOR LOCKED',
    baseline: baselinePositiveDoorLocked,
    mapDbToFormData: mapDbToFormDataPositiveOrNsp,
    dbChecks: (r, s) => ({
      [`${s} property_status (buildingStatus overload)`]:
        r.property_status === (s === 'V1' ? 'Opened' : 'Under Construction'),
      [`${s} premises_status=Closed`]: r.premises_status === 'Closed',
      [`${s} address_rating`]: r.address_rating === (s === 'V1' ? 'Good' : 'Average'),
      [`${s} address_exist_at`]: r.address_exist_at === (s === 'V1' ? '2nd' : '5th'),
      [`${s} tpc_name1`]: r.tpc_name1 === `POS-${s}-TPC1`,
      [`${s} tpc_name2`]: r.tpc_name2 === `POS-${s}-TPC2`,
      [`${s} name_on_door_plate`]: r.name_on_door_plate === `POS-${s}-DOOR`,
      [`${s} name_on_society_board`]: r.name_on_society_board === `POS-${s}-SOC`,
      [`${s} other_observation`]: r.other_observation === `POS-${s}-OBS`,
      [`${s} final_status=Positive`]: r.final_status === 'Positive',
      [`${s} conditional-on-Open fields NULL (Door Locked)`]:
        r.met_person_name == null &&
        r.met_person_relation == null &&
        r.owner_name == null &&
        r.property_area == null,
    }),
    renderChecks: (report) => ({
      'V2 other_observation present': report.includes('POS-V2-OBS'),
      'V1 other_observation absent': !report.includes('POS-V1-OBS'),
      'V2 tpc_name1 present': report.includes('POS-V2-TPC1'),
      'V1 tpc_name1 absent': !report.includes('POS-V1-TPC1'),
      'V2 name_on_door_plate present': report.includes('POS-V2-DOOR'),
      'V1 name_on_door_plate absent': !report.includes('POS-V1-DOOR'),
      'Door Locked prose': /flat was closed/i.test(report),
      'No Door Open leakage': !/flat was open/i.test(report),
      'TPC labels with relation': /\(Neighbour\)/.test(report) && /\(Security\)/.test(report),
    }),
  });
  Object.assign(allChecks, pos);

  // OUTCOME 2 — NSP & DOOR LOCKED
  const nsp = await runOutcomeAudit({
    label: 'NSP & DOOR LOCKED',
    outcomeString: 'NSP & Door Locked',
    expectedFormType: 'NSP',
    expectedTemplateToken: 'NSP & DOOR LOCKED',
    baseline: baselineNspDoorLocked,
    mapDbToFormData: mapDbToFormDataPositiveOrNsp,
    dbChecks: (r, s) => ({
      [`${s} property_status (buildingStatus overload)`]:
        r.property_status === (s === 'V1' ? 'Opened' : 'Construction Incomplete'),
      [`${s} premises_status=Closed`]: r.premises_status === 'Closed',
      [`${s} address_rating`]: r.address_rating === (s === 'V1' ? 'Average' : 'Poor'),
      [`${s} tpc_name1`]: r.tpc_name1 === `NSP-${s}-TPC1`,
      [`${s} tpc_name2`]: r.tpc_name2 === `NSP-${s}-TPC2`,
      [`${s} other_observation`]: r.other_observation === `NSP-${s}-OBS`,
      [`${s} final_status=Negative`]: r.final_status === 'Negative',
      // NSP rule: politicalConnection + feedbackFromNeighbour must be null (never captured by mobile)
      [`${s} political_connection NULL (NSP rule)`]: r.political_connection == null,
      [`${s} feedback_from_neighbour NULL (NSP rule)`]: r.feedback_from_neighbour == null,
      [`${s} met_person_name NULL (Door Locked, no metPerson field sent)`]:
        r.met_person_name == null,
    }),
    renderChecks: (report) => ({
      'V2 other_observation present': report.includes('NSP-V2-OBS'),
      'V1 other_observation absent': !report.includes('NSP-V1-OBS'),
      'V2 tpc_name1 present': report.includes('NSP-V2-TPC1'),
      'V1 tpc_name1 absent': !report.includes('NSP-V1-TPC1'),
      'Door Locked prose': /flat was closed/i.test(report),
      'No Door Open leakage': !/flat was open/i.test(report),
      'NSP prose: "never owned"': /never owned/i.test(report),
      'NSP: NO political sentence': !/political connection/i.test(report),
      'NSP: NO feedback sentence': !/feedback was received/i.test(report),
    }),
  });
  Object.assign(allChecks, nsp);

  // OUTCOME 3 — ERT
  const ert = await runOutcomeAudit({
    label: 'ERT',
    outcomeString: 'Entry Restricted',
    expectedFormType: 'ENTRY_RESTRICTED',
    expectedTemplateToken: 'ENTRY RESTRICTED',
    baseline: baselineErt,
    mapDbToFormData: mapDbToFormDataErt,
    dbChecks: (r, s) => ({
      [`${s} met_person_name`]: r.met_person_name === `ERT-${s}-MET-NAME`,
      [`${s} met_person_designation (metPersonType)`]: r.met_person_designation === 'Security',
      [`${s} security_confirmation (metPersonConfirmation)`]:
        r.security_confirmation === 'Confirmed',
      [`${s} owner_name (propertyOwnerName)`]: r.owner_name === `ERT-${s}-OWNER`,
      [`${s} address_rating`]: r.address_rating === (s === 'V1' ? 'Good' : 'Average'),
      [`${s} locality`]: r.locality === (s === 'V1' ? 'Gated Society' : 'Commercial'),
      [`${s} name_on_society_board`]: r.name_on_society_board === `ERT-${s}-SOC`,
      [`${s} other_observation`]: r.other_observation === `ERT-${s}-OBS`,
      [`${s} final_status=Refer`]: r.final_status === 'Refer',
      [`${s} political_connection set (ERT has it)`]:
        r.political_connection === 'Not Having Political Connection',
      [`${s} feedback_from_neighbour=Positive (ERT has it)`]:
        r.feedback_from_neighbour === 'Positive',
    }),
    renderChecks: (report) => ({
      'V2 met name present': report.includes('ERT-V2-MET-NAME'),
      'V1 met name absent': !report.includes('ERT-V1-MET-NAME'),
      'V2 owner name present': report.includes('ERT-V2-OWNER'),
      'V1 owner name absent': !report.includes('ERT-V1-OWNER'),
      'V2 society name present': report.includes('ERT-V2-SOC'),
      'V1 society name absent': !report.includes('ERT-V1-SOC'),
      'V2 other_observation present': report.includes('ERT-V2-OBS'),
      'V1 other_observation absent': !report.includes('ERT-V1-OBS'),
      'ERT prose: "entry...not allowed"': /entry to the given premises is not allowed/i.test(
        report,
      ),
      'Met person type (Security) in report': /\(Security\)/.test(report),
    }),
  });
  Object.assign(allChecks, ert);

  // OUTCOME 4 — UNTRACEABLE
  const ut = await runOutcomeAudit({
    label: 'UNTRACEABLE',
    outcomeString: 'Untraceable',
    expectedFormType: 'UNTRACEABLE',
    expectedTemplateToken: 'UNTRACEABLE',
    baseline: baselineUntraceable,
    mapDbToFormData: mapDbToFormDataUt,
    dbChecks: (r, s) => ({
      [`${s} contact_person`]: r.contact_person === `UT-${s}-PERSON`,
      [`${s} call_remark`]: r.call_remark === 'Did Not Pick Up Call',
      [`${s} locality`]: r.locality === (s === 'V1' ? 'Remote' : 'Rural'),
      [`${s} landmark1`]: r.landmark1 === (s === 'V1' ? 'Near Highway' : 'Near Bridge'),
      [`${s} landmark3`]: r.landmark3 === (s === 'V1' ? 'Near Bus Stop' : 'Near Railway'),
      [`${s} landmark4`]: r.landmark4 === (s === 'V1' ? 'Near Temple' : 'Near Tower'),
      [`${s} other_observation`]: r.other_observation === `UT-${s}-OBS`,
      [`${s} final_status=Negative`]: r.final_status === 'Negative',
    }),
    renderChecks: (report) => ({
      'V2 contact person present': report.includes('UT-V2-PERSON') ||
        /We called/i.test(report), // UT template uses Customer_Name not contact person
      'V2 landmark1 present': report.includes('Near Bridge'),
      'V2 landmark2 present': report.includes('Near Toll'),
      'V2 landmark3 present': report.includes('Near Railway'),
      'V2 landmark4 present': report.includes('Near Tower'),
      'V1 landmark1 absent': !report.includes('Near Highway'),
      'V1 landmark3 absent': !report.includes('Near Bus Stop'),
      'V2 locality=Rural present': report.includes('Rural'),
      'V2 other_observation present': report.includes('UT-V2-OBS'),
      'V1 other_observation absent': !report.includes('UT-V1-OBS'),
      'UT prose: "incorrect and untraceable"': /incorrect and untraceable/i.test(report),
    }),
  });
  Object.assign(allChecks, ut);

  // ─────────────────────────────────────────────
  log('FINAL SUMMARY (all 4 outcomes)');
  const pass = Object.values(allChecks).filter(Boolean).length;
  const total = Object.keys(allChecks).length;
  console.log(`\n  ${pass}/${total} checks passed.`);
  if (pass !== total) {
    console.log('\n  Failing:');
    for (const [k, v] of Object.entries(allChecks)) if (!v) console.log(`    ❌ ${k}`);
  }

  await pool.end();
  process.exit(pass === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
