import { performance } from 'perf_hooks';
import { redisClient } from '@/config/redis';
import { THRESHOLDS } from '@/health/thresholds';
import { withTimeout } from '@/health/withTimeout';
import type { ServiceHealth } from '@/health/types';

function parseInfo(raw: string, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) {
      continue;
    }
    const k = line.slice(0, idx);
    if (keys.includes(k)) {
      out[k] = line.slice(idx + 1).trim();
    }
  }
  return out;
}

export async function probeRedis(includeInfo = false): Promise<ServiceHealth> {
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

    if (!includeInfo) {
      return { status, latency_ms: latency };
    }

    try {
      const [mem, clients] = await Promise.all([
        withTimeout('redis:info-memory', THRESHOLDS.redis.probe_timeout_ms, () =>
          redisClient.info('memory')
        ),
        withTimeout('redis:info-clients', THRESHOLDS.redis.probe_timeout_ms, () =>
          redisClient.info('clients')
        ),
      ]);
      const memParsed = parseInfo(mem, ['used_memory_human', 'used_memory']);
      const cliParsed = parseInfo(clients, ['connected_clients']);
      return {
        status,
        latency_ms: latency,
        details: {
          used_memory_human: memParsed.used_memory_human,
          used_memory_bytes: memParsed.used_memory ? Number(memParsed.used_memory) : undefined,
          connected_clients: cliParsed.connected_clients
            ? Number(cliParsed.connected_clients)
            : undefined,
        },
      };
    } catch {
      // INFO failed but PING succeeded — keep status as-is, omit details.
      return { status, latency_ms: latency };
    }
  } catch (err) {
    return {
      status: 'unhealthy',
      latency_ms: Math.round(performance.now() - t0),
      message: err instanceof Error ? err.message : 'redis probe failed',
    };
  }
}
