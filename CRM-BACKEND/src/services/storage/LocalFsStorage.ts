/**
 * LocalFsStorage — implements StorageService against local filesystem.
 *
 * Default in dev. Stores files under `<uploadRoot>/<key>`.
 *
 * `getSignedUrl` returns `/api/storage/<key>` (not `/uploads/<key>`) so reads
 * always go through the auth-gated streaming controller. This closes the F-B1.1
 * audit finding (unauthenticated `/uploads` static serving = DPDP exposure).
 */

import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { logger } from '@/utils/logger';
import {
  sanitizeStorageKey,
  type GetResult,
  type PutResult,
  type StorageService,
} from './StorageService';

const mimeFromExt = (ext: string): string => {
  const lower = ext.toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.heic': 'image/heic',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.html': 'text/html',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[lower] || 'application/octet-stream';
};

export class LocalFsStorage implements StorageService {
  constructor(private readonly uploadRoot: string) {}

  private resolve(key: string): string {
    const safe = sanitizeStorageKey(key);
    return path.join(this.uploadRoot, safe);
  }

  async put(key: string, body: Buffer | Readable, mimeType: string): Promise<PutResult> {
    const safe = sanitizeStorageKey(key);
    const fullPath = this.resolve(safe);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    if (Buffer.isBuffer(body)) {
      await fs.writeFile(fullPath, body);
      return { key: safe, size: body.length };
    }

    // Stream body — write to disk via fs.createWriteStream
    const { createWriteStream } = await import('fs');
    let size = 0;
    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(fullPath);
      body.on('data', (chunk: Buffer) => {
        size += chunk.length;
      });
      body
        .pipe(writeStream)
        .on('finish', () => resolve())
        .on('error', reject);
      body.on('error', reject);
    });

    // Optionally persist mimeType as a sidecar; LocalFs derives from extension on get().
    void mimeType;
    return { key: safe, size };
  }

  async get(key: string): Promise<GetResult> {
    const fullPath = this.resolve(key);
    const stat = await fs.stat(fullPath);
    const stream = createReadStream(fullPath);
    return {
      stream,
      size: stat.size,
      mimeType: mimeFromExt(path.extname(fullPath)),
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getSignedUrl(key: string, _ttlSeconds?: number): Promise<string> {
    // Return an in-app URL that goes through the auth-gated controller.
    // `_ttlSeconds` ignored for local — every read is per-request authenticated.
    // Async signature kept for interface symmetry with S3Storage (which IS async).
    const safe = sanitizeStorageKey(key);
    return `/api/storage/${safe}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolve(key);
    try {
      await fs.unlink(fullPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn(`LocalFsStorage.delete failed for ${key}`, { error: String(err) });
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const fromPath = this.resolve(fromKey);
    const toPath = this.resolve(toKey);
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.rename(fromPath, toPath);
  }
}
