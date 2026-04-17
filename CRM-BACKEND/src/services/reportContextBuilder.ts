import fs from 'fs/promises';
import path from 'path';
import { query } from '@/config/database';
import { config } from '@/config';
import { logger } from '@/config/logger';

/**
 * Report Context Builder
 *
 * Given a caseId (UUID or numeric public case_id), assembles the complete
 * context object passed to the Handlebars template. The shape below is the
 * stable contract that template authors depend on - additions are safe,
 * removals/renames are breaking changes.
 *
 * Design note: every photo (verification_attachments) is embedded as a
 * base64 data URI on the `url` field. This keeps the rendered HTML self-
 * contained so Puppeteer doesn't need HTTP access to the uploads folder
 * (which is currently served statically and would otherwise have to be
 * auth-bypassed for the render). Size overhead is real (~33% per image)
 * but acceptable for the RCU report workflow where a case has at most
 * ~25 photos.
 */

// ---------------------------------------------------------------------------
// Shape of the context exposed to Handlebars templates
// ---------------------------------------------------------------------------

export interface ReportClientContext {
  id: number;
  name: string;
  logoUrl: string | null;
  stampUrl: string | null;
  primaryColor: string | null;
  headerColor: string | null;
}

export interface ReportCaseContext {
  id: string;
  caseNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  customerCallingCode: string | null;
  panNumber: string | null;
  applicantType: string | null;
  backendContactNumber: string | null;
  trigger: string | null;
  priority: string | null;
  status: string | null;
  pincode: string | null;
  verificationOutcome: string | null;
  receivedDate: Date | null;
  completedDate: Date | null;
  formCompletionPercentage: number | null;
  totalTasksCount: number | null;
  completedTasksCount: number | null;
}

export interface ReportProductContext {
  id: number;
  name: string;
}

export interface ReportApplicantContext {
  id: string;
  name: string | null;
  mobile: string | null;
  role: string | null;
  panNumber: string | null;
}

export interface ReportAttachmentContext {
  id: number;
  verificationTaskId: string | null;
  photoType: string | null;
  filename: string;
  originalName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  latitude: number | null;
  longitude: number | null;
  captureTime: Date | null;
  createdAt: Date;
  // Base64 data URI (data:image/jpeg;base64,...). Null only if the file
  // was missing on disk - template authors should defensively `{{#if url}}`.
  url: string | null;
}

export interface ReportTaskContext {
  id: string;
  taskNumber: string | null;
  taskTitle: string | null;
  taskDescription: string | null;
  applicantType: string | null;
  verificationTypeId: number | null;
  verificationTypeName: string | null;
  status: string | null;
  verificationOutcome: string | null;
  priority: string | null;
  estimatedAmount: number | null;
  actualAmount: number | null;
  address: string | null;
  pincode: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedByName: string | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  reviewedAt: Date | null;
  attachments: ReportAttachmentContext[];
}

export interface ReportDataEntryContext {
  id: number;
  instanceIndex: number;
  instanceLabel: string;
  isCompleted: boolean;
  completedAt: Date | null;
  verificationTaskId: string | null;
  // The verification task this entry is linked to (if any). Denormalized
  // so templates can easily render "Residence Profile: <remarks>".
  verificationTypeName: string | null;
  templateId: number;
  templateVersion: number;
  data: Record<string, unknown>;
}

export interface ReportTotalsContext {
  totalTasks: number;
  completedTasks: number;
  positiveTasks: number;
  negativeTasks: number;
  tatDays: number | null;
  photoCount: number;
}

export interface ReportGenerationContext {
  generatedAt: Date;
  generatedByName: string | null;
  generatedById: string;
}

export interface ReportContext {
  client: ReportClientContext;
  product: ReportProductContext;
  case: ReportCaseContext;
  applicants: ReportApplicantContext[];
  tasks: ReportTaskContext[];
  dataEntries: ReportDataEntryContext[];
  totals: ReportTotalsContext;
  generation: ReportGenerationContext;
}

// ---------------------------------------------------------------------------
// Raw DB row shapes (internal)
// ---------------------------------------------------------------------------

