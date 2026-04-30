/**
 * S3Storage — implements StorageService against any S3-compatible backend.
 *
 * Tested against:
 *   - AWS S3 (production target)
 *   - Cloudflare R2 (cheaper egress; `endpoint` set to R2 URL)
 *   - MinIO (local Docker for offline parity; `forcePathStyle: true`)
 *
 * Production cutover: set STORAGE_BACKEND=s3 in env + provide bucket/creds.
 * See `project_storage_abstraction_*.md` runbook.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { logger } from '@/utils/logger';
import {
  sanitizeStorageKey,
  type GetResult,
  type PutResult,
  type StorageService,
} from './StorageService';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string; // optional — only set for R2/MinIO; AWS S3 derives from region
  accessKey: string;
  secretKey: string;
  forcePathStyle?: boolean; // true for MinIO, false for AWS/R2
}

export class S3Storage implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(cfg: S3StorageConfig) {
    if (!cfg.bucket) {
      throw new Error('S3Storage: bucket is required');
    }
    if (!cfg.accessKey || !cfg.secretKey) {
      throw new Error('S3Storage: accessKey + secretKey are required');
    }
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: cfg.region,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
      credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
      forcePathStyle: cfg.forcePathStyle === true,
    });
  }

  async put(key: string, body: Buffer | Readable, mimeType: string): Promise<PutResult> {
    const safe = sanitizeStorageKey(key);

    let bytes: Buffer;
    if (Buffer.isBuffer(body)) {
      bytes = body;
    } else {
      // S3 SDK accepts streams but we need size, so collect to Buffer.
      // Acceptable for typical KYC/photo/template-report sizes (~1-50MB).
      // For larger objects, switch to multipart upload via @aws-sdk/lib-storage.
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      bytes = Buffer.concat(chunks);
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safe,
        Body: bytes,
        ContentType: mimeType,
      })
    );

    return { key: safe, size: bytes.length };
  }

  async get(key: string): Promise<GetResult> {
    const safe = sanitizeStorageKey(key);
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safe }));
    if (!out.Body) {
      throw new Error(`S3Storage.get returned no body for ${safe}`);
    }
    // AWS SDK v3: Body is a Readable in Node
    return {
      stream: out.Body as Readable,
      size: out.ContentLength ?? 0,
      mimeType: out.ContentType ?? 'application/octet-stream',
    };
  }

  async getSignedUrl(key: string, ttlSeconds = 900): Promise<string> {
    const safe = sanitizeStorageKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: safe }), {
      expiresIn: ttlSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    const safe = sanitizeStorageKey(key);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safe }));
    } catch (err) {
      logger.warn(`S3Storage.delete failed for ${safe}`, { error: String(err) });
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const safe = sanitizeStorageKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: safe }));
      return true;
    } catch (err) {
      const code = (err as { name?: string }).name;
      if (code === 'NotFound' || code === 'NoSuchKey') {
        return false;
      }
      throw err;
    }
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const safeFrom = sanitizeStorageKey(fromKey);
    const safeTo = sanitizeStorageKey(toKey);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${safeFrom}`,
        Key: safeTo,
      })
    );
    await this.delete(safeFrom);
  }
}
