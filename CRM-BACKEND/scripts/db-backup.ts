#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { backendPath, ensureDir, logger, resolvePgDumpBinary, runProcess, timestampForFile } from './lib/dbAdmin';

/** Number of days to retain backups before auto-deletion */
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);

/**
 * Remove backup files older than RETENTION_DAYS
 */
function pruneOldBackups(backupDir: string): void {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let pruned = 0;

  try {
    const files = fs.readdirSync(backupDir);
    for (const file of files) {
      if (!file.endsWith('.sql.gz')) {
        continue;
      }
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoffMs) {
        fs.unlinkSync(filePath);
        pruned++;
        logger.info(`Pruned old backup: ${file}`);
      }
    }
    if (pruned > 0) {
      logger.info(`Pruned ${pruned} backups older than ${RETENTION_DAYS} days`);
    }
  } catch (error) {
    logger.warn(`Backup pruning failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify backup integrity by checking gzip decompression and non-zero size
 */
function verifyBackup(filePath: string): boolean {
  try {
    const compressed = fs.readFileSync(filePath);
    const decompressed = zlib.gunzipSync(compressed);
    if (decompressed.length < 100) {
      logger.error(`Backup verification failed: decompressed size too small (${decompressed.length} bytes)`);
      return false;
    }
    // Check for expected PostgreSQL dump markers
    const header = decompressed.toString('utf8', 0, Math.min(500, decompressed.length));
    if (!header.includes('PostgreSQL') && !header.includes('SET') && !header.includes('CREATE')) {
      logger.warn('Backup verification: no PostgreSQL markers found — backup may be invalid');
      return false;
    }
    logger.info(`Backup verified: ${(compressed.length / 1024 / 1024).toFixed(2)} MB compressed, ${(decompressed.length / 1024 / 1024).toFixed(2)} MB uncompressed`);
    return true;
  } catch (error) {
    logger.error(`Backup verification failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main(): Promise<void> {
  const outputDir = backendPath('db-artifacts', 'backups');
  ensureDir(outputDir);

  const filename = `local-main-backup-${timestampForFile()}.sql.gz`;
  const outputPath = backendPath('db-artifacts', 'backups', filename);

  logger.info(`Creating database backup at ${outputPath}`);
  const dump = runProcess(resolvePgDumpBinary(), ['--no-owner', '--no-privileges', '--format=plain', process.env.DATABASE_URL || '']);
  const gzipped = zlib.gzipSync(Buffer.from(dump, 'utf8'));
  fs.writeFileSync(outputPath, gzipped);
  logger.info(`Backup written: ${outputPath}`);

  // Verify the backup
  const isValid = verifyBackup(outputPath);
  if (!isValid) {
    logger.error('Backup verification FAILED — manual inspection required');
    process.exit(1);
  }

  // Prune old backups beyond retention period
  pruneOldBackups(outputDir);

  logger.info('Database backup completed successfully');
}

main().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

