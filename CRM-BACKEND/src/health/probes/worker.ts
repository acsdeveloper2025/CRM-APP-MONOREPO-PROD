import { redisClient } from '@/config/redis';
import { THRESHOLDS } from '@/health/thresholds';
import { withTimeout } from '@/health/withTimeout';
import type { ServiceHealth } from '@/health/types';

export async function probeWorker(): Promise<ServiceHealth> {
  try {
    const raw = await withTimeout('worker', THRESHOLDS.worker.probe_timeout_ms, () =>
      redisClient.get(THRESHOLDS.worker.heartbeat_redis_key)
    );

    if (!raw) {
      return {
        status: 'unhealthy',
        message: 'no worker heartbeat key present',
      };
    }

    const writtenAtMs = Number(raw);
    if (!Number.isFinite(writtenAtMs)) {
      return { status: 'unhealthy', message: 'worker heartbeat value invalid' };
    }

    const ageS = Math.round((Date.now() - writtenAtMs) / 1000);
    const status =
      ageS >= THRESHOLDS.worker.heartbeat_unhealthy_age_s
        ? 'unhealthy'
        : ageS >= THRESHOLDS.worker.heartbeat_degraded_age_s
          ? 'degraded'
          : 'healthy';

    return { status, details: { heartbeat_age_s: ageS } };
  } catch (err) {
    return {
      status: 'unhealthy',
      message: err instanceof Error ? err.message : 'worker probe failed',
    };
  }
}