interface CaseRow {
  id: string;
  caseNumber: number;
  clientId: number;
  productId: number;
  customerName: string | null;
  customerPhone: string | null;
  customerCallingCode: string | null;
  panNumber: string | null;
  applicantType: string | null;
  backendContactNumber: string | null;
  trigger: string | null;
  priority: string | null;
  status: string | null;
  pincode: string | null;
  verificationOutcome: string | null;
  createdAt: Date;
  completedAt: Date | null;
  formCompletionPercentage: number | null;
  totalTasksCount: number | null;
  completedTasksCount: number | null;
  clientName: string;
  logoUrl: string | null;
  stampUrl: string | null;
  primaryColor: string | null;
  headerColor: string | null;
  productName: string;
}

interface ApplicantRow {
  id: string;
  name: string | null;
  mobile: string | null;
  role: string | null;
  panNumber: string | null;
}

interface TaskRow {
  id: string;
  taskNumber: string | null;
  taskTitle: string | null;
  taskDescription: string | null;
  applicantType: string | null;
  verificationTypeId: number | null;
  verificationTypeName: string | null;
  status: string | null;
  verificationOutcome: string | null;
  priority: string | null;
  estimatedAmount: number | null;
  actualAmount: number | null;
  address: string | null;
  pincode: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedByName: string | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  reviewedAt: Date | null;
}

interface AttachmentRow {
  id: number;
  verificationTaskId: string | null;
  photoType: string | null;
  filename: string;
  originalName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  filePath: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  captureTime: Date | null;
  createdAt: Date;
}

