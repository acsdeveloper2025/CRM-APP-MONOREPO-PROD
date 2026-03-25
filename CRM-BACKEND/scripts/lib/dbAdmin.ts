import { spawnSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const backendRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

export const adminUserId = '70dcf247-759c-405d-a8fb-4c78b7b77747';
export const adminRoleId = 1;
export const adminRoleV2Id = '688a9754-30ec-41fc-9c93-58e33fa7bf1e';

export const preservedDataTables = [
  'countries',
  'states',
  'cities',
  'areas',
  'pincodes',
  '"pincodeAreas"',
  '"documentTypes"',
  '"verificationTypes"',
  '"rateTypes"',
  'departments',
  'roles',
  'roles_v2',
  'permissions',
  'role_permissions',
  'user_roles',
  'users'
];

export const destructiveTables = [
  'cases',
  'clients',
  'products',
  'rates',
  '"rateTypeAssignments"',
  '"rateHistory"',
  '"documentTypeRates"',
  'service_zone_rules',
  'zone_rate_type_mapping',
  'service_zones',
  'commission_rate_types',
  'field_user_commission_assignments',
  'agent_performance_daily',
  '"auditLogs"',
  '"backgroundSyncQueue"',
  'mobile_device_sync',
  'mobile_notification_audit',
  'mobile_notification_queue',
  'notification_batches',
  'notification_preferences',
  'notification_tokens',
  '"notificationTokens"',
  'notifications',
  'performance_metrics',
  '"refreshTokens"',
  'scheduled_reports',
  'security_audit_events',
  'trusted_devices',
  '"territoryAssignmentAudit"',
  '"userAreaAssignments"',
  '"userClientAssignments"',
  '"userPincodeAssignments"',
  '"userProductAssignments"',
  'error_logs'
];

export const snapshotTables = [
  'countries',
  'states',
  'cities',
  'areas',
  'pincodes',
  '"pincodeAreas"',
  '"documentTypes"',
  '"verificationTypes"',
  '"rateTypes"',
  'departments',
  'roles',
  'roles_v2',
  'permissions',
  'role_permissions',
  'user_roles',
  'users'
];

export const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`)
};

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL is not set');
  }
  return value;
}

export function createPool(): Pool {
  return new Pool({ connectionString: getDatabaseUrl() });
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function timestampForFile(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('') + '_' + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('');
}

export function resolvePgDumpBinary(): string {
  const candidates = ['pg_dump-17', 'pg_dump-18', 'pg_dump'];

  for (const candidate of candidates) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0) {
      return candidate;
    }
  }

  throw new Error('No pg_dump binary found in PATH');
}

export function runProcess(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 100
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed: ${command} ${args.join(' ')}`);
  }

  return result.stdout;
}

export function backendPath(...parts: string[]): string {
  return path.join(backendRoot, ...parts);
}

