/**
 * Storage factory + singleton.
 *
 * Reads STORAGE_BACKEND env (via config.storage.backend):
 *   - 'local' → LocalFsStorage(uploadPath). Default in dev.
 *   - 's3'    → S3Storage(bucket/endpoint/creds). Production target.
 *
 * Exported singleton `storage` is what every controller/service uses.
 *
 * Storage-key helpers also live here to keep the conventions in one place.
 */

import path from 'path';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import type { StorageService } from './StorageService';
import { LocalFsStorage } from './LocalFsStorage';
import { S3Storage } from './S3Storage';

const buildStorage = (): StorageService => {
  if (config.storage.backend === 's3') {
    logger.info('Storage backend: S3', {
      bucket: config.storage.bucket,
      region: config.storage.region,
      endpoint: config.storage.endpoint || '(default)',
    });
    return new S3Storage({
      bucket: config.storage.bucket,
      region: config.storage.region,
      endpoint: config.storage.endpoint || undefined,
      accessKey: config.storage.accessKey,
      secretKey: config.storage.secretKey,
      forcePathStyle: config.storage.forcePathStyle,
    });
  }
  const root = path.resolve(config.uploadPath);
  logger.info('Storage backend: LocalFsStorage', { uploadRoot: root });
  return new LocalFsStorage(root);
};

export const storage: StorageService = buildStorage();

export type { StorageService, GetResult, PutResult } from './StorageService';
export { sanitizeStorageKey } from './StorageService';

/**
 * Storage-key conventions. Centralising the format so every writer/reader
 * derives keys the same way.
 */
export const StorageKeys = {
  attachment: (caseId: string, attachmentId: number | string, ext: string): string =>
    `attachments/${caseId}/${attachmentId}.${ext.replace(/^\./, '')}`,

  attachmentRendition: (attachmentId: number | string, kind: 'pdf' | 'jpeg'): string =>
    `renditions/${attachmentId}.${kind === 'pdf' ? 'pdf' : 'jpg'}`,

  verificationPhoto: (caseId: string, taskId: string, photoId: number | string): string =>
    `verification/${caseId}/${taskId}/${photoId}.jpg`,

  verificationThumb: (caseId: string, taskId: string, photoId: number | string): string =>
    `verification/${caseId}/${taskId}/${photoId}_thumb.jpg`,

  kycDocument: (caseId: string, kycId: number | string, docCode: string, ext: string): string =>
    `kyc/${caseId}/${kycId}-${docCode}.${ext.replace(/^\./, '')}`,

  templateReport: (caseId: string, submissionId: string, reportId: string): string =>
    `template-reports/${caseId}/${submissionId}-${reportId}.html`,

  branding: (clientId: number | string, kind: 'logo' | 'stamp', ext: string): string =>
    `branding/${clientId}/${kind}.${ext.replace(/^\./, '')}`,

  profilePhoto: (userId: string): string => `profile-photos/${userId}.jpg`,
};