interface DataEntryRow {
  id: number;
  instanceIndex: number;
  instanceLabel: string;
  isCompleted: boolean;
  completedAt: Date | null;
  verificationTaskId: string | null;
  templateId: number;
  templateVersion: number;
  data: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function isNumericString(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Resolve the given stored `file_path` to an absolute disk path, mirroring
 * the logic in verificationAttachmentController. Paths starting with `/`
 * are treated as relative to process.cwd(); bare relative paths are
 * resolved against the configured upload directory.
 */
function resolveAttachmentDiskPath(filePath: string): string {
  if (!filePath) {
    return '';
  }
  if (path.isAbsolute(filePath) && !filePath.startsWith('/uploads')) {
    return filePath;
  }
  if (filePath.startsWith('/')) {
    return path.join(process.cwd(), filePath);
  }
  return path.resolve(config.uploadPath, filePath);
}

// ---------------------------------------------------------------------------
// Branding asset cache
// ---------------------------------------------------------------------------

/**
 * In-memory mtime-keyed LRU cache for client branding assets (logo, stamp).
 *
 * These files change rarely (admin uploads a new logo once in a while) but
 * they are read on every PDF generation. Without this cache the system re-
 * reads and base64-encodes the same ~50 KB PNG hundreds of times per second
 * under load.
 *
 * Cache key = `${diskPath}|${mtimeMs}`. Stat is ~microseconds so we can
 * cheaply check freshness. When the upload controller replaces a file,
 * mtime changes and the next render transparently picks up the new value.
 *
 * Cap: 100 entries (5 clients × 2 assets × 10 historical versions) is
 * plenty. Entries are evicted in FIFO order (Map preserves insertion
 * order); this is strictly LRU on re-insert.
 */
const BRANDING_CACHE_MAX = 100;
const brandingCache = new Map<string, string>();

function brandingCacheGet(key: string): string | undefined {
  const hit = brandingCache.get(key);
  if (hit !== undefined) {
    // Touch to mark recently used (delete + re-insert preserves LRU semantics).
    brandingCache.delete(key);
    brandingCache.set(key, hit);
  }
  return hit;
}

function brandingCacheSet(key: string, value: string): void {
  if (brandingCache.size >= BRANDING_CACHE_MAX) {
    // Evict oldest entry (first insertion order).
    const firstKey = brandingCache.keys().next().value;
    if (firstKey !== undefined) {
      brandingCache.delete(firstKey);
    }
  }
  brandingCache.set(key, value);
}

const BRANDING_EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * Resolve a client branding URL (logo / stamp) into something Puppeteer
 * can render. Rules:
 *   - null / empty  → null
 *   - data: URI     → pass through unchanged (already self-contained)
 *   - http(s) URL   → pass through (Puppeteer will fetch; admin's choice)
 *   - any other     → treat as relative path, read from disk (cached by
 *                     path+mtime), base64 encode
 * Returns null on any filesystem failure so a broken logo path never aborts
 * PDF generation for the whole case.
 */
async function resolveBrandingAssetForPdf(storedUrl: string | null): Promise<string | null> {
  if (!storedUrl) {
    return null;
  }
  if (storedUrl.startsWith('data:')) {
    return storedUrl;
  }
  if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
    return storedUrl;
  }
  const diskPath = storedUrl.startsWith('/')
    ? path.join(process.cwd(), storedUrl)
    : path.resolve(config.uploadPath, storedUrl);

  // Cheap stat to key the cache on current mtime. If the file is missing,
  // fall through to fileToDataUri which logs and returns null.
  let mtimeMs: number | null = null;
  try {
    const st = await fs.stat(diskPath);
    mtimeMs = st.mtimeMs;
  } catch {
    // File missing - fall through; fileToDataUri will log and return null.
  }

  if (mtimeMs !== null) {
    const cacheKey = `${diskPath}|${mtimeMs}`;
    const cached = brandingCacheGet(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const ext = path.extname(diskPath).toLowerCase();
    const mime = BRANDING_EXT_MIME[ext] ?? 'image/png';
    const uri = await fileToDataUri(diskPath, mime);
    if (uri !== null) {
      brandingCacheSet(cacheKey, uri);
    }
    return uri;
  }

  // Stat failed - read with no caching (will also fail, logs a warning).
  const ext = path.extname(diskPath).toLowerCase();
  return fileToDataUri(diskPath, BRANDING_EXT_MIME[ext] ?? 'image/png');
}

/**
 * Read a file from disk, return as a data: URI. Returns null (never throws)
 * when the file is missing or unreadable so a missing file doesn't break
 * PDF generation for the whole case.
 */
async function fileToDataUri(diskPath: string, mimeType: string | null): Promise<string | null> {
  if (!diskPath) {
    return null;
  }
  try {
    const buf = await fs.readFile(diskPath);
    const effectiveMime = mimeType && mimeType.length > 0 ? mimeType : 'image/jpeg';
    return `data:${effectiveMime};base64,${buf.toString('base64')}`;
  } catch (err) {
    logger.warn('reportContextBuilder: attachment file unreadable', {
      diskPath,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute TAT (turn-around time) in days between receivedDate and
 * completedDate. Returns null if either is missing.
 */
function computeTatDays(receivedDate: Date | null, completedDate: Date | null): number | null {
  if (!receivedDate || !completedDate) {
    return null;
  }
  const diffMs = completedDate.getTime() - receivedDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return null;
  }
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildReportContextOptions {
  generatedById: string;
  generatedByName: string | null;
}

export class ReportCaseNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Case not found: ${identifier}`);
    this.name = 'ReportCaseNotFoundError';
  }
}

/**
 * Build the full Handlebars context for the given case identifier.
 * Accepts either the UUID `cases.id` or the numeric `cases.case_id`.
 */
export async function buildReportContext(
  caseIdentifier: string,
  options: BuildReportContextOptions
): Promise<ReportContext> {
  const trimmed = caseIdentifier.trim();
  if (!trimmed) {
    throw new ReportCaseNotFoundError(caseIdentifier);
  }

  // 1. Case + client + product (single join query)
  let caseRow: CaseRow | undefined;
  if (isUuid(trimmed)) {
    const res = await query<CaseRow>(
      `SELECT c.id, c.case_id AS case_number, c.client_id, c.product_id,
              c.customer_name, c.customer_phone, c.customer_calling_code, c.pan_number,
              c.applicant_type, c.backend_contact_number, c.trigger, c.priority, c.status,
              c.pincode, c.verification_outcome, c.created_at, c.completed_at,
              c.form_completion_percentage, c.total_tasks_count, c.completed_tasks_count,
              cl.name AS client_name, cl.logo_url, cl.stamp_url, cl.primary_color, cl.header_color,
              pr.name AS product_name
       FROM cases c
       JOIN clients cl ON cl.id = c.client_id
       JOIN products pr ON pr.id = c.product_id
       WHERE c.id = $1`,
      [trimmed]
    );
    caseRow = res.rows[0];
  } else if (isNumericString(trimmed)) {
    const res = await query<CaseRow>(
      `SELECT c.id, c.case_id AS case_number, c.client_id, c.product_id,
              c.customer_name, c.customer_phone, c.customer_calling_code, c.pan_number,
              c.applicant_type, c.backend_contact_number, c.trigger, c.priority, c.status,
              c.pincode, c.verification_outcome, c.created_at, c.completed_at,
              c.form_completion_percentage, c.total_tasks_count, c.completed_tasks_count,
              cl.name AS client_name, cl.logo_url, cl.stamp_url, cl.primary_color, cl.header_color,
              pr.name AS product_name
       FROM cases c
       JOIN clients cl ON cl.id = c.client_id
       JOIN products pr ON pr.id = c.product_id
       WHERE c.case_id = $1`,
      [Number(trimmed)]
    );
    caseRow = res.rows[0];
  }

  if (!caseRow) {
    throw new ReportCaseNotFoundError(caseIdentifier);
  }

  // 2. Applicants
  const applicantsRes = await query<ApplicantRow>(
    `SELECT id, name, mobile, role, pan_number
     FROM applicants
     WHERE case_id = $1
     ORDER BY created_at ASC`,
    [caseRow.id]
  );

  // 3. Verification tasks
  const tasksRes = await query<TaskRow>(
    `SELECT vt.id, vt.task_number, vt.task_title, vt.task_description, vt.applicant_type,
            vt.verification_type_id, vtype.name AS verification_type_name,
            vt.status, vt.verification_outcome, vt.priority,
            vt.estimated_amount, vt.actual_amount, vt.address, vt.pincode,
            vt.assigned_to, u_assigned.name AS assigned_to_name,
            u_assigned_by.name AS assigned_by_name,
            vt.assigned_at, vt.started_at, vt.completed_at, vt.reviewed_at
     FROM verification_tasks vt
     LEFT JOIN verification_types vtype ON vtype.id = vt.verification_type_id
     LEFT JOIN users u_assigned ON u_assigned.id = vt.assigned_to
     LEFT JOIN users u_assigned_by ON u_assigned_by.id = vt.assigned_by
     WHERE vt.case_id = $1
     ORDER BY vt.created_at ASC`,
    [caseRow.id]
  );

  // 4. Attachments (ONLY from mobile form submissions; exclude general
  // `attachments` table entries and exclude soft-deleted rows). Grouped
  // by task for context composition.
  const attachmentsRes = await query<AttachmentRow>(
    `SELECT id, verification_task_id, photo_type, filename, original_name,
            mime_type, file_size, file_path, gps_latitude, gps_longitude,
            capture_time, created_at
     FROM verification_attachments
     WHERE case_id = $1 AND deleted_at IS NULL
     ORDER BY verification_task_id NULLS LAST, created_at ASC`,
    [caseRow.id]
  );

  // Convert all attachment files to data URIs in parallel (bounded concurrency
  // via Promise.all since 25 images max per case is safe for Node's loop).
  const attachmentDataUris = await Promise.all(
    attachmentsRes.rows.map(row => {
      if (!row.filePath) {
        return Promise.resolve<string | null>(null);
      }
      return fileToDataUri(resolveAttachmentDiskPath(row.filePath), row.mimeType);
    })
  );

  const attachmentsByTask = new Map<string, ReportAttachmentContext[]>();
  // Include a bucket for task-less photos ('' key) so the template can still
  // render them if needed.
  for (let i = 0; i < attachmentsRes.rows.length; i += 1) {
    const row = attachmentsRes.rows[i];
    const ctx: ReportAttachmentContext = {
      id: row.id,
      verificationTaskId: row.verificationTaskId,
      photoType: row.photoType,
      filename: row.filename,
      originalName: row.originalName,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      latitude: toNumberOrNull(row.gpsLatitude),
      longitude: toNumberOrNull(row.gpsLongitude),
      captureTime: row.captureTime,
      createdAt: row.createdAt,
      url: attachmentDataUris[i],
    };
    const key = row.verificationTaskId ?? '';
    const bucket = attachmentsByTask.get(key);
    if (bucket) {
      bucket.push(ctx);
    } else {
      attachmentsByTask.set(key, [ctx]);
    }
  }

  // 5. Case data entries (with denormalized verification type name if linked)
  const entriesRes = await query<DataEntryRow>(
    `SELECT cde.id, cde.instance_index, cde.instance_label, cde.is_completed,
            cde.completed_at, cde.verification_task_id, cde.template_id,
            cde.template_version, cde.data
     FROM case_data_entries cde
     WHERE cde.case_id = $1
     ORDER BY cde.instance_index ASC`,
    [caseRow.id]
  );

  const taskIdToTypeName = new Map<string, string | null>();
  for (const t of tasksRes.rows) {
    taskIdToTypeName.set(t.id, t.verificationTypeName);
  }

  const dataEntries: ReportDataEntryContext[] = entriesRes.rows.map(row => ({
    id: row.id,
    instanceIndex: row.instanceIndex,
    instanceLabel: row.instanceLabel,
    isCompleted: row.isCompleted,
    completedAt: row.completedAt,
    verificationTaskId: row.verificationTaskId,
    verificationTypeName: row.verificationTaskId
      ? (taskIdToTypeName.get(row.verificationTaskId) ?? null)
      : null,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    data: row.data ?? {},
  }));

  // 6. Assemble tasks with their attachments attached
  const tasks: ReportTaskContext[] = tasksRes.rows.map(t => ({
    id: t.id,
    taskNumber: t.taskNumber,
    taskTitle: t.taskTitle,
    taskDescription: t.taskDescription,
    applicantType: t.applicantType,
    verificationTypeId: t.verificationTypeId,
    verificationTypeName: t.verificationTypeName,
    status: t.status,
    verificationOutcome: t.verificationOutcome,
    priority: t.priority,
    estimatedAmount: toNumberOrNull(t.estimatedAmount),
    actualAmount: toNumberOrNull(t.actualAmount),
    address: t.address,
    pincode: t.pincode,
    assignedToId: t.assignedTo,
    assignedToName: t.assignedToName,
    assignedByName: t.assignedByName,
    assignedAt: t.assignedAt,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    reviewedAt: t.reviewedAt,
    attachments: attachmentsByTask.get(t.id) ?? [],
  }));

  // 7. Totals
  const totals: ReportTotalsContext = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
    positiveTasks: tasks.filter(t => (t.verificationOutcome ?? '').toUpperCase() === 'POSITIVE')
      .length,
    negativeTasks: tasks.filter(t => (t.verificationOutcome ?? '').toUpperCase() === 'NEGATIVE')
      .length,
    tatDays: computeTatDays(caseRow.createdAt, caseRow.completedAt),
    photoCount: attachmentsRes.rows.length,
  };

  // Convert logo / stamp to data URIs in parallel so the rendered HTML is
  // self-contained (Puppeteer doesn't need to resolve /uploads via HTTP).
  // If the stored URL is already a data: URI we keep it as-is; external
  // http(s) URLs are passed through for Puppeteer to fetch.
  const [logoDataUri, stampDataUri] = await Promise.all([
    resolveBrandingAssetForPdf(caseRow.logoUrl),
    resolveBrandingAssetForPdf(caseRow.stampUrl),
  ]);

  return {
    client: {
      id: caseRow.clientId,
      name: caseRow.clientName,
      logoUrl: logoDataUri,
      stampUrl: stampDataUri,
      primaryColor: caseRow.primaryColor,
      headerColor: caseRow.headerColor,
    },
    product: {
      id: caseRow.productId,
      name: caseRow.productName,
    },
    case: {
      id: caseRow.id,
      caseNumber: caseRow.caseNumber,
      customerName: caseRow.customerName,
      customerPhone: caseRow.customerPhone,
      customerCallingCode: caseRow.customerCallingCode,
      panNumber: caseRow.panNumber,
      applicantType: caseRow.applicantType,
      backendContactNumber: caseRow.backendContactNumber,
      trigger: caseRow.trigger,
      priority: caseRow.priority,
      status: caseRow.status,
      pincode: caseRow.pincode,
      verificationOutcome: caseRow.verificationOutcome,
      receivedDate: caseRow.createdAt,
      completedDate: caseRow.completedAt,
      formCompletionPercentage: toNumberOrNull(caseRow.formCompletionPercentage),
      totalTasksCount: caseRow.totalTasksCount,
      completedTasksCount: caseRow.completedTasksCount,
    },
    applicants: applicantsRes.rows.map(a => ({
      id: a.id,
      name: a.name,
      mobile: a.mobile,
      role: a.role,
      panNumber: a.panNumber,
    })),
    tasks,
    dataEntries,
    totals,
    generation: {
      generatedAt: new Date(),
      generatedByName: options.generatedByName,
      generatedById: options.generatedById,
    },
  };
}
