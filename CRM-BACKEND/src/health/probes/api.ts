import { monitorEventLoopDelay } from 'perf_hooks';
import { THRESHOLDS } from '@/health/thresholds';
import type { HealthStatus, ServiceHealth } from '@/health/types';

const histogram = monitorEventLoopDelay({ resolution: THRESHOLDS.api.histogram_resolution_ms });
histogram.enable();

function pickStatus(heapPct: number, elMaxMs: number): HealthStatus {
  if (
    heapPct >= THRESHOLDS.api.heap_pct_unhealthy ||
    elMaxMs >= THRESHOLDS.api.event_loop_max_ms_unhealthy
  ) {
    return 'unhealthy';
  }
  if (
    heapPct >= THRESHOLDS.api.heap_pct_degraded ||
    elMaxMs >= THRESHOLDS.api.event_loop_max_ms_degraded
  ) {
    return 'degraded';
  }
  return 'healthy';
}

export function probeApi(): ServiceHealth {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10;
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10;
  const heapPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  const elMeanMs = Math.round((histogram.mean / 1e6) * 100) / 100;
  const elMaxMs = Math.round((histogram.max / 1e6) * 100) / 100;
  histogram.reset();

  return {
    status: pickStatus(heapPct, elMaxMs),
    details: {
      heap_used_mb: heapUsedMb,
      heap_total_mb: heapTotalMb,
      heap_pct: heapPct,
      rss_mb: rssMb,
      event_loop_mean_ms: elMeanMs,
      event_loop_max_ms: elMaxMs,
    },
  };
}
