/**
 * FULL HTTP PIPELINE TRACE — Property APF Verification ALL OUTCOMES
 *
 * Critical focus: POSITIVE vs NEGATIVE routing.
 *   Same mobile form shape is used for both — finalStatus='Positive' vs 'Negative'
 *   is the only differentiator that flips form_type + template selection.
 *
 * 4 scenarios:
 *   1. POSITIVE (finalStatus=Positive) → form_type=POSITIVE, PROPERTY_APF_TEMPLATES.POSITIVE
 *   2. NEGATIVE (same form, finalStatus=Negative) → form_type=NEGATIVE, PROPERTY_APF_TEMPLATES.NEGATIVE
 *   3. ERT (Entry Restricted mobile form) → form_type=ENTRY_RESTRICTED, ERT template
 *   4. UNTRACEABLE → form_type=UNTRACEABLE, UNTRACEABLE template
 *
 * Each scenario runs V1+V2 with mutated sentinels + field-isolation delta checks.
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
  // Strip any non-ASCII from the header value — labels may include arrows/unicode.
  const safeLabel = label.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '-');
  const res = await fetch(`${API}/api/mobile/verification-tasks/${TASK_ID}/forms`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Idempotency-Key': `apf-${Date.now()}-${safeLabel}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatest(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM property_apf_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}
async function resetTaskAll(): Promise<void> {
  await pool.query(
    `DELETE FROM property_apf_verification_reports WHERE verification_task_id=$1`,
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
      (SELECT COUNT(*)::int FROM dsa_connector_verification_reports WHERE verification_task_id=$1) d,
      (SELECT COUNT(*)::int FROM property_individual_verification_reports WHERE verification_task_id=$1) pi`,
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
// BASELINES — POSITIVE and NEGATIVE share the same mobile form
// =====================================================================

/**
 * Baseline for APF Positive/Negative scenarios — 2026-04-19 rule:
 *   SEEN                 → form_type=POSITIVE, finalStatus ∈ {Positive, Refer}
 *   CONSTRUCTION IS STOP → form_type=NEGATIVE, finalStatus ∈ {Negative, Refer}
 *   PLOT IS VACANT       → form_type=NEGATIVE, finalStatus ∈ {Negative, Refer}
 *                          (agent-picked Positive is overridden server-side)
 */
function baselineApf(
  s: 'V1' | 'V2',
  mode: 'SEEN' | 'STOP' | 'VACANT',
  mobilePick: 'Positive' | 'Negative' | 'Refer',
): Record<string, unknown> {
  const v1 = s === 'V1';
  const activity =
    mode === 'SEEN'
      ? 'SEEN'
      : mode === 'STOP'
      ? 'CONSTRUCTION IS STOP'
      : 'PLOT IS VACANT';
  // Mobile: SEEN uses `finalStatus` field; STOP/VACANT use `finalStatusNegative`.
  // (Both map to DB column `final_status`.)
  const finalStatusField =
    mode === 'SEEN' ? 'finalStatus' : 'finalStatusNegative';
  const outcomeString =
    mode === 'SEEN' ? 'Positive' : 'Negative'; // outcome header (detector hint)

  const base: Record<string, unknown> = {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    constructionActivity: activity,
    locality: v1 ? 'Commercial' : 'Mixed',
    addressStructureColor: v1 ? 'White' : 'Cream',
    companyNameBoard: 'SIGHTED AS',
    nameOnBoard: `APF-${s}-${mode}-BOARD`,
    landmark1: v1 ? 'Near Mall' : 'Near Metro',
    landmark2: v1 ? 'Above Bank' : 'Opposite Hospital',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: mode === 'SEEN' ? 'Positive' : 'Negative',
    otherObservation: `APF-${s}-${mode}-OBS`,
    [finalStatusField]: mobilePick,
    verificationOutcome: outcomeString,
    outcome: outcomeString,
  };

  // SEEN captures met person (active site visit). STOP captures project
  // details + stop reason. VACANT captures the minimum — no project data.
  if (mode === 'SEEN') {
    base.metPerson = `APF-${s}-SEEN-MET`;
    base.designation = 'Manager';
    base.tpcMetPerson1 = 'Neighbour';
    base.nameOfTpc1 = `APF-${s}-SEEN-TPC1`;
    base.tpcConfirmation1 = 'Confirmed';
    base.tpcMetPerson2 = 'Security';
    base.nameOfTpc2 = `APF-${s}-SEEN-TPC2`;
    base.tpcConfirmation2 = 'Confirmed';
  }
  if (mode === 'STOP') {
    base.buildingStatus = v1 ? 'Opened' : 'Under Construction';
    base.activityStopReason = `APF-${s}-STOP-REASON`;
    base.projectName = `APF-${s}-STOP-PROJECT`;
    base.projectStartedDate = '2024-01-15';
    base.projectCompletionDate = '2026-12-31';
    base.totalWing = v1 ? '2' : '4';
    base.totalFlats = v1 ? '80' : '150';
    base.projectCompletionPercent = v1 ? '60' : '85';
    base.staffStrength = v1 ? '25' : '50';
    base.staffSeen = v1 ? '20' : '45';
    base.tpcMetPerson1 = 'Neighbour';
    base.nameOfTpc1 = `APF-${s}-STOP-TPC1`;
    base.tpcConfirmation1 = 'Confirmed';
    base.tpcMetPerson2 = 'Security';
    base.nameOfTpc2 = `APF-${s}-STOP-TPC2`;
    base.tpcConfirmation2 = 'Confirmed';
  }
  // VACANT: no project fields by mobile conditional rules.

  return base;
}

