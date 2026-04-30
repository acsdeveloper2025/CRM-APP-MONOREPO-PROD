/**
 * One-shot migration: populate storage_key columns + (optionally) copy local
 * filesystem files to active StorageService backend.
 *
 * Usage:
 *   # Dry run (no DB writes, no S3 uploads):
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-files-to-storage.ts --dry-run
 *
 *   # Populate storage_key columns from existing file_path values (no byte copy):
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-files-to-storage.ts --populate-keys
 *
 *   # Copy bytes to active backend (use after STORAGE_BACKEND=s3 is set):
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-files-to-storage.ts --copy-bytes
 *
 *   # Both:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-files-to-storage.ts --populate-keys --copy-bytes
 *
 * Tables migrated:
 *   - attachments (file_path → storage_key)
 *   - verification_attachments (file_path → storage_key)
 *   - kyc_document_verifications (document_file_path → document_storage_key)
 *   - template_reports (report_content TEXT → storage_key + storage object)
 *
 * Idempotent: skips rows with storage_key already set.
 */

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '@/config';
import { pool, query } from '@/config/db';
import { storage } from '@/services/storage';
import { logger } from '@/utils/logger';

interface CliFlags {
  dryRun: boolean;
  populateKeys: boolean;
  copyBytes: boolean;
}

const parseFlags = (): CliFlags => {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has('--dry-run'),
    populateKeys: args.has('--populate-keys'),
    copyBytes: args.has('--copy-bytes'),
  };
};

const stripUploadsPrefix = (filePath: string): string => {
  // Convert legacy 'uploads/...' or '/uploads/...' or '/abs/path/uploads/...' to a clean storage key
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.indexOf('/uploads/');
  if (idx >= 0) return normalized.substring(idx + '/uploads/'.length);
  if (normalized.startsWith('uploads/')) return normalized.substring('uploads/'.length);
  return normalized; // assume already a clean key
};

const uploadRoot = path.resolve(config.uploadPath);

const copyLocalFileToStorage = async (
  legacyFilePath: string,
  storageKey: string,
  mimeType: string
): Promise<{ size: number } | null> => {
  // Legacy file_path values are URL-style ('/uploads/...') or relative
  // ('uploads/...'). Always resolve against the upload root, never the
  // filesystem absolute path (which would point to /uploads on disk).
  const cleanKey = stripUploadsPrefix(legacyFilePath);
  const localPath = path.join(uploadRoot, cleanKey);
  try {
    const buf = await fs.readFile(localPath);
    const result = await storage.put(storageKey, buf, mimeType);
    return { size: result.size };
  } catch (err) {
    logger.warn(`Skipping ${localPath}: ${String(err)}`);
    return null;
  }
};

const migrateAttachments = async (flags: CliFlags): Promise<void> => {
  const { rows } = await query<{
    id: string;
    file_path: string | null;
    mime_type: string | null;
    storage_key: string | null;
  }>(
    `SELECT id, file_path, mime_type, storage_key
       FROM attachments
      WHERE storage_key IS NULL AND file_path IS NOT NULL`
  );
  logger.info(`attachments: ${rows.length} candidates`);
  for (const row of rows) {
    if (!row.file_path) continue;
    const key = stripUploadsPrefix(row.file_path);
    const mime = row.mime_type || 'application/octet-stream';
    if (flags.dryRun) {
      logger.info(`[DRY] attachments id=${row.id} → key=${key}`);
      continue;
    }
    if (flags.copyBytes) {
      const copied = await copyLocalFileToStorage(row.file_path, key, mime);
      if (!copied) continue;
    }
    if (flags.populateKeys) {
      await query(`UPDATE attachments SET storage_key = $1 WHERE id = $2`, [key, row.id]);
    }
  }
};

