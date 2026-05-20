#!/usr/bin/env node
/**
 * One-shot local dev bootstrap.
 *
 * Idempotent. Safe to re-run. Verifies prerequisites, copies .env.example
 * to .env if missing (never overwrites), creates the local Postgres
 * database if absent, loads the schema baseline, and applies migrations.
 *
 * Usage: npm run setup
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const BE = join(REPO_ROOT, 'CRM-BACKEND');
const FE = join(REPO_ROOT, 'CRM-FRONTEND');

const c = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', dim: '\x1b[2m',
};
const log = {
  step: (m) => console.log(`\n${c.blue}▸${c.reset} ${m}`),
  ok: (m) => console.log(`  ${c.green}✓${c.reset} ${m}`),
  warn: (m) => console.log(`  ${c.yellow}⚠${c.reset} ${m}`),
  err: (m) => console.error(`  ${c.red}✗${c.reset} ${m}`),
  dim: (m) => console.log(`  ${c.dim}${m}${c.reset}`),
};

function fail(msg) {
  log.err(msg);
  process.exit(1);
}

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd]);
  return r.status === 0;
}

// ---- 1. Node version ----
log.step('Checking Node version');
{
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 20) {
    fail(`Node ${process.versions.node} found, need >=20. Run "nvm use" (repo has .nvmrc).`);
  }
  log.ok(`Node ${process.versions.node}`);
}

// ---- 2. Prereqs on PATH ----
log.step('Checking prerequisites on PATH');
{
  const needed = ['psql', 'redis-cli'];
  const missing = needed.filter((c) => !which(c));
  if (missing.length) {
    log.warn(`Missing: ${missing.join(', ')}`);
    log.dim('macOS:  brew install postgresql@18 redis');
    log.dim('Ubuntu: apt install postgresql-client redis-tools');
    fail('Install the missing tools and re-run.');
  }
  log.ok('psql, redis-cli');

  // Optional binaries (warn only — only needed if exercising PDF/Office paths)
  const optional = ['pdftohtml', 'libreoffice'];
  const missingOpt = optional.filter((c) => !which(c));
  if (missingOpt.length) {
    log.warn(`Optional binaries missing: ${missingOpt.join(', ')} (PDF/Office paths will fail)`);
    log.dim('macOS:  brew install poppler libreoffice');
    log.dim('Ubuntu: apt install poppler-utils libreoffice-core libreoffice-writer');
  } else {
    log.ok('poppler, libreoffice');
  }
}

// ---- 3. .env files ----
log.step('Ensuring .env files exist (never overwrites)');
for (const [dir, label] of [[BE, 'CRM-BACKEND'], [FE, 'CRM-FRONTEND']]) {
  const example = join(dir, '.env.example');
  const target = join(dir, '.env');
  if (!existsSync(example)) {
    fail(`${label}/.env.example not found`);
  }
  if (existsSync(target)) {
    log.ok(`${label}/.env already present (untouched)`);
  } else {
    copyFileSync(example, target);
    log.ok(`Copied ${label}/.env.example → .env`);
  }
}

// ---- 4. Parse DATABASE_URL from backend .env ----
log.step('Reading DATABASE_URL from CRM-BACKEND/.env');
function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const envBe = parseEnv(join(BE, '.env'));
const dbUrl = envBe.DATABASE_URL;
if (!dbUrl) fail('DATABASE_URL missing from CRM-BACKEND/.env');
const m = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/(.+)$/);
if (!m) fail(`Could not parse DATABASE_URL (got "${dbUrl}")`);
const [, user, pass, host, port, dbName] = m;
log.ok(`Target: postgresql://${user}:***@${host}:${port}/${dbName}`);

// ---- 5. Postgres reachability + DB exists ----
log.step('Checking Postgres reachability');
function psqlCmd(args, dbOverride) {
  const env = { ...process.env, PGPASSWORD: pass };
  const r = spawnSync('psql', [
    '-h', host, '-p', port, '-U', user, '-d', dbOverride ?? dbName,
    '-tAc', args,
  ], { env, encoding: 'utf8' });
  return r;
}
{
  const probe = psqlCmd('SELECT 1', 'postgres');
  if (probe.status !== 0) {
    log.err(probe.stderr.trim() || 'psql failed');
    log.dim(`Ensure Postgres is running and that role "${user}" exists with the password in .env.`);
    log.dim(`Example: createuser -s ${user} && psql -c "ALTER USER ${user} WITH PASSWORD '${pass}';"`);
    fail('Cannot connect to Postgres.');
  }
  log.ok('Postgres reachable');
}
{
  const exists = psqlCmd(`SELECT 1 FROM pg_database WHERE datname='${dbName}'`, 'postgres');
  if (!exists.stdout.trim()) {
    log.dim(`Database "${dbName}" not found — creating...`);
    const create = psqlCmd(`CREATE DATABASE ${dbName}`, 'postgres');
    if (create.status !== 0) fail(create.stderr.trim() || 'CREATE DATABASE failed');
    log.ok(`Created database ${dbName}`);
  } else {
    log.ok(`Database ${dbName} exists`);
  }
}

// ---- 6. Redis reachability ----
log.step('Checking Redis reachability');
{
  const r = spawnSync('redis-cli', ['ping'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout.includes('PONG')) {
    log.dim('macOS:  brew services start redis');
    log.dim('Ubuntu: systemctl start redis-server');
    fail('Redis not reachable on default port.');
  }
  log.ok('Redis reachable');
}

// ---- 7. Schema baseline + migrations ----
log.step('Loading schema baseline (acs_db_final_version.sql)');
{
  // Detect whether schema is already loaded by checking for a well-known table.
  const tableCheck = psqlCmd("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs'");
  if (tableCheck.stdout.trim() === '1') {
    log.ok('Schema already loaded (audit_logs exists) — skipping baseline');
  } else {
    const dump = join(REPO_ROOT, 'acs_db_final_version.sql');
    if (!existsSync(dump)) fail(`Schema dump not found at ${dump}`);
    const env = { ...process.env, PGPASSWORD: pass };
    log.dim('Importing schema (may take ~10s)...');
    const r = spawnSync('psql', [
      '-h', host, '-p', port, '-U', user, '-d', dbName,
      '-v', 'ON_ERROR_STOP=1', '-f', dump,
    ], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    if (r.status !== 0) {
      log.err(r.stderr?.toString().split('\n').slice(-10).join('\n') ?? 'psql failed');
      fail('Schema import failed.');
    }
    log.ok('Schema imported');
  }
}

log.step('Running migrations');
{
  const r = spawnSync('npm', ['--prefix', 'CRM-BACKEND', 'run', 'migrate'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) fail('Migrations failed. Fix the failing file and re-run "npm run setup".');
  log.ok('Migrations applied');
}

// ---- 8. Done ----
console.log(`\n${c.green}✓ Setup complete.${c.reset}\n  Next: ${c.blue}npm run dev${c.reset}\n`);
