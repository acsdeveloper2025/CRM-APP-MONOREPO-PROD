/**
 * StorageService — abstraction for object/file storage.
 *
 * Two implementations:
 *   - LocalFsStorage: writes to local filesystem under config.uploadPath. Default in dev.
 *   - S3Storage: any S3-compatible backend (AWS S3, Cloudflare R2, MinIO).
 *
 * Selection: env var STORAGE_BACKEND (local | s3). Factory in ./index.ts.
 *
 * Closes audit findings F7.11.2 (template_reports.report_content → object storage)
 * and F8.2.3 (KYC document file paths → object storage), plus F-B1.1 (DPDP exposure
 * via unauthenticated /uploads static serving — controllers will mediate signed URLs).
 *
 * Storage key conventions (see ./KeyBuilder for helpers):
 *   - attachments/{case_id}/{attachment_id}.{ext}
 *   - verification/{case_id}/{task_id}/{photo_id}.jpg
 *   - renditions/{attachment_id}.pdf
 *   - kyc/{case_id}/{kyc_id}-{doc_type}.{ext}
 *   - template-reports/{case_id}/{submission_id}-{report_id}.html
 *   - branding/{client_id}/{type}.{ext}
 *   - profile-photos/{user_id}.jpg
 */

import type { Readable } from 'stream';

export interface PutResult {
  /** Canonical storage key (relative path within bucket / upload root). */
  key: string;
  /** Bytes written. */
  size: number;
}

export interface GetResult {
  /** Streamable body. Caller must consume or pipe to response. */
  stream: Readable;
  /** Object size in bytes. */
  size: number;
  /** Content-Type stored alongside the object. */
  mimeType: string;
}

export interface StorageService {
  /**
   * Write bytes to the given key. Overwrites if key exists.
   *
   * @param key       Canonical storage key.
   * @param body      Buffer or Readable stream of bytes to write.
   * @param mimeType  Content-Type to store with the object.
   * @returns         The key written and total bytes written.
   */
  put(key: string, body: Buffer | Readable, mimeType: string): Promise<PutResult>;

  /**
   * Stream bytes back from the given key.
   *
   * @throws if key does not exist.
   */
  get(key: string): Promise<GetResult>;

  /**
   * Generate a time-limited URL the caller can use to fetch the object directly.
   *
   * Local backend: returns an in-app `/api/storage/{key}` URL that goes through
   * the auth-gated streaming controller (NOT the static `/uploads` mount, which
   * is unauthenticated and a DPDP exposure).
   *
   * S3 backend: returns a signed S3 presigned URL valid for `ttlSeconds`.
   *
   * @param key         Storage key.
   * @param ttlSeconds  How long the URL stays valid. Default per config.
   */
  getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;

  /** Permanently remove the object. Idempotent — does not throw on missing. */
  delete(key: string): Promise<void>;

  /** True if the key exists. */
  exists(key: string): Promise<boolean>;

  /** Move/rename an object. Atomic-ish; deletes source on success. */
  move(fromKey: string, toKey: string): Promise<void>;
}

/**
 * Sanitize a candidate storage key to prevent directory traversal.
 * Keys MUST be relative; absolute paths and `..` segments are rejected.
 */
export const sanitizeStorageKey = (key: string): string => {
  if (!key || typeof key !== 'string') {
    throw new Error('Storage key must be a non-empty string');
  }
  const trimmed = key.trim().replace(/^[\\/]+/, '');
  if (trimmed.includes('..')) {
    throw new Error(`Storage key contains forbidden ".." segment: ${key}`);
  }
  if (trimmed.length === 0) {
    throw new Error('Storage key resolved to empty string');
  }
  return trimmed;
};
