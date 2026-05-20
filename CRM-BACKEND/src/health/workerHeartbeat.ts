import { redisClient } from '@/config/redis';
import { logger } from '@/config/logger';
import { THRESHOLDS } from '@/health/thresholds';

let intervalHandle: NodeJS.Timeout | null = null;

async function writeHeartbeat(): Promise<void> {
  try {
    await redisClient.setEx(
      THRESHOLDS.worker.heartbeat_redis_key,
      THRESHOLDS.worker.heartbeat_ttl_s,
      String(Date.now())
    );
  } catch (err) {
    logger.debug('worker heartbeat write failed', { err });
  }
}

export function startWorkerHeartbeat(): void {
  if (intervalHandle) {
    return;
  }
  void writeHeartbeat();
  intervalHandle = setInterval(
    () => void writeHeartbeat(),
    THRESHOLDS.worker.heartbeat_write_interval_ms
  );
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
  logger.info('worker heartbeat started', {
    key: THRESHOLDS.worker.heartbeat_redis_key,
    interval_ms: THRESHOLDS.worker.heartbeat_write_interval_ms,
  });
}

export async function stopWorkerHeartbeat(): Promise<void> {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  try {
    await redisClient.del(THRESHOLDS.worker.heartbeat_redis_key);
  } catch {
    // Redis may already be closing — TTL will expire the key anyway.
  }
}
