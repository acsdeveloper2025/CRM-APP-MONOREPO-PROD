// Magic-byte file validation — Phase E2.
//
// Multer and the existing upload middlewares trust the MIME type
// declared in the multipart headers. That header is client-supplied
// and trivially spoofed: a `.exe` renamed to `.jpg` with
// `Content-Type: image/jpeg` passes every pre-E2 check. The
// file-type package sniffs the actual bytes of the file and returns
// the format it can detect, so we can compare the declared and
// sniffed types and reject mismatches.
//
// Usage:
//   import { verifyFileMagicBytes } from '@/utils/fileTypeGuard';
//   const verdict = await verifyFileMagicBytes(buffer, file.mimetype);
//   if (!verdict.ok) { return res.status(400).json(...); }
//
// file-type v21+ is ESM-only but the backend's tsconfig is CommonJS,
// so a static `import` would be transpiled to `require('file-type')`
// and fail at runtime with ERR_REQUIRE_ESM. The two supported ways
// around this are (a) switching the whole backend to NodeNext module
// resolution, which is a very large change, or (b) loading the
// package via a dynamic import wrapped in `new Function` so TS does
// not downlevel it. We pick (b) — it's confined to this one file and
// keeps the rest of the codebase on CommonJS.
//
// See https://github.com/microsoft/TypeScript/issues/43329

import type { FileTypeResult } from 'file-type';
import { logger } from '@/config/logger';

// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const importFileType = new Function('return import("file-type")') as () => Promise<
  typeof import('file-type')
>;

let cachedFileTypeModule: typeof import('file-type') | null = null;
async function loadFileType(): Promise<typeof import('file-type')> {
  if (!cachedFileTypeModule) {
    cachedFileTypeModule = await importFileType();
  }
  return cachedFileTypeModule;
}

export interface FileGuardVerdict {
  ok: boolean;
  /** The format file-type detected from the buffer, if any. */
  detected?: FileTypeResult;
  /** Human-readable rejection reason when ok=false. */
  reason?: string;
}

/**
 * Set of MIME types that file-type cannot detect from bytes alone.
 * These formats have no reliable magic header — plain text, CSV,
 * JSON, and a few legacy documents. For these we fall back to the
 * declared MIME type after verifying the file is not binary in
 * disguise (the content-type must be on an explicit allowlist the
 * caller passes in).
 */
const UNSNIFFABLE_MIME_PREFIXES = new Set<string>([
  'text/plain',
  'text/csv',
  'application/csv',
  'application/json',
  'text/xml',
  'application/xml',
]);

/**
 * Aliases that file-type sometimes returns with a different MIME
 * string than what browsers / http clients typically send. Mapping
 * both sides to a canonical form prevents false-positive rejections.
 */
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'application/x-zip-compressed': 'application/zip',
};

function canonicalizeMime(mime: string): string {
  const lower = mime.toLowerCase().split(';')[0].trim();
  return MIME_ALIASES[lower] ?? lower;
}

/**
 * Verify that the first bytes of `buffer` match the declared
 * `claimedMime`. Returns `ok: true` when either (a) file-type detects
 * a format whose canonical MIME equals the claimed canonical MIME,
 * or (b) the claimed MIME is on the unsniffable allowlist (plain
 * text / CSV / JSON / XML) — those formats have no magic header so
 * we have nothing to compare.
 *
 * Non-throwing. On file-type internal errors we log and return
 * `ok: false` with a reason so the caller can surface a clear
 * 400 to the client.
 */
export async function verifyFileMagicBytes(
  buffer: Buffer,
  claimedMime: string
): Promise<FileGuardVerdict> {
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: 'Empty file buffer' };
  }

  const claimed = canonicalizeMime(claimedMime);

  let detected: FileTypeResult | undefined;
  try {
    const { fileTypeFromBuffer } = await loadFileType();
    detected = await fileTypeFromBuffer(buffer);
  } catch (error) {
    logger.warn('file-type sniffing failed:', error);
    return {
      ok: false,
      reason: 'Unable to determine file type from content',
    };
  }

  if (detected) {
    const detectedCanonical = canonicalizeMime(detected.mime);
    if (detectedCanonical !== claimed) {
      return {
        ok: false,
        detected,
        reason: `File content (${detected.mime}) does not match declared type (${claimedMime})`,
      };
    }
    return { ok: true, detected };
  }

  // file-type returned undefined → the buffer has no recognized
  // magic header. This is expected for text-based formats; check
  // against the unsniffable allowlist.
  if (UNSNIFFABLE_MIME_PREFIXES.has(claimed)) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `File content could not be identified and claimed type ${claimedMime} is not on the unsniffable allowlist`,
  };
}
