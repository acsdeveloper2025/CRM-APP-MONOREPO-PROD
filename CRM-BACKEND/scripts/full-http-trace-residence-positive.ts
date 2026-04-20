/**
 * FULL HTTP PIPELINE TRACE — Residence POSITIVE (Door Open)
 *
 * Exercises the REAL mobile → API → DB → Backend → Report pipeline:
 *
 *   1. Upload 5 geo-tagged building photos + 1 selfie via
 *      POST /api/mobile/verification-tasks/:taskId/attachments (multipart)
 *   2. Submit V1 form via
 *      POST /api/mobile/verification-tasks/:taskId/forms (JSON)
 *      with full mandatory mobile-form payload
 *   3. Read DB — confirm V1 values in every mapped column, all required fields populated
 *   4. Upload 6 new attachments (new idempotency key → new rows)
 *   5. Submit V2 form with mutated sentinels (same task — creates second report row)
 *   6. Read DB — confirm V2 latest-row values, count rows
 *   7. Render report via templateReportService (Path-2 DB→render flow)
 *   8. Assert V2 sentinels present in render, V1 sentinels absent
 */

import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { templateReportService } from '../src/services/TemplateReportService';

// Generate a valid JPEG buffer (solid color) — the test files on disk are
// corrupt stubs that Sharp rejects with "premature end of JPEG image".
async function makeJpegBuffer(seed: number): Promise<Buffer> {
  const r = (seed * 37) % 256;
  const g = (seed * 79) % 256;
  const b = (seed * 113) % 256;
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r, g, b },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

const API = 'http://localhost:3000';
const TASK_ID = '877da91d-3a95-42cc-90c9-193be02bb4f6';
const CASE_ID = '5f814068-34d8-4679-a7ac-76c872211042';
const USER_ID = 'c9a680d9-cca9-4cd1-b500-54f301c11c7a';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://acs_user:acs_password@localhost:5432/acs_db',
});

// Generated with: jwt.sign({userId}, JWT_SECRET, {expiresIn:'24h'})
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjOWE2ODBkOS1jY2E5LTRjZDEtYjUwMC01NGYzMDFjMTFjN2EiLCJpYXQiOjE3NzY1NDI2NjUsImV4cCI6MTc3NjYyOTA2NX0.FgBXUmv1KWr23u_Eyutsd2gA4WVHZHlbBLUUbvGs2y0';

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'x-app-version': '2.0.0',
  'x-platform': 'ANDROID',
};

const UPLOAD_DIR = path.join(
  __dirname,
  '..',
  'uploads',
  'verification',
  'residence',
  '4d73e7f1-4443-463b-a4ce-2886cef1e827',
);

function log(title: string, obj?: unknown) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(70));
  if (obj !== undefined) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    console.log(s.length > 2000 ? s.slice(0, 2000) + '\n...[truncated]' : s);
  }
}

async function uploadAttachments(
  files: string[],
  photoType: 'building' | 'selfie',
  label: string,
): Promise<{ ids: string[]; response: unknown }> {
  const idempKey = `trace-upload-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`;

  const fd = new FormData();
  console.log(`  Attaching ${files.length} file(s) to FormData as photoType=${photoType}:`);
  let seedBase = Math.floor(Math.random() * 1000);
  for (const f of files) {
    // Generate a FRESH valid JPEG instead of reading corrupt disk stubs.
    seedBase += 1;
    const buf = await makeJpegBuffer(seedBase);
    console.log(`    - ${f} (${buf.length} bytes, generated)`);
    const blob = new Blob([buf], { type: 'image/jpeg' });
    fd.append('files', blob, f);
  }
  fd.append('verificationType', 'residence');
  fd.append('submissionId', `trace-sub-${Date.now()}`);
  fd.append(
    'geoLocation',
    JSON.stringify({ latitude: 19.1725, longitude: 72.9567, accuracy: 10 }),
  );
  fd.append('photoType', photoType);

  const res = await fetch(`${API}/api/mobile/verification-tasks/${TASK_ID}/attachments`, {
    method: 'POST',
    headers: { ...HEADERS, 'Idempotency-Key': idempKey },
    body: fd,
  });
  const body = await res.json();
  console.log(`  HTTP ${res.status} — response.data.attachments.length=${(body as { data?: { attachments?: unknown[] } }).data?.attachments?.length}`);
  if (!res.ok) {
    console.error(`Upload failed (${res.status}):`, JSON.stringify(body));
    throw new Error(`Upload ${photoType} failed`);
  }
  const ids = (body.data?.attachments || []).map((a: { id: string }) => a.id);
  return { ids, response: body };
}

