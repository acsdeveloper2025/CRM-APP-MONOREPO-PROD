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
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000; // wait 30s after boot for DB+pool to settle

let maintenanceInterval: ReturnType<typeof setInterval> | null = null;
let kpiRefreshInterval: ReturnType<typeof setInterval> | null = null;

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
  // 90-day rolling retention on field-monitoring location pings (field-exec
  // tracking epic P1; was 7 days). Each ping (TASK / ADMIN_PING / TRACKING)
  // is one row in `locations`; at 1000+ agents × periodic foreground tracking
  // this grows fast. 90 days covers the dispute/audit window. The
  // latest_location projection is always-current and not purged. When volume
  // demands, range-partition `locations` by recorded_at and drop old
  // partitions instead of this DELETE.
  {
    name: 'purge_stale_locations',
    sql: "DELETE FROM locations WHERE recorded_at < now() - interval '90 days' RETURNING id",
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

// P5 truthful-sweep 2026-05-27: dashboard KPI materialized view
// refresh. Mat view aggregates verification_tasks per
// (agent, creator, client, product) — pre-computes the 25-FILTER
// COUNT() shape the dashboardKPIService.coreQuery does on every
// request. CONCURRENT refresh requires the UNIQUE INDEX created in
// the 2026-05-27_p5_dashboard_kpi_mat_view migration. 5-min cadence
// → dashboard KPIs are stale-by-up-to-5-min, acceptable for trend +
// snapshot views.
const refreshKpiMatView = async (): Promise<void> => {
  try {
    const result = await query<Record<string, unknown>>(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpi_7d'
    );
    logger.info('db-maintenance refresh_mv_dashboard_kpi_7d ok', {
      result: result.rows[0] || null,
    });
  } catch (err) {
    // Non-fatal — most likely cause is the mat view not yet created
    // on an older DB snapshot. Log + continue; the next run retries.
    logger.warn('db-maintenance refresh_mv_dashboard_kpi_7d failed', {
      error: String(err),
    });
  }
};

export const startDbMaintenance = (): void => {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
  }
  if (kpiRefreshInterval) {
    clearInterval(kpiRefreshInterval);
  }
  setTimeout(() => {
    void runOnce();
    void refreshKpiMatView();
  }, INITIAL_DELAY_MS);
  maintenanceInterval = setInterval(() => {
    void runOnce();
  }, TWENTY_FOUR_HOURS_MS);
  kpiRefreshInterval = setInterval(() => {
    void refreshKpiMatView();
  }, FIVE_MINUTES_MS);
  logger.info('db-maintenance scheduled', {
    purgeIntervalMs: TWENTY_FOUR_HOURS_MS,
    kpiRefreshIntervalMs: FIVE_MINUTES_MS,
  });
};

export const stopDbMaintenance = (): void => {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
  if (kpiRefreshInterval) {
    clearInterval(kpiRefreshInterval);
    kpiRefreshInterval = null;
  }
};
