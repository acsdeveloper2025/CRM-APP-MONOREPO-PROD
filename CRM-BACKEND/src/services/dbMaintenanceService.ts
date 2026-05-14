/**
 * dbMaintenanceService — periodic invocation of DB-side maintenance helpers.
 *
 * Closes audit gaps:
 *   - F11 partition sprint follow-up (`ensure_*_partitions`) — partitions don't
 *     auto-extend; without this they fall into `_default` once the window expires.
 *   - F7.9.3 (`purge_stale_auto_saves`) — function exists but had no scheduler.
 *   - F10.1.2 (`purge_stale_notifications`) — same.
 *
 * Cadence: runs every 24h. First run at startup + `INITIAL_DELAY_MS` later
 * to avoid pile-up if multiple PM2 workers boot near each other.
 */

import { query } from '@/config/database';
import { logger } from '@/utils/logger';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000; // wait 30s after boot for DB+pool to settle

let maintenanceInterval: ReturnType<typeof setInterval> | null = null;

const tasks: Array<{ name: string; sql: string }> = [
  {
    name: 'ensure_audit_logs_partitions',
    sql: 'SELECT ensure_audit_logs_partitions(12) AS created',
  },
  {
    name: 'ensure_notifications_partitions',
    sql: 'SELECT ensure_notifications_partitions(6) AS created',
  },
  {
    name: 'ensure_performance_metrics_partitions',
    // P20.G-5: bump runway 30 → 60 days. Maintenance runs daily so a
    // single-day blip won't blow through the buffer; matches the
    // longer-horizon shape we already use for audit_logs (13 months)
    // and notifications (7 months). Cheap — partitions are empty
    // until the day they cover.
    sql: 'SELECT ensure_performance_metrics_partitions(60) AS created',
  },
  {
    name: 'purge_stale_auto_saves',
    sql: "SELECT purge_stale_auto_saves('7 days'::interval) AS deleted",
  },
  {
    name: 'purge_stale_notifications',
    sql: 'SELECT * FROM purge_stale_notifications()',
  },
  {
    name: 'purge_expired_idempotency_keys',
    sql: "SELECT purge_expired_idempotency_keys('7 days'::interval) AS deleted",
  },
  {
    name: 'purge_stale_performance_metrics',
    sql: "SELECT purge_stale_performance_metrics('7 days'::interval) AS deleted",
  },
  // 2026-05-13: 7-day rolling retention on field-monitoring location pings.
  // Each ping (TASK or ADMIN_PING) is one row in `locations`; at 1000+
  // agents × N pings/day this grows quickly. Keep just enough history
  // for "what happened last week?" lookups; older rows are purged.
  {
    name: 'purge_stale_locations',
    sql: "DELETE FROM locations WHERE recorded_at < now() - interval '7 days' RETURNING id",
  },
];

const runOnce = async (): Promise<void> => {
  for (const t of tasks) {
    try {
      const result = await query<Record<string, unknown>>(t.sql);
      logger.info(`db-maintenance ${t.name} ok`, { result: result.rows[0] || null });
    } catch (err) {
      // Non-fatal: a missing function (e.g., on older DB snapshots) shouldn't
      // crash the loop. Log + continue.
      logger.warn(`db-maintenance ${t.name} failed`, { error: String(err) });
    }
  }
};

export const startDbMaintenance = (): void => {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
  }
  setTimeout(() => {
    void runOnce();
  }, INITIAL_DELAY_MS);
  maintenanceInterval = setInterval(() => {
    void runOnce();
  }, TWENTY_FOUR_HOURS_MS);
  logger.info('db-maintenance scheduled', { intervalMs: TWENTY_FOUR_HOURS_MS });
};

export const stopDbMaintenance = (): void => {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
};