function baselineErt(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: v1 ? 'Good' : 'Average',
    buildingStatus: v1 ? 'Opened' : 'Under Construction',
    metPersonType: 'Security',
    nameOfMetPerson: `APF-ERT-${s}-MET`,
    metPersonConfirmation: 'Confirmed',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: `APF-ERT-${s}-TPC1`,
    tpcMetPerson2: 'Security',
    nameOfTpc2: `APF-ERT-${s}-TPC2`,
    locality: v1 ? 'Gated Society' : 'Commercial',
    companyNameBoard: 'SIGHTED AS',
    nameOnBoard: `APF-ERT-${s}-BOARD`,
    landmark1: v1 ? 'Near Airport' : 'Near Station',
    landmark2: v1 ? 'Above Cafe' : 'Opposite Theatre',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `APF-ERT-${s}-OBS`,
    finalStatus: 'Refer',
    verificationOutcome: 'Entry Restricted',
    outcome: 'Entry Restricted',
  };
}

function baselineUt(s: 'V1' | 'V2'): Record<string, unknown> {
  const v1 = s === 'V1';
  return {
    contactPerson: `APF-UT-${s}-PERSON`,
    callRemark: 'Did Not Pick Up Call',
    locality: v1 ? 'Remote' : 'Rural',
    landmark1: v1 ? 'Near Highway' : 'Near Bridge',
    landmark2: v1 ? 'Near Petrol Pump' : 'Near Toll',
    landmark3: v1 ? 'Near Bus Stop' : 'Near Railway',
    landmark4: v1 ? 'Near Temple' : 'Near Tower',
    dominatedArea: 'Not A Community Dominated',
    otherObservation: `APF-UT-${s}-OBS`,
    finalStatus: 'Negative',
    verificationOutcome: 'Untraceable',
    outcome: 'Untraceable',
  };
}

// =====================================================================
// DB→formData REMAP
// =====================================================================