async function submitForm(
  payload: Record<string, unknown>,
  label: string,
): Promise<{ status: number; body: unknown }> {
  const idempKey = `trace-submit-${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(`${API}/api/mobile/verification-tasks/${TASK_ID}/forms`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Idempotency-Key': idempKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function buildPayload(
  outcome: string,
  sentinels: {
    otherObservation: string;
    nameOnDoorPlate: string;
    stayingStatus: string;
    addressRating: string;
  },
  numBuilding: number,
  numSelfie: number,
): Promise<Record<string, unknown>> {
  // Real submit path: images[] entries each carry `dataUrl` (base64 data URL),
  // `type` (photo category), and `geoLocation`. Backend decodes, writes disk,
  // and creates verification_attachments row — see processVerificationImages
  // at controllers/mobileFormController.ts:698.
  const geo = { latitude: 19.1725, longitude: 72.9567, accuracy: 10 };
  const images: Record<string, unknown>[] = [];
  let seed = Math.floor(Math.random() * 1000);
  for (let i = 0; i < numBuilding + numSelfie; i++) {
    const buf = await makeJpegBuffer(++seed);
    const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
    images.push({
      dataUrl,
      type: i < numBuilding ? 'building' : 'selfie',
      geoLocation: geo,
    });
  }
  // Full real mobile payload for Residence POSITIVE Door Open — every required
  // mobile field from legacyPositiveResidenceFields (see LegacyFormTemplateBuilders.ts:544).
  // Composite value+unit pairs kept UNMERGED — preprocessCompositeFields on
  // backend handles merging.
  const formData = {
    addressLocatable: 'Easy to Locate',
    addressRating: sentinels.addressRating,
    houseStatus: 'Open',
    metPersonName: 'Nikhil Parab',
    metPersonRelation: 'Self',
    totalFamilyMembers: '4',
    totalEarning: '2',
    workingStatus: 'Salaried',
    companyName: 'ACS Pvt Ltd',
    stayingPeriodValue: '5',
    stayingPeriodUnit: 'Year',
    stayingStatus: sentinels.stayingStatus,
    approxArea: '850',
    documentShownStatus: 'Showed',
    documentType: 'Aadhar Card',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Mr. Shah',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    tpcName2: 'Rajesh',
    tpcConfirmation2: 'Confirmed',
    locality: 'Resi Building',
    addressStructure: '10',
    applicantStayingFloor: '4',
    addressStructureColor: 'White',
    doorColor: 'Brown',
    doorNamePlateStatus: 'SIGHTED AS',
    nameOnDoorPlate: sentinels.nameOnDoorPlate,
    societyNamePlateStatus: 'SIGHTED AS',
    nameOnSocietyBoard: 'Neptune Flying Colors',
    landmark1: 'Near Mulund Check Naka Bus Depot',
    landmark2: 'Above Croma Showroom',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: sentinels.otherObservation,
    finalStatus: 'Positive',
  };

  return {
    formType: 'RESIDENCE',
    data: {
      outcome,
      formData,
      geoLocation: geo,
      // `photos` is only used for geo-location validation (count + geo check).
      // `images` is what processVerificationImages consumes to persist files.
      photos: images.map((img) => ({
        type: img.type,
        geoLocation: img.geoLocation,
      })),
      images,
    },
  };
}

async function readLatestReport(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM residence_verification_reports
     WHERE verification_task_id=$1
     ORDER BY created_at DESC
     LIMIT 1`,
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

async function main() {
  log('PHASE 0 — Clean slate');
  await pool.query(
    `DELETE FROM residence_verification_reports WHERE verification_task_id=$1`,
    [TASK_ID],
  );
  await pool.query(
    `DELETE FROM verification_attachments WHERE verification_task_id=$1 AND submission_id LIKE 'trace-%'`,
    [TASK_ID],
  );
  // Restore task to ASSIGNED in case a prior run marked it COMPLETED
  await pool.query(
    `UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`,
    [TASK_ID],
  );
  console.log('  Cleaned. Task reset to ASSIGNED.');

  // ============== V1 ==============
  log('PHASE 1+2 — Submit V1 form (5 building + 1 selfie images inlined as base64)');
  const v1Sentinels = {
    otherObservation: 'TRACE-V1-OBS',
    nameOnDoorPlate: 'TRACE-V1-PLATE',
    stayingStatus: 'On a Self Owned Basis',
    addressRating: 'Good',
  };
  const v1Payload = await buildPayload('Positive & Door Open', v1Sentinels, 5, 1);
  // Log payload but redact the huge base64 dataUrls for readability
  const v1PayloadPreview = JSON.parse(JSON.stringify(v1Payload));
  interface ImgLite { dataUrl?: string }
  const preview1 = v1PayloadPreview as { data: { images: ImgLite[] } };
  if (preview1.data.images) {
    preview1.data.images = preview1.data.images.map((img: ImgLite) => ({
      ...img,
      dataUrl: `<base64 JPEG, ${img.dataUrl?.length} chars>`,
    }));
  }
  log('V1 REQUEST PAYLOAD (dataUrls redacted)', v1PayloadPreview);

  const v1Submit = await submitForm(v1Payload, 'v1');
  log(`V1 RESPONSE (HTTP ${v1Submit.status})`, v1Submit.body);

  if (v1Submit.status !== 200 && v1Submit.status !== 201) {
    console.error('V1 submit failed — cannot continue.');
    process.exit(1);
  }

  log('PHASE 3 — DB validation after V1');
  const row1 = await readLatestReport();
  const count1 = await countReports();
  console.log(`  Rows in residence_verification_reports for task: ${count1}`);
  if (!row1) {
    console.error('❌ No DB row after V1 submit — pipeline broken.');
    process.exit(1);
  }
  const v1DbCheck = {
    other_observation: row1.other_observation,
    name_on_door_plate: row1.name_on_door_plate,
    staying_status: row1.staying_status,
    address_rating: row1.address_rating,
    house_status: row1.house_status,
    met_person_name: row1.met_person_name,
    staying_period: row1.staying_period,
    customer_name: row1.customer_name,
    final_status: row1.final_status,
    form_type: row1.form_type,
  };
  log('V1 DB ROW (key fields)', v1DbCheck);

  const v1DbMatch = {
    'other_observation matches V1': row1.other_observation === v1Sentinels.otherObservation,
    'name_on_door_plate matches V1': row1.name_on_door_plate === v1Sentinels.nameOnDoorPlate,
    'staying_status matches V1': row1.staying_status === v1Sentinels.stayingStatus,
    'address_rating matches V1': row1.address_rating === v1Sentinels.addressRating,
    'staying_period composite merged (5 Year)': row1.staying_period === '5 Year',
    'house_status=Open': row1.house_status === 'Open',
    'final_status=Positive': row1.final_status === 'Positive',
    'form_type=POSITIVE': row1.form_type === 'POSITIVE',
  };
  log('V1 DB FIELD-BY-FIELD CHECK', v1DbMatch);

  // Verify attachments persisted
  const v1AttCount = await pool.query(
    `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE photo_type='selfie')::int AS selfies FROM verification_attachments WHERE verification_task_id=$1::uuid AND created_at > NOW() - INTERVAL '2 minutes'`,
    [TASK_ID],
  );
  log('V1 ATTACHMENT PERSISTENCE (rows inserted by submit flow)', v1AttCount.rows[0]);

  // ============== V2 ==============
  // Reset task to allow re-submission (first submit marked it COMPLETED)
  await pool.query(
    `UPDATE verification_tasks SET status='ASSIGNED' WHERE id=$1`,
    [TASK_ID],
  );
  console.log('  Task reset: COMPLETED → ASSIGNED (allowed via seeded transitions)');

  log('PHASE 4+5 — Submit V2 with MUTATED sentinels + NEW inline images');
  const v2Sentinels = {
    otherObservation: 'TRACE-V2-OBS',
    nameOnDoorPlate: 'TRACE-V2-PLATE',
    stayingStatus: 'On a Rented Basis',
    addressRating: 'Average',
  };
  const v2Payload = await buildPayload('Positive & Door Open', v2Sentinels, 5, 1);
  const v2Submit = await submitForm(v2Payload, 'v2');
  log(`V2 RESPONSE (HTTP ${v2Submit.status})`, v2Submit.body);

  log('PHASE 6 — DB validation after V2');
  const row2 = await readLatestReport();
  const count2 = await countReports();
  console.log(`  Total rows after V2: ${count2} (expect 2 — V1 row still present, V2 latest)`);
  const v2DbCheck = {
    other_observation: row2?.other_observation,
    name_on_door_plate: row2?.name_on_door_plate,
    staying_status: row2?.staying_status,
    address_rating: row2?.address_rating,
  };
  log('V2 LATEST DB ROW (key fields)', v2DbCheck);

  const v2DbMatch = {
    'other_observation is V2': row2?.other_observation === v2Sentinels.otherObservation,
    'name_on_door_plate is V2': row2?.name_on_door_plate === v2Sentinels.nameOnDoorPlate,
    'staying_status is V2': row2?.staying_status === v2Sentinels.stayingStatus,
    'address_rating is V2': row2?.address_rating === v2Sentinels.addressRating,
    'latest row is NOT V1 values': row2?.other_observation !== v1Sentinels.otherObservation,
  };
  log('V2 DB FIELD-BY-FIELD CHECK', v2DbMatch);

  // ============== RENDER REPORT ==============
  log('PHASE 7 — Render report from latest DB row (simulates API report endpoint)');
  // Build formData from the DB row — MIRRORS the real controller remap at
  // templateReportsController.ts:146-207 (not naïve snake→camel; some column
  // names split differently: door_nameplate_status → doorNamePlateStatus with
  // capital P in "Plate", society_nameplate_status → societyNamePlateStatus).
  const r = row2 as Record<string, unknown>;
  const formDataFromDb: Record<string, unknown> = {
    customerName: r.customer_name,
    addressLocatable: r.address_locatable,
    addressRating: r.address_rating,
    houseStatus: r.house_status,
    metPersonName: r.met_person_name,
    metPersonRelation: r.met_person_relation,
    stayingPeriod: r.staying_period,
    stayingStatus: r.staying_status,
    totalFamilyMembers: r.total_family_members,
    totalEarningMember: r.total_earning_member,
    workingStatus: r.working_status,
    companyName: r.company_name,
    approxArea: r.approx_area,
    doorNamePlateStatus: r.door_nameplate_status, // Note capital P
    nameOnDoorPlate: r.name_on_door_plate,
    societyNamePlateStatus: r.society_nameplate_status,
    nameOnSocietyBoard: r.name_on_society_board,
    locality: r.locality,
    addressStructure: r.address_structure,
    applicantStayingFloor: r.applicant_staying_floor,
    addressStructureColor: r.address_structure_color,
    doorColor: r.door_color,
    documentType: r.document_type,
    tpcMetPerson1: r.tpc_met_person1,
    nameOfTpc1: r.tpc_name1,
    tpcConfirmation1: r.tpc_confirmation1,
    tpcMetPerson2: r.tpc_met_person2,
    nameOfTpc2: r.tpc_name2,
    tpcConfirmation2: r.tpc_confirmation2,
    landmark1: r.landmark1,
    landmark2: r.landmark2,
    dominatedArea: r.dominated_area,
    feedbackFromNeighbour: r.feedback_from_neighbour,
    politicalConnection: r.political_connection,
    otherObservation: r.other_observation,
    finalStatus: r.final_status,
  };
  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'RESIDENCE',
    outcome: 'POSITIVE',
    formData: formDataFromDb,
    caseDetails: {
      caseId: CASE_ID,
      customerName: String(row2?.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Address',
    },
  });
  const report = rendered.success ? (rendered.report ?? '') : rendered.error ?? '';
  log('RENDERED REPORT', report);

  const renderCheck = {
    'V2 other_observation appears in report': report.includes(v2Sentinels.otherObservation),
    'V1 other_observation ABSENT (no stale)': !report.includes(v1Sentinels.otherObservation),
    'V2 name_on_door_plate appears': report.includes(v2Sentinels.nameOnDoorPlate),
    'V1 name_on_door_plate ABSENT': !report.includes(v1Sentinels.nameOnDoorPlate),
    'V2 address_rating appears': report.includes(v2Sentinels.addressRating),
    'V1 address_rating ABSENT (Good vs Average)': !report.includes('rated as Good'),
    'V2 staying_status appears (case-insens)': report.toLowerCase().includes('on a rented basis'),
    'V1 staying_status ABSENT': !report.toLowerCase().includes('on a self owned basis'),
  };
  log('V2 RENDER FIELD-BY-FIELD CHECK', renderCheck);

  // ============== SUMMARY ==============
  log('FINAL SUMMARY');
  const allChecks = { ...v1DbMatch, ...v2DbMatch, ...renderCheck };
  const passed = Object.values(allChecks).filter(Boolean).length;
  const total = Object.keys(allChecks).length;
  console.log(`  ${passed}/${total} checks passed.`);
  if (passed !== total) {
    console.log('  Failing checks:');
    for (const [k, v] of Object.entries(allChecks)) if (!v) console.log(`    ❌ ${k}`);
  }

  await pool.end();
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Full HTTP trace failed:', err);
  process.exit(1);
});
