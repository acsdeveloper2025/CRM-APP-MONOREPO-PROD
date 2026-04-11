#!/usr/bin/env ts-node
/**
 * One-off utility to backfill schema_migrations for migrations 001-011.
 *
 * Background: the production / local DB for this project was seeded from
 * a pg_dump that already contained all schema changes from migrations
 * 001-011. The schema_migrations tracking table, however, has zero rows
 * for those entries. Running `npm run migrate` at this point would try
 * to re-apply migrations 001-011 and fail on "column already exists" /
 * "relation already exists" errors.
 *
 * This script inserts a row for each of 001-011 into schema_migrations
 * with the file's actual sha256 checksum and success=true, so the
 * subsequent `npm run migrate` run only attempts to apply 012 and 013
 * (the Phase D migrations this audit session added).
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so rerunning against a
 * partially-backfilled DB is safe.
 *
 * Usage:
 *   ts-node scripts/backfill-schema-migrations.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });

const MIGRATIONS_TO_BACKFILL = [
  '001_add_performance_indexes',
  '002_add_task_revoke_permission',
  '003_add_team_leader_to_role_constraint',
  '004_replace_service_zones_with_direct_rate_type',
  '005_kyc_los_document_types',
  '006_remove_document_fields_from_verification_tasks',
  '007_repoint_document_type_rates_to_kyc',
  '008_add_rate_to_kyc_verifications',
  '009_remove_duplicate_password_column',
  '010_naming_standardization',
  '011_add_service_zone_unique_constraint',
];

async function main(): Promise<void> {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  // Make sure the tracking table exists before we try to insert into it.
  // Matches the DDL used by run-migrations.ts so it's safe to coexist.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64) NOT NULL,
      execution_time_ms INTEGER DEFAULT 0,
      success BOOLEAN DEFAULT TRUE
    )
  `);

  let inserted = 0;
  let skipped = 0;
  for (const id of MIGRATIONS_TO_BACKFILL) {
    const filename = `${id}.sql`;
    const filePath = path.join(migrationsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] Missing migration file: ${filename}`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    const result = await pool.query(
      `INSERT INTO schema_migrations (id, filename, checksum, execution_time_ms, success)
       VALUES ($1, $2, $3, 0, TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [id, filename, checksum]
    );

    if (result.rowCount && result.rowCount > 0) {
      inserted += 1;
      console.log(`[OK]  Backfilled ${id}`);
    } else {
      skipped += 1;
      console.log(`[SKIP] ${id} already recorded`);
    }
  }

  console.log(`\n${inserted} inserted, ${skipped} skipped`);
  await pool.end();
}

main().catch(err => {
  console.error('[ERROR] Backfill failed:', err);
  process.exit(1);
});