function mapDbPosOrNeg(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    constructionActivity: r.construction_activity,
    activityStopReason: r.activity_stop_reason,
    buildingStatus: r.building_status,
    projectName: r.project_name,
    projectStartedDate: r.project_started_date,
    projectCompletionDate: r.project_completion_date,
    totalWing: r.total_wing,
    totalFlats: r.total_flats,
    projectCompletionPercent: r.project_completion_percentage,
    staffStrength: r.staff_strength,
    staffSeen: r.staff_seen,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcConfirmation1: r.tpc_confirmation1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    tpcConfirmation2: r.tpc_confirmation2,
    locality: r.locality,
    addressStructureColor: r.address_structure_color,
    companyNameBoard: r.company_name_board,
    nameOnBoard: r.name_on_board,
    landmark1: r.landmark1,
    landmark2: r.landmark2,
    politicalConnection: r.political_connection,
    dominatedArea: r.dominated_area,
    feedbackFromNeighbour: r.feedback_from_neighbour,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
    metPerson: r.met_person_name,
    designation: r.designation,
  };
}

function mapDbErt(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    buildingStatus: r.building_status,
    metPersonType: r.met_person_designation,
    nameOfMetPerson: r.name_of_met_person || r.met_person_name,
    metPersonConfirmation: r.met_person_confirmation,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    locality: r.locality,
    companyNameBoard: r.company_name_board,
    nameOnBoard: r.name_on_board,
    landmark1: r.landmark1,
    landmark2: r.landmark2,
    politicalConnection: r.political_connection,
    dominatedArea: r.dominated_area,
    feedbackFromNeighbour: r.feedback_from_neighbour,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
  };
}

function mapDbUt(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    contactPerson: r.contact_person,
    callRemark: r.call_remark,
    locality: r.locality,
    landmark1: r.landmark1,
    landmark2: r.landmark2,
    landmark3: r.landmark3,
    landmark4: r.landmark4,
    dominatedArea: r.dominated_area,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
  };
}

// =====================================================================
// PER-SCENARIO AUDIT HARNESS
// =====================================================================

interface ScenarioSpec {
  label: string;
  outcomeString: string;
  expectedFormType: string;
  expectedTemplateMarker: string;
  baseline: (s: 'V1' | 'V2') => Record<string, unknown>;
  mapDbToFormData: (r: Record<string, unknown>) => Record<string, unknown>;
  dbChecks: (r: Record<string, unknown>, s: 'V1' | 'V2') => Record<string, boolean>;
  renderChecks: (report: string) => Record<string, boolean>;
}

