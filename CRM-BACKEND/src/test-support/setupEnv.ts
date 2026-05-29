/**
 * Integration-test environment bootstrap (loaded via setupFiles in
 * vitest.integration.config.ts, BEFORE any `@/config` / `@/config/db` import).
 *
 * Loads the real .env (JWT secrets, DB credentials) and then repoints
 * DATABASE_URL at the isolated `acs_db_test` database. dotenv.config() never
 * overrides an already-set key, so the second dotenv.config() inside
 * `@/config` keeps this override in place.
 *
 * Hard safety guard: refuses to run unless the resolved URL targets
 * acs_db_test, so integration tests can never accidentally hit the dev DB.
 */
import path from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.TOTAL_CONCURRENT_USERS = process.env.TOTAL_CONCURRENT_USERS ?? '12';

const url = process.env.DATABASE_URL ?? '';
if (!/\/acs_db_test(\?|$)/.test(url)) {
  process.env.DATABASE_URL = url.replace(/\/acs_db(\?.*)?$/, '/acs_db_test$1');
}

if (!process.env.DATABASE_URL?.includes('/acs_db_test')) {
  throw new Error(
    `Integration tests must target the acs_db_test database, but DATABASE_URL resolved to: ${process.env.DATABASE_URL}`
  );
}
