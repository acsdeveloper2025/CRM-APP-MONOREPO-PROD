/**
 * FULL HTTP PIPELINE TRACE — Office (all 5 outcomes): Positive, Shifted, NSP, ERT, Untraceable
 *
 * For each outcome:
 *   1. Reset task + clear reports
 *   2. POST V1 via real HTTP /api/mobile/verification-tasks/:taskId/forms
 *      with formType=OFFICE, full mandatory payload, 5 building + 1 selfie base64
 *   3. Read DB → assert V1 sentinels landed
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
      'Idempotency-Key': `trace-ofc-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function readLatestReport(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM office_verification_reports WHERE verification_task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [TASK_ID],
  );
  return rows[0] || null;
}

async function countReports(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM office_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  return rows[0].n;
}

async function resetTask(): Promise<void> {
  await pool.query(
    `DELETE FROM office_verification_reports WHERE verification_task_id=$1`,
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
  await pool.query(
    `UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`,
    [TASK_ID],
  );
}

type Outcome = {
  name: string;
  outcome: string;
  formTypeExpected: string;
  templateOutcomeKey: string;
  baseline: () => Record<string, unknown>;
  mutate: () => Record<string, unknown>;
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

// ======== baselines per outcome ========

function posBaseline(suffix: 'V1' | 'V2'): Record<string, unknown> {
  const isV1 = suffix === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: isV1 ? 'Good' : 'Average',
    officeStatus: 'Open',
    metPerson: `TRACE-${suffix}-PERSON`,
    designation: isV1 ? 'Manager' : 'Director',
    workingPeriodValue: isV1 ? '3' : '7',
    workingPeriodUnit: 'Year',
    applicantDesignation: 'Software Engineer',
    workingStatus: 'Company Payroll',
    applicantWorkingPremises: 'Same Location',
    sittingLocation: '',
    officeType: 'PVT. LTD. Company',
    companyNatureOfBusiness: 'IT Services',
    staffStrength: '50',
    staffSeen: '30',
    officeApproxArea: '2000',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: `TRACE-${suffix}-COMPANY`,
    documentShown: 'PAN Card',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    establishmentPeriodValue: isV1 ? '5' : '10',
    establishmentPeriodUnit: 'Year',
    locality: 'Commercial',
    addressStructure: '8',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    landmark1: 'Near Metro',
    landmark2: 'Above Mall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: `TRACE-${suffix}-OBS`,
    finalStatus: 'Positive',
  };
}

function shiftedBaseline(suffix: 'V1' | 'V2'): Record<string, unknown> {
  const isV1 = suffix === 'V1';
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: isV1 ? 'Good' : 'Average',
    officeStatus: 'Open',
    metPerson: `TRACE-${suffix}-PERSON`,
    designation: isV1 ? 'Manager' : 'Director',
    currentCompanyName: `TRACE-${suffix}-COMPANY`,
    currentCompanyPeriodValue: isV1 ? '2' : '5',
    currentCompanyPeriodUnit: 'Year',
    oldOfficeShiftedPeriodValue: isV1 ? '8' : '14',
    oldOfficeShiftedPeriodUnit: 'Month',
    officeApproxArea: '1500',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: `TRACE-${suffix}-NEWBOARD`,
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Commercial',
    addressStructure: '8',
    addressStructureColor: 'White',
    doorColor: 'Grey',
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
    officeStatus: 'Open',
    officeExistence: 'Office Exist At',
    currentCompanyName: `TRACE-${suffix}-COMPANY`,
    metPerson: `TRACE-${suffix}-PERSON`,
    designation: isV1 ? 'HR Manager' : 'Director',
    companyNamePlateStatus: 'SIGHTED AS',
    nameOnBoard: `TRACE-${suffix}-BOARD`,
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Shah',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rajesh',
    locality: 'Commercial',
    addressStructure: '8',
    addressStructureColor: 'White',
    doorColor: 'Grey',
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
    metPersonType: isV1 ? 'Security' : 'Receptionist',
    nameOfMetPerson: `TRACE-${suffix}-PERSON`,
    metPersonConfirmation: 'Confirmed',
    applicantWorkingStatus: 'Applicant is Working At',
    officeStatus: 'Office Exist At',
    locality: 'Commercial',
    addressStructure: '8',
    officeExistFloor: '2',
    addressStructureColor: 'White',
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
    locality: isV1 ? 'Commercial' : 'Industrial',
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
    name: 'POSITIVE (Door Open)',
    outcome: 'Positive & Door Open',
    formTypeExpected: 'POSITIVE',
    templateOutcomeKey: 'POSITIVE',
    baseline: () => posBaseline('V1'),
    mutate: () => posBaseline('V2'),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=POSITIVE`]: row.form_type === 'POSITIVE',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} working_period composite merged (X Year)`]:
        typeof row.working_period === 'string' && (row.working_period as string).includes('Year'),
      [`${phase} establishment_period composite merged`]:
        typeof row.establishment_period === 'string' && (row.establishment_period as string).includes('Year'),
      [`${phase} name_on_board`]: row.name_on_board === s.company,
      [`${phase} met_person_name`]: row.met_person_name === s.person,
      [`${phase} address_rating=${s.rating}`]: row.address_rating === s.rating,
      [`${phase} designation=${s.design}`]: row.designation === s.design,
      [`${phase} office_status=Open`]: row.office_status === 'Open',
      [`${phase} final_status=Positive`]: row.final_status === 'Positive',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 company board in report': report.includes(v2.company),
      'V1 company board absent': !report.includes(v1.company),
      'V2 designation appears (lowercased mid-sentence)':
        report.toLowerCase().includes(v2.design.toLowerCase()),
      'V2 address_rating in report': report.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !report.includes(`rated as ${v1.rating}`),
      'V2 working_period pluralized': /7\s+Years/i.test(report),
      'V1 working_period absent': !/3\s+Years/i.test(report),
      'V2 establishment_period pluralized': /10\s+Years/i.test(report),
      'V1 establishment_period absent': !/5\s+Years/i.test(report),
    }),
  },
  {
    name: 'SHIFTED (Door Open)',
    outcome: 'Shifted & Door Open',
    formTypeExpected: 'SHIFTED',
    templateOutcomeKey: 'SHIFTED',
    baseline: () => shiftedBaseline('V1'),
    mutate: () => shiftedBaseline('V2'),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=SHIFTED`]: row.form_type === 'SHIFTED',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} current_company_name`]: row.current_company_name === s.company,
      [`${phase} old_office_shifted_period composite merged (Month)`]:
        typeof row.old_office_shifted_period === 'string' && (row.old_office_shifted_period as string).includes('Month'),
      [`${phase} current_company_period composite merged (Year)`]:
        typeof row.current_company_period === 'string' && (row.current_company_period as string).includes('Year'),
      [`${phase} met_person_name`]: row.met_person_name === s.person,
      [`${phase} address_rating=${s.rating}`]: row.address_rating === s.rating,
      [`${phase} office_status=Open`]: row.office_status === 'Open',
      [`${phase} final_status=Refer`]: row.final_status === 'Refer',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 current_company_name in report': report.includes(v2.company),
      'V1 current_company_name absent': !report.includes(v1.company),
      'V2 address_rating in report': report.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !report.includes(`rated as ${v1.rating}`),
      'V2 old_office_shifted_period pluralized': /14\s+Months/i.test(report),
      'V1 old_office_shifted_period absent': !/8\s+Months/i.test(report),
      'V2 current_company_period pluralized': /5\s+Years/i.test(report),
      'V1 current_company_period absent': !/2\s+Years/i.test(report),
    }),
  },
  {
    name: 'NSP (Door Open)',
    outcome: 'NSP & Door Open',
    formTypeExpected: 'NSP',
    templateOutcomeKey: 'NSP',
    baseline: () => nspBaseline('V1'),
    mutate: () => nspBaseline('V2'),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=NSP`]: row.form_type === 'NSP',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} current_company_name`]: row.current_company_name === s.company,
      [`${phase} met_person_name`]: row.met_person_name === s.person,
      [`${phase} address_rating=${s.rating}`]: row.address_rating === s.rating,
      [`${phase} designation=${s.design}`]: row.designation === s.design,
      [`${phase} office_status=Open`]: row.office_status === 'Open',
      [`${phase} final_status=Negative`]: row.final_status === 'Negative',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 current_company_name in report': report.includes(v2.company),
      'V1 current_company_name absent': !report.includes(v1.company),
      'V2 address_rating in report': report.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !report.includes(`rated as ${v1.rating}`),
    }),
  },
  {
    name: 'ERT',
    outcome: 'Entry Restricted',
    formTypeExpected: 'ENTRY_RESTRICTED',
    templateOutcomeKey: 'ERT',
    baseline: () => ertBaseline('V1'),
    mutate: () => ertBaseline('V2'),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=ENTRY_RESTRICTED`]: row.form_type === 'ENTRY_RESTRICTED',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} name_of_met_person`]: row.name_of_met_person === s.person,
      [`${phase} met_person_type present`]: typeof row.met_person_type === 'string',
      [`${phase} applicant_working_status=Working At`]:
        row.applicant_working_status === 'Applicant is Working At',
      [`${phase} address_rating=${s.rating}`]: row.address_rating === s.rating,
      [`${phase} final_status=Refer`]: row.final_status === 'Refer',
    }),
    renderCheck: (report, v1, v2) => ({
      'V2 other_observation in report': report.includes(v2.obs),
      'V1 other_observation absent': !report.includes(v1.obs),
      'V2 name_of_met_person in report': report.includes(v2.person),
      'V1 name_of_met_person absent': !report.includes(v1.person),
      'V2 address_rating in report': report.includes(`rated as ${v2.rating}`),
      'V1 address_rating absent': !report.includes(`rated as ${v1.rating}`),
      'applicant_working_status helper rendered':
        /the applicant is working at the given address/i.test(report),
    }),
  },
  {
    name: 'UNTRACEABLE',
    outcome: 'Untraceable',
    formTypeExpected: 'UNTRACEABLE',
    templateOutcomeKey: 'UNTRACEABLE',
    baseline: () => untBaseline('V1'),
    mutate: () => untBaseline('V2'),
    numBuilding: 5,
    numSelfie: 1,
    dbCheck: (row, phase, s) => ({
      [`form_type=UNTRACEABLE`]: row.form_type === 'UNTRACEABLE',
      [`${phase} other_observation`]: row.other_observation === s.obs,
      [`${phase} contact_person`]: row.contact_person === s.contact,
      [`${phase} call_remark present`]: typeof row.call_remark === 'string',
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
      'callRemarkText helper active':
        /the call was not picked up|the customer refused to guide/i.test(report),
    }),
  },
];

function mapDbRowToFormData(r: Record<string, unknown>): Record<string, unknown> {
  return {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    officeStatus: r.office_status,
    metPersonName: r.met_person_name,
    designation: r.designation,
    workingPeriod: r.working_period,
    applicantDesignation: r.applicant_designation,
    workingStatus: r.working_status,
    applicantWorkingPremises: r.applicant_working_premises,
    sittingLocation: r.sitting_location,
    officeType: r.office_type,
    companyNatureOfBusiness: r.company_nature_of_business,
    staffStrength: r.staff_strength,
    staffSeen: r.staff_seen,
    officeApproxArea: r.office_approx_area,
    companyNamePlateStatus: r.company_nameplate_status,
    nameOnBoard: r.name_on_board,
    nameOnBoard: r.name_on_board,
    establishmentPeriod: r.establishment_period,
    currentCompanyName: r.current_company_name,
    currentCompanyPeriod: r.current_company_period,
    oldOfficeShiftedPeriod: r.old_office_shifted_period,
    officeExistence: r.office_existence,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcConfirmation1: r.tpc_confirmation1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    tpcConfirmation2: r.tpc_confirmation2,
    locality: r.locality,
    addressStructure: r.address_structure,
    addressFloor: r.address_floor,
    addressStructureColor: r.address_structure_color,
    doorColor: r.door_color,
    landmark1: r.landmark1,
    landmark2: r.landmark2,
    landmark3: r.landmark3,
    landmark4: r.landmark4,
    nameOfMetPerson: r.name_of_met_person,
    metPersonType: r.met_person_type,
    metPersonConfirmation: r.met_person_confirmation,
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

async function runOutcome(o: Outcome): Promise<{ name: string; checks: Record<string, boolean> }> {
  console.log(`\n${'═'.repeat(70)}\n  CASE: Office → ${o.name}\n${'═'.repeat(70)}`);

  const allChecks: Record<string, boolean> = {};
  await resetTask();

  const { rows: preRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  const attBefore = preRows[0].n as number;

  const v1FormData = {
    ...o.baseline(),
    verificationOutcome: o.outcome,
    outcome: o.outcome,
  };
  const v1Images = await buildImages(o.numBuilding, o.numSelfie);
  const v1Payload = {
    formType: 'OFFICE',
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

  const row1 = await readLatestReport();
  if (!row1) {
    allChecks['V1 DB row inserted'] = false;
    return { name: o.name, checks: allChecks };
  }
  allChecks['V1 DB row inserted'] = true;

  const v1Sentinels = {
    obs: 'TRACE-V1-OBS',
    company: 'TRACE-V1-COMPANY',
    person: 'TRACE-V1-PERSON',
    contact: 'TRACE-V1-CONTACT',
    rating: v1FormData.addressRating as string,
    design: (v1FormData.designation as string) || '',
    locality: (v1FormData.locality as string) || '',
  };
  Object.assign(allChecks, o.dbCheck(row1, 'v1', v1Sentinels));

  const { rows: postV1Rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_attachments WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  allChecks['V1 images delta=6 (5 building + 1 selfie)'] = (postV1Rows[0].n as number) - attBefore === 6;

  // === V2 ===
  await resetTaskForV2();
  const v2FormData = {
    ...o.mutate(),
    verificationOutcome: o.outcome,
    outcome: o.outcome,
  };
  const v2Images = await buildImages(o.numBuilding, o.numSelfie);
  const v2Payload = {
    formType: 'OFFICE',
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
    company: 'TRACE-V2-COMPANY',
    person: 'TRACE-V2-PERSON',
    contact: 'TRACE-V2-CONTACT',
    rating: v2FormData.addressRating as string,
    design: (v2FormData.designation as string) || '',
    locality: (v2FormData.locality as string) || '',
  };
  Object.assign(allChecks, o.dbCheck(row2, 'v2', v2Sentinels));
  allChecks['Latest row NOT V1 other_observation'] = row2.other_observation !== v1Sentinels.obs;

  const formDataFromDb = mapDbRowToFormData(row2);
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'OFFICE',
    outcome: o.templateOutcomeKey,
    formData: formDataFromDb,
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Office Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : (rendered.error ?? '');

  Object.assign(allChecks, o.renderCheck(report, v1Sentinels, v2Sentinels));

  console.log('\n  Rendered V2 report (excerpt):');
  console.log(report.split('\n').slice(0, 6).map((l) => `    ${l}`).join('\n'));

  return { name: o.name, checks: allChecks };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL HTTP TRACE — Office (all 5 outcomes, V1 + V2 mutation each)   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const results: { name: string; checks: Record<string, boolean> }[] = [];
  for (const o of OUTCOMES) {
    try {
      results.push(await runOutcome(o));
    } catch (err) {
      console.log(`  ❌ ${o.name} — threw:`, err);
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
    if (!ok) for (const [k, v] of Object.entries(r.checks)) if (!v) console.log(`      ❌ ${k}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`  OVERALL: ${overallPass}/${overallTotal} checks passed across all 5 outcomes`);
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
