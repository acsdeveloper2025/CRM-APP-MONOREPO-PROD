#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as zlib from 'zlib';
import { backendPath, ensureDir, logger, resolvePgDumpBinary, runProcess, timestampForFile } from './lib/dbAdmin';

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
}

main().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

