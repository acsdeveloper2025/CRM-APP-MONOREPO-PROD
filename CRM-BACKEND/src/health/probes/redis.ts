import { performance } from 'perf_hooks';
import { redisClient } from '@/config/redis';
import { THRESHOLDS } from '@/health/thresholds';
import { withTimeout } from '@/health/withTimeout';
import type { ServiceHealth } from '@/health/types';

export async function probeRedis(): Promise<ServiceHealth> {
  const t0 = performance.now();
  try {
    await withTimeout('redis', THRESHOLDS.redis.probe_timeout_ms, () => redisClient.ping());
    const latency = Math.round(performance.now() - t0);

    const status =
      latency >= THRESHOLDS.redis.latency_unhealthy_ms
        ? 'unhealthy'
        : latency >= THRESHOLDS.redis.latency_degraded_ms
          ? 'degraded'
          : 'healthy';

    return { status, latency_ms: latency };
  } catch (err) {
    return {
      status: 'unhealthy',
      latency_ms: Math.round(performance.now() - t0),
      message: err instanceof Error ? err.message : 'redis probe failed',
    };
  }
}
