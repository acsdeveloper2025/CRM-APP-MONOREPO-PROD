#!/usr/bin/env ts-node

import * as fs from 'fs';
import { backendPath, destructiveTables, ensureDir, logger, resolvePgDumpBinary, runProcess, snapshotTables } from './lib/dbAdmin';

function buildTableArgs(tables: string[]): string[] {
  return tables.flatMap(table => ['--table', `public.${table}`]);
}

function buildHeader(): string {
  return `-- Generated from local main database snapshot\nBEGIN;\nSET session_replication_role = replica;\nTRUNCATE TABLE\n  ${destructiveTables.join(',\n  ')}\nRESTART IDENTITY CASCADE;\nDELETE FROM user_roles;\nDELETE FROM role_permissions;\nDELETE FROM roles_v2;\nDELETE FROM users;\nDELETE FROM departments;\nDELETE FROM permissions;\nDELETE FROM "rateTypes";\nDELETE FROM "verificationTypes";\nDELETE FROM "documentTypes";\nDELETE FROM "pincodeAreas";\nDELETE FROM pincodes;\nDELETE FROM areas;\nDELETE FROM cities;\nDELETE FROM states;\nDELETE FROM countries;\n`;
}

function buildFooter(): string {
  return `\nSET session_replication_role = origin;\nCOMMIT;\n`;
}

function sanitizeDump(dump: string): string {
  return dump
    .split('\n')
    .filter(line => !line.startsWith('\\'))
    .join('\n');
}

async function main(): Promise<void> {
  const artifactDir = backendPath('db-artifacts');
  ensureDir(artifactDir);

  const snapshotPath = backendPath('db-artifacts', 'local-main-snapshot.sql');
  const migrationPath = backendPath('migrations', '20260326_local_main_snapshot_reset.sql');

  const dumpArgs = [
    '--no-owner',
    '--no-privileges',
    '--data-only',
    '--inserts',
    '--column-inserts',
    ...buildTableArgs(snapshotTables),
    process.env.DATABASE_URL || ''
  ];

  logger.info('Exporting local main snapshot SQL');
  const dump = runProcess(resolvePgDumpBinary(), dumpArgs);
  const snapshotSql = `${buildHeader()}${sanitizeDump(dump)}${buildFooter()}`;

  fs.writeFileSync(snapshotPath, snapshotSql);
  fs.writeFileSync(migrationPath, snapshotSql);

  logger.info(`Snapshot written: ${snapshotPath}`);
  logger.info(`Deployable migration written: ${migrationPath}`);
}

main().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
