import { auditLogQueue } from '@/queues/auditLogQueue';
import { notificationQueue } from '@/queues/notificationQueue';
import { reverseGeocodeQueue } from '@/queues/reverseGeocodeQueue';
import { THRESHOLDS } from '@/health/thresholds';
import { withTimeout } from '@/health/withTimeout';
import type { HealthStatus, ServiceHealth } from '@/health/types';

const QUEUES = {
  auditLog: auditLogQueue,
  notification: notificationQueue,
  reverseGeocode: reverseGeocodeQueue,
} as const;

interface QueueCounts {
  status: HealthStatus;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  completed: number;
}

function pickQueueStatus(waiting: number, failed: number): HealthStatus {
  if (
    waiting >= THRESHOLDS.queues.waiting_unhealthy ||
    failed >= THRESHOLDS.queues.failed_unhealthy
  ) {
    return 'unhealthy';
  }
  if (
    waiting >= THRESHOLDS.queues.waiting_degraded ||
    failed >= THRESHOLDS.queues.failed_degraded
  ) {
    return 'degraded';
  }
  return 'healthy';
}

function worstOf(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }
  if (statuses.includes('degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

export async function probeQueues(): Promise<ServiceHealth> {
  const details: Record<string, QueueCounts | { status: HealthStatus; error: string }> = {};
  const collected: HealthStatus[] = [];

  for (const [name, q] of Object.entries(QUEUES)) {
    try {
      const counts = await withTimeout(`queues:${name}`, THRESHOLDS.queues.probe_timeout_ms, () =>
        q.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed')
      );
      const waiting = counts.waiting ?? 0;
      const active = counts.active ?? 0;
      const failed = counts.failed ?? 0;
      const delayed = counts.delayed ?? 0;
      const completed = counts.completed ?? 0;
      const status = pickQueueStatus(waiting, failed);
      details[name] = { status, waiting, active, failed, delayed, completed };
      collected.push(status);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'queue probe failed';
      details[name] = { status: 'unhealthy', error: message };
      collected.push('unhealthy');
    }
  }

  return {
    status: worstOf(collected),
    details,
  };
}
