import { performance } from 'perf_hooks';
import { pool } from '@/config/database';
import { THRESHOLDS } from '@/health/thresholds';
import { withTimeout } from '@/health/withTimeout';
import type { ServiceHealth } from '@/health/types';

export async function probeDatabase(): Promise<ServiceHealth> {
  const t0 = performance.now();
  try {
    await withTimeout('db', THRESHOLDS.db.probe_timeout_ms, () => pool.query('SELECT 1'));
    const latency = Math.round(performance.now() - t0);

    const status =
      latency >= THRESHOLDS.db.latency_unhealthy_ms
        ? 'unhealthy'
        : latency >= THRESHOLDS.db.latency_degraded_ms
          ? 'degraded'
          : 'healthy';

    return {
      status,
      latency_ms: latency,
      details: {
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
      },
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      latency_ms: Math.round(performance.now() - t0),
      message: err instanceof Error ? err.message : 'database probe failed',
    };
  }
}