const migrateVerificationAttachments = async (flags: CliFlags): Promise<void> => {
  const { rows } = await query<{
    id: number;
    file_path: string | null;
    mime_type: string | null;
  }>(
    `SELECT id, file_path, mime_type
       FROM verification_attachments
      WHERE storage_key IS NULL AND file_path IS NOT NULL`
  );
  logger.info(`verification_attachments: ${rows.length} candidates`);
  for (const row of rows) {
    if (!row.file_path) continue;
    const key = stripUploadsPrefix(row.file_path);
    const mime = row.mime_type || 'image/jpeg';
    if (flags.dryRun) {
      logger.info(`[DRY] verification_attachments id=${row.id} → key=${key}`);
      continue;
    }
    if (flags.copyBytes) {
      const copied = await copyLocalFileToStorage(row.file_path, key, mime);
      if (!copied) continue;
    }
    if (flags.populateKeys) {
      await query(`UPDATE verification_attachments SET storage_key = $1 WHERE id = $2`, [
        key,
        row.id,
      ]);
    }
  }
};

const migrateKycDocs = async (flags: CliFlags): Promise<void> => {
  const { rows } = await query<{
    id: string;
    document_file_path: string | null;
    document_mime_type: string | null;
  }>(
    `SELECT id, document_file_path, document_mime_type
       FROM kyc_document_verifications
      WHERE document_storage_key IS NULL AND document_file_path IS NOT NULL`
  );
  logger.info(`kyc_document_verifications: ${rows.length} candidates`);
  for (const row of rows) {
    if (!row.document_file_path) continue;
    const key = stripUploadsPrefix(row.document_file_path);
    const mime = row.document_mime_type || 'application/octet-stream';
    if (flags.dryRun) {
      logger.info(`[DRY] kyc_document_verifications id=${row.id} → key=${key}`);
      continue;
    }
    if (flags.copyBytes) {
      const copied = await copyLocalFileToStorage(row.document_file_path, key, mime);
      if (!copied) continue;
    }
    if (flags.populateKeys) {
      await query(`UPDATE kyc_document_verifications SET document_storage_key = $1 WHERE id = $2`, [
        key,
        row.id,
      ]);
    }
  }
};

const migrateTemplateReports = async (flags: CliFlags): Promise<void> => {
  // template_reports.report_content is TEXT in DB. Migration: write content as
  // an object under template-reports/<case_id>/<submission_id>-<report_id>.html
  // and populate storage_key. Legacy report_content kept until cutover.
  const { rows } = await query<{
    id: string;
    case_id: string;
    submission_id: string;
    report_content: string;
  }>(
    `SELECT id, case_id, submission_id, report_content
       FROM template_reports
      WHERE storage_key IS NULL AND report_content IS NOT NULL`
  );
  logger.info(`template_reports: ${rows.length} candidates`);
  for (const row of rows) {
    const key = `template-reports/${row.case_id}/${row.submission_id}-${row.id}.html`;
    if (flags.dryRun) {
      logger.info(
        `[DRY] template_reports id=${row.id} → key=${key} (size=${row.report_content.length} chars)`
      );
      continue;
    }
    if (flags.copyBytes) {
      await storage.put(key, Buffer.from(row.report_content, 'utf8'), 'text/html; charset=utf-8');
    }
    if (flags.populateKeys) {
      await query(`UPDATE template_reports SET storage_key = $1 WHERE id = $2`, [key, row.id]);
    }
  }
};

const main = async (): Promise<void> => {
  const flags = parseFlags();
  if (!flags.dryRun && !flags.populateKeys && !flags.copyBytes) {
    process.stderr.write(
      'No flags given. Use --dry-run | --populate-keys | --copy-bytes (or both populate + copy).\n'
    );
    process.exit(2);
  }
  logger.info('migrate-files-to-storage starting', flags);

  await migrateAttachments(flags);
  await migrateVerificationAttachments(flags);
  await migrateKycDocs(flags);
  await migrateTemplateReports(flags);

  logger.info('migrate-files-to-storage complete');
  await pool.end();
};

main().catch(err => {
  logger.error('migrate-files-to-storage failed', { error: String(err) });
  process.exit(1);
});