async function runScenario(spec: ScenarioSpec): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};
  log(`\n╔═ SCENARIO: ${spec.label} ═╗`);

  await resetTaskAll();
  const preIso = await captureIsolationBaseline();

  // V1
  const v1 = spec.baseline('V1');
  const v1Images = await buildImages(5, 1);
  const v1Res = await postForm(
    {
      formType: 'PROPERTY_APF',
      data: {
        outcome: spec.outcomeString,
        formData: v1,
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
    console.log(`  ❌ V1 body:`, JSON.stringify(v1Res.body).slice(0, 1000));
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
  const v2 = spec.baseline('V2');
  const v2Images = await buildImages(5, 1);
  const v2Res = await postForm(
    {
      formType: 'PROPERTY_APF',
      data: {
        outcome: spec.outcomeString,
        formData: v2,
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
    console.log(`  ❌ V2 body:`, JSON.stringify(v2Res.body).slice(0, 1000));
    return checks;
  }

  const row2 = await readLatest();
  if (!row2) {
    checks[`${spec.label} | V2 DB row`] = false;
    return checks;
  }
  const v2Db = spec.dbChecks(row2, 'V2');
  for (const [k, v] of Object.entries(v2Db)) checks[`${spec.label} | ${k}`] = v;

  // Isolation delta
  const postIso = await captureIsolationBaseline();
  checks[`${spec.label} | Isolation: residence delta=0`] = postIso.r - preIso.r === 0;
  checks[`${spec.label} | Isolation: office delta=0`] = postIso.o - preIso.o === 0;
  checks[`${spec.label} | Isolation: business delta=0`] = postIso.b - preIso.b === 0;
  checks[`${spec.label} | Isolation: builder delta=0`] = postIso.bl - preIso.bl === 0;
  checks[`${spec.label} | Isolation: NOC delta=0`] = postIso.n - preIso.n === 0;
  checks[`${spec.label} | Isolation: DSA delta=0`] = postIso.d - preIso.d === 0;
  checks[`${spec.label} | Isolation: PropInd delta=0`] = postIso.pi - preIso.pi === 0;

  // Render V2 — use the DB-stored outcome (reflects any backend overrides,
  // e.g. VACANT forcing NEGATIVE regardless of what the mobile sent).
  const renderOutcome =
    (typeof row2.verification_outcome === 'string' && row2.verification_outcome) ||
    spec.outcomeString;
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'PROPERTY_APF',
    outcome: renderOutcome,
    formData: spec.mapDbToFormData(row2),
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test APF Project Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');
  console.log(`\n----- V2 RENDER (${spec.label}) -----`);
  console.log(report);
  console.log('-----------------------------------');

  checks[`${spec.label} | Template marker = "${spec.expectedTemplateMarker}"`] =
    report.includes(spec.expectedTemplateMarker);
  checks[`${spec.label} | No unresolved {placeholders}`] =
    !/\{[A-Z][A-Za-z0-9_]+\}/.test(report);

  const rc = spec.renderChecks(report);
  for (const [k, v] of Object.entries(rc)) checks[`${spec.label} | ${k}`] = v;

  return checks;
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL HTTP TRACE — Property APF ALL OUTCOMES                        ║');
  console.log('║  Critical: POSITIVE vs NEGATIVE routing via finalStatus              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const allChecks: Record<string, boolean> = {};

  // SCENARIO 1 — SEEN (Positive path, analogous to Door Open)
  const seen = await runScenario({
    label: 'SEEN → POSITIVE',
    outcomeString: 'Positive',
    expectedFormType: 'POSITIVE',
    expectedTemplateMarker: 'Property APF Remark: POSITIVE',
    baseline: (s) => baselineApf(s, 'SEEN', 'Positive'),
    mapDbToFormData: mapDbPosOrNeg,
    dbChecks: (r, s) => ({
      [`${s} construction_activity=SEEN`]: r.construction_activity === 'SEEN',
      [`${s} met_person_name`]: r.met_person_name === `APF-${s}-SEEN-MET`,
      [`${s} designation=Manager`]: r.designation === 'Manager',
      [`${s} tpc_name1`]: r.tpc_name1 === `APF-${s}-SEEN-TPC1`,
      [`${s} name_on_board`]: r.name_on_board === `APF-${s}-SEEN-BOARD`,
      [`${s} other_observation`]: r.other_observation === `APF-${s}-SEEN-OBS`,
      [`${s} final_status=Positive`]: r.final_status === 'Positive',
      [`${s} verification_outcome contains 'Positive'`]:
        typeof r.verification_outcome === 'string' &&
        r.verification_outcome.includes('Positive'),
    }),
    renderChecks: (report) => ({
      'V2 met_person present': report.includes('APF-V2-SEEN-MET'),
      'V1 met_person absent': !report.includes('APF-V1-SEEN-MET'),
      'V2 name_on_board present': report.includes('APF-V2-SEEN-BOARD'),
      'V2 other_observation present': report.includes('APF-V2-SEEN-OBS'),
      'POSITIVE confirmation prose': /confirmed the project existence/i.test(report),
      'NOT NEGATIVE header': !/Property APF Remark: NEGATIVE/i.test(report),
      'Final_Status=Positive in conclusion': /marked as Positive/i.test(report),
      'Construction activity text SEEN': /Construction activity: SEEN/i.test(report),
    }),
  });
  Object.assign(allChecks, seen);

  // SCENARIO 2 — CONSTRUCTION IS STOP (Negative path, analogous to Door Locked)
  const stop = await runScenario({
    label: 'STOP → NEGATIVE',
    outcomeString: 'Negative',
    expectedFormType: 'NEGATIVE',
    expectedTemplateMarker: 'Property APF Remark: NEGATIVE',
    baseline: (s) => baselineApf(s, 'STOP', 'Negative'),
    mapDbToFormData: mapDbPosOrNeg,
    dbChecks: (r, s) => ({
      [`${s} construction_activity=STOP`]:
        r.construction_activity === 'CONSTRUCTION IS STOP',
      [`${s} project_name`]: r.project_name === `APF-${s}-STOP-PROJECT`,
      [`${s} activity_stop_reason`]: r.activity_stop_reason === `APF-${s}-STOP-REASON`,
      [`${s} final_status=Negative`]: r.final_status === 'Negative',
      [`${s} other_observation`]: r.other_observation === `APF-${s}-STOP-OBS`,
    }),
    renderChecks: (report) => ({
      'V2 project name present': report.includes('APF-V2-STOP-PROJECT'),
      'NEGATIVE header': /Property APF Remark: NEGATIVE/i.test(report),
      'NO POSITIVE confirmation prose':
        !/confirmed the project existence/i.test(report),
      'Final_Status=Negative': /marked as Negative/i.test(report),
      'Construction activity text STOP':
        /Construction activity: CONSTRUCTION IS STOP/i.test(report),
    }),
  });
  Object.assign(allChecks, stop);

  // SCENARIO 3 — PLOT IS VACANT with agent=Positive → RULE OVERRIDES to Negative
  const vacant = await runScenario({
    label: 'VACANT (agent=Positive) → RULE OVERRIDE → NEGATIVE',
    // Intentionally send outcome=Positive to prove the backend rule overrides
    // even when the detector's universal mapping sees a Positive signal.
    outcomeString: 'Positive',
    expectedFormType: 'NEGATIVE',
    expectedTemplateMarker: 'Property APF Remark: NEGATIVE',
    baseline: (s) => {
      // Force VACANT + mobile agent trying Positive (wrong pick).
      const b = baselineApf(s, 'VACANT', 'Negative'); // allowed value for the correct field
      // But the test's whole point is: agent attempted Positive. Simulate
      // that by also writing `finalStatus: 'Positive'` into the legacy
      // mobile field AND forcing the outer outcome strings to Positive.
      b.finalStatus = 'Positive';
      b.verificationOutcome = 'Positive';
      b.outcome = 'Positive';
      return b;
    },
    mapDbToFormData: mapDbPosOrNeg,
    dbChecks: (r, s) => ({
      [`${s} construction_activity=VACANT`]:
        r.construction_activity === 'PLOT IS VACANT',
      // Agent tried Positive → backend overrode to Negative
      [`${s} final_status=Negative (override applied)`]:
        r.final_status === 'Negative',
      [`${s} form_type=NEGATIVE (override applied)`]:
        r.form_type === 'NEGATIVE',
      [`${s} other_observation`]: r.other_observation === `APF-${s}-VACANT-OBS`,
    }),
    renderChecks: (report) => ({
      'NEGATIVE header (override enforced)':
        /Property APF Remark: NEGATIVE/i.test(report),
      'NOT POSITIVE header': !/Property APF Remark: POSITIVE/i.test(report),
      'Final_Status=Negative in conclusion': /marked as Negative/i.test(report),
      'Construction activity text VACANT':
        /Construction activity: PLOT IS VACANT/i.test(report),
    }),
  });
  Object.assign(allChecks, vacant);

  // SCENARIO 3 — ERT
  const ert = await runScenario({
    label: 'ERT',
    outcomeString: 'Entry Restricted',
    expectedFormType: 'ENTRY_RESTRICTED',
    expectedTemplateMarker: 'Property APF Remark: ENTRY RESTRICTED',
    baseline: baselineErt,
    mapDbToFormData: mapDbErt,
    dbChecks: (r, s) => ({
      [`${s} building_status`]: r.building_status === (s === 'V1' ? 'Opened' : 'Under Construction'),
      [`${s} met_person_designation (metPersonType)`]: r.met_person_designation === 'Security',
      [`${s} name_of_met_person`]: r.name_of_met_person === `APF-ERT-${s}-MET`,
      [`${s} met_person_confirmation`]: r.met_person_confirmation === 'Confirmed',
      [`${s} name_on_board`]: r.name_on_board === `APF-ERT-${s}-BOARD`,
      [`${s} other_observation`]: r.other_observation === `APF-ERT-${s}-OBS`,
      [`${s} final_status=Refer`]: r.final_status === 'Refer',
    }),
    renderChecks: (report) => ({
      'ERT prose: "entry…not allowed"': /entry to the given premises is not allowed/i.test(report),
      'V2 met person name present': report.includes('APF-ERT-V2-MET'),
      'V1 met person name absent': !report.includes('APF-ERT-V1-MET'),
      'V2 name_on_board present': report.includes('APF-ERT-V2-BOARD'),
      'V1 name_on_board absent': !report.includes('APF-ERT-V1-BOARD'),
      'V2 other_observation present': report.includes('APF-ERT-V2-OBS'),
      'V1 other_observation absent': !report.includes('APF-ERT-V1-OBS'),
      'Met_Person_Type label (Security) in report': /\(Security\)/.test(report),
    }),
  });
  Object.assign(allChecks, ert);

  // SCENARIO 4 — UNTRACEABLE
  const ut = await runScenario({
    label: 'UNTRACEABLE',
    outcomeString: 'Untraceable',
    expectedFormType: 'UNTRACEABLE',
    expectedTemplateMarker: 'Property APF Remark: UNTRACEABLE',
    baseline: baselineUt,
    mapDbToFormData: mapDbUt,
    dbChecks: (r, s) => ({
      [`${s} contact_person`]: r.contact_person === `APF-UT-${s}-PERSON`,
      [`${s} call_remark`]: r.call_remark === 'Did Not Pick Up Call',
      [`${s} landmark1`]: r.landmark1 === (s === 'V1' ? 'Near Highway' : 'Near Bridge'),
      [`${s} landmark3`]: r.landmark3 === (s === 'V1' ? 'Near Bus Stop' : 'Near Railway'),
      [`${s} landmark4`]: r.landmark4 === (s === 'V1' ? 'Near Temple' : 'Near Tower'),
      [`${s} other_observation`]: r.other_observation === `APF-UT-${s}-OBS`,
      [`${s} final_status=Negative`]: r.final_status === 'Negative',
    }),
    renderChecks: (report) => ({
      'UT prose: "incorrect and untraceable"': /incorrect and untraceable/i.test(report),
      'V2 landmark1 present': report.includes('Near Bridge'),
      'V2 landmark3 present': report.includes('Near Railway'),
      'V2 landmark4 present': report.includes('Near Tower'),
      'V1 landmark1 absent': !report.includes('Near Highway'),
      'V1 landmark3 absent': !report.includes('Near Bus Stop'),
      'V2 other_observation present': report.includes('APF-UT-V2-OBS'),
      'V1 other_observation absent': !report.includes('APF-UT-V1-OBS'),
      'Call_Remark helper: "call was not picked up"': /call was not picked up/i.test(report),
    }),
  });
  Object.assign(allChecks, ut);

  // ═══════════════════════════════════════════════════════════════════
  //  CRITICAL RULE CHECK: constructionActivity drives form_type
  // ═══════════════════════════════════════════════════════════════════
  log('CRITICAL CONSTRUCTION-ACTIVITY RULE VERIFICATION');
  allChecks['Rule | SEEN drove form_type=POSITIVE'] =
    seen['SEEN → POSITIVE | V1 form_type=POSITIVE'] === true;
  allChecks['Rule | STOP drove form_type=NEGATIVE'] =
    stop['STOP → NEGATIVE | V1 form_type=NEGATIVE'] === true;
  allChecks['Rule | VACANT drove form_type=NEGATIVE (agent override enforced)'] =
    vacant[
      'VACANT (agent=Positive) → RULE OVERRIDE → NEGATIVE | V1 form_type=NEGATIVE'
    ] === true;

  log('FINAL SUMMARY (all 5 scenarios)');
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
