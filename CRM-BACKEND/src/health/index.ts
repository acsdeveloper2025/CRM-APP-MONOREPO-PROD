import { performance } from 'perf_hooks';
import { probeDatabase } from '@/health/probes/database';
import { probeRedis } from '@/health/probes/redis';
import { probeWorker } from '@/health/probes/worker';
import { probeApi } from '@/health/probes/api';
import { probeQueues } from '@/health/probes/queues';
import { probeStorage } from '@/health/probes/storage';
import { probeContainers } from '@/health/probes/containers';
import { probeFcm } from '@/health/probes/fcm';
import type { HealthLevel, HealthResponse, HealthStatus, ServiceHealth } from '@/health/types';

export const VALID_LEVELS: ReadonlyArray<HealthLevel> = ['basic', 'ready', 'full'];

/** @deprecated kept for backward compatibility with Phase 1 imports. */
export const VALID_LEVELS_PHASE_1 = VALID_LEVELS;

function rollup(services: Record<string, ServiceHealth>): HealthStatus {
  let degraded = false;
  for (const svc of Object.values(services)) {
    if (svc.status === 'unhealthy') {
      return 'unhealthy';
    }
    if (svc.status === 'degraded') {
      degraded = true;
    }
  }
  return degraded ? 'degraded' : 'healthy';
}

function envelope(
  level: HealthLevel,
  services: Record<string, ServiceHealth> | undefined,
  t0: number
): HealthResponse {
  const response: HealthResponse = {
    status: services ? rollup(services) : 'healthy',
    level,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checked_in_ms: Math.round(performance.now() - t0),
  };
  if (services) {
    response.services = services;
  }
  return response;
}

export async function runHealthCheck(level: HealthLevel): Promise<HealthResponse> {
  const t0 = performance.now();

  if (level === 'basic') {
    return envelope('basic', undefined, t0);
  }

  if (level === 'ready') {
    const [database, redis, worker] = await Promise.allSettled([
      probeDatabase(),
      probeRedis(),
      probeWorker(),
    ]);

    const services: Record<string, ServiceHealth> = {
      database: settle(database, 'database probe rejected'),
      redis: settle(redis, 'redis probe rejected'),
      worker: settle(worker, 'worker probe rejected'),
    };

    return envelope('ready', services, t0);
  }

  // level === 'full'
  const [database, redis, worker, queues, storage, containers, fcm] = await Promise.allSettled([
    probeDatabase(),
    probeRedis(true),
    probeWorker(),
    probeQueues(),
    probeStorage(),
    probeContainers(),
    probeFcm(),
  ]);
  const api = probeApi();

  const services: Record<string, ServiceHealth> = {
    api,
    database: settle(database, 'database probe rejected'),
    redis: settle(redis, 'redis probe rejected'),
    worker: settle(worker, 'worker probe rejected'),
    queues: settle(queues, 'queues probe rejected'),
    storage: settle(storage, 'storage probe rejected'),
    containers: settle(containers, 'containers probe rejected'),
    fcm: settle(fcm, 'fcm probe rejected'),
  };

  return envelope('full', services, t0);
}

function settle(
  result: PromiseSettledResult<ServiceHealth>,
  fallbackMessage: string
): ServiceHealth {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  return {
    status: 'unhealthy',
    message: result.reason instanceof Error ? result.reason.message : fallbackMessage,
  };
}
