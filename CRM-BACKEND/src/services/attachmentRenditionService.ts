/**
 * Attachment rendition pipeline.
 *
 * Mobile previews everything in-app (no external app handoff per user
 * directive — attachments must not be downloadable / screenshottable),
 * but mobile only has two viewers: react-native-pdf for PDFs and the
 * existing WebView-based ZoomableImage for images. Anything that isn't
 * one of those (Office docs, TIFF, HEIC) must be normalized to a viewable
 * rendition on the backend.
 *
 * - Office docs (.doc/.docx/.xls/.xlsx/.ppt/.pptx) → PDF via LibreOffice
 *   headless. Mobile renders the PDF rendition with react-native-pdf.
 * - Legacy / mobile-uncommon images (.tif/.tiff/.heic/.heif) → JPEG via
 *   sharp. Mobile renders the JPEG rendition with ZoomableImage.
 * - PDFs and standard images (.jpg/.jpeg/.png/.gif/.webp/.svg/.bmp) need
 *   no rendition — mobile views the original directly.
 *
 * Renditions are generated synchronously during upload (LibreOffice is
 * 2-5 s for typical office docs, sharp is sub-second). On environments
 * where LibreOffice is missing (local dev) the call falls back to
 * `rendition_status='failed'` and the upload still succeeds — preview
 * for that file simply won't work locally.
 *
 * The content endpoint (mobileAttachmentController.getAttachmentContent)
 * also has an on-demand path: if a row was inserted before this service
 * existed (or a rendition failed transiently) and the file's mime needs
 * one, the endpoint generates the rendition lazily on first preview. That
 * removes the need for a separate backfill batch — the rendition cache
 * fills itself as users open older attachments.
 */

import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { logger } from '@/config/logger';

const execFileAsync = promisify(execFile);

// LibreOffice headless conversion can stall on malformed input. Cap so a
// hung subprocess never holds an upload-thread or content-request open.
const LIBREOFFICE_TIMEOUT_MS = 60_000;

// Office file extensions handled by LibreOffice. The list mirrors the
// upload validator's accepted extensions; dropped formats here would be
// rejected at upload anyway.
const OFFICE_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.rtf',
]);

// Image formats sharp can read but mobile WebView <img> tags often can't
// render natively. Sharp normalizes them to baseline JPEG for the
// ZoomableImage viewer.
const IMAGE_RENDITION_EXTENSIONS = new Set(['.tif', '.tiff', '.heic', '.heif']);

const OFFICE_MIME_PREFIXES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument',
  'application/rtf',
];

const IMAGE_RENDITION_MIMES = new Set(['image/tiff', 'image/heic', 'image/heif']);

export type RenditionKind = 'pdf' | 'jpeg';

export interface RenditionResult {
  kind: RenditionKind | null;
  absolutePath: string | null;
  relativePath: string | null;
  status: 'success' | 'failed' | 'not_required';
  error?: string;
}

const lowerExt = (filename: string): string => path.extname(filename).toLowerCase();

const matchesPrefix = (mime: string | null | undefined, prefixes: string[]): boolean => {
  if (!mime) {
    return false;
  }
  const lower = mime.toLowerCase();
  return prefixes.some(prefix => lower.startsWith(prefix));
};

export const needsPdfRendition = (
  mimeType: string | null | undefined,
  filename: string
): boolean => {
  if (OFFICE_EXTENSIONS.has(lowerExt(filename))) {
    return true;
  }
  return matchesPrefix(mimeType, OFFICE_MIME_PREFIXES);
};

export const needsImageRendition = (
  mimeType: string | null | undefined,
  filename: string
): boolean => {
  if (IMAGE_RENDITION_EXTENSIONS.has(lowerExt(filename))) {
    return true;
  }
  if (mimeType && IMAGE_RENDITION_MIMES.has(mimeType.toLowerCase())) {
    return true;
  }
  return false;
};

export const requiresRendition = (
  mimeType: string | null | undefined,
  filename: string
): RenditionKind | null => {
  if (needsPdfRendition(mimeType, filename)) {
    return 'pdf';
  }
  if (needsImageRendition(mimeType, filename)) {
    return 'jpeg';
  }
  return null;
};

const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

/**
 * Convert an office document to PDF using LibreOffice headless.
 * Resolved file path on success; throws on failure.
 *
 * `--outdir` writes a sibling file with `.pdf` extension to the chosen
 * directory. We control naming by writing to a unique sibling subfolder
 * so renditions for files with collision-prone names stay isolated.
 */
const convertToPdf = async (sourcePath: string, destPath: string): Promise<void> => {
  const destDir = path.dirname(destPath);
  await ensureDir(destDir);

  // LibreOffice writes <basename>.pdf to outdir, ignoring our destination
  // filename. Run it into a temp staging dir, then move into place.
  const stagingDir = path.join(destDir, '.staging');
  await ensureDir(stagingDir);

  const sourceBase = path.basename(sourcePath, path.extname(sourcePath));
  const stagedOutput = path.join(stagingDir, `${sourceBase}.pdf`);

  try {
    await execFileAsync(
      'libreoffice',
      ['--headless', '--convert-to', 'pdf', '--outdir', stagingDir, sourcePath],
      { timeout: LIBREOFFICE_TIMEOUT_MS }
    );

    // LibreOffice exits 0 even when conversion silently fails, so verify
    // the output file actually exists.
    await fs.access(stagedOutput);
    await fs.rename(stagedOutput, destPath);
  } finally {
    // Best-effort cleanup of the staging dir (may be empty on failure).
    try {
      await fs.rm(stagingDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
};

const convertToJpeg = async (sourcePath: string, destPath: string): Promise<void> => {
  await ensureDir(path.dirname(destPath));

  // Quality 85 + auto-rotate keeps file size reasonable while preserving
  // detail enough for KYC document review. Larger images would otherwise
  // arrive at the mobile client uncompressed and balloon WebView memory.
  await sharp(sourcePath)
    .rotate() // honor EXIF orientation; HEIC/JPEG may be rotated
    .jpeg({ quality: 85, progressive: true })
    .toFile(destPath);
};

/**
 * Generate a rendition for an attachment if its source format isn't
 * directly viewable by the mobile client. Returns metadata describing
 * the result; never throws — failures are reported in `result.error` so
 * the caller can persist the failure status without aborting the upload.
 */
export async function generateRendition(input: {
  sourcePath: string;
  filename: string;
  mimeType: string | null | undefined;
  attachmentId: number | string;
  caseUploadDir: string;
}): Promise<RenditionResult> {
  const kind = requiresRendition(input.mimeType, input.filename);
  if (!kind) {
    return {
      kind: null,
      absolutePath: null,
      relativePath: null,
      status: 'not_required',
    };
  }

  const renditionDir = path.join(input.caseUploadDir, 'renditions');
  const ext = kind === 'pdf' ? '.pdf' : '.jpg';
  const renditionFilename = `${input.attachmentId}${ext}`;
  const absolutePath = path.join(renditionDir, renditionFilename);

  // Reconstruct the URL-style relative path the rest of the pipeline
  // uses for `attachments.file_path` (e.g. "/uploads/attachments/case_42/renditions/123.pdf").
  const cwd = process.cwd();
  const relAbsolute = path.relative(cwd, absolutePath);
  const relativePath = `/${relAbsolute.split(path.sep).join('/')}`;

  try {
    if (kind === 'pdf') {
      await convertToPdf(input.sourcePath, absolutePath);
    } else {
      await convertToJpeg(input.sourcePath, absolutePath);
    }
    logger.info(
      `Rendition generated for attachment ${input.attachmentId}: ${kind} at ${relativePath}`
    );
    return { kind, absolutePath, relativePath, status: 'success' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Rendition failed for attachment ${input.attachmentId} (${input.filename}, kind=${kind}): ${message}`
    );
    return {
      kind,
      absolutePath: null,
      relativePath: null,
      status: 'failed',
      error: message,
    };
  }
}
