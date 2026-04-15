// Audit log queue — Phase D3.
//
// The original auditLogger.ts issued a direct INSERT and swallowed any
// error with a logger.error() call. That meant:
//
//   1. A transient DB hiccup during a burst of audit writes silently
//      dropped records with no replay.
//   2. A pool-exhaustion incident (e.g., the performance_metrics write
//      path before C3 batching) could cause audit writes to queue up
//      on the request's own connection, amplifying the outage.
//   3. Pg failures on the audit path could never be observed by Ops
//      because the caller was instructed to NOT propagate the error.
//
// This module replaces the direct INSERT with a durable bull-backed
// queue. Every audit event is enqueued synchronously with a
// fire-and-forget call from the request path. A worker attached to
// the same queue then drains events onto the audit_logs table with
// bull's retry + dead-letter semantics.
//
// Public API:
//   - enqueueAuditLog(data): fast synchronous-looking enqueue used
//     by src/utils/auditLogger.ts
//   - startAuditLogProcessor(): attach the worker; called once at
//     boot from src/index.ts
//   - stopAuditLogProcessor(): best-effort shutdown used by graceful
//     shutdown in src/index.ts

import Bull from 'bull';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { query } from '@/config/database';
import type { AuditLogData } from '@/utils/auditLogger';
import { errorMessage } from '@/utils/errorMessage';
import { writeAuditDeadLetter, recoverAuditDeadLetter } from './auditLogDeadLetter';

const QUEUE_NAME = 'audit-log-processing';

export const auditLogQueue = new Bull<AuditLogData>(QUEUE_NAME, {
  redis: config.redisUrl,
  defaultJobOptions: {
    // Retry with exponential backoff. 5 attempts × 2s base backoff
    // spreads retries across ~30s which is long enough to ride out a
    // short DB blip without retry-stampeding against a longer outage.
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    // Keep a rolling window of completed/failed jobs for Ops inspection.
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

/**
 * Enqueue a single audit event. Returns a promise that resolves once
 * the job is accepted by Bull — NOT once it's been persisted. Callers
 * that already don't block on audit writes keep their semantics.
 *
 * If the enqueue itself fails (Redis down, queue paused, etc.) we log
 * the error but do not throw — matches the historical contract that
 * audit logging never blocks the main operation. In the Redis-down
 * case we also fall back to the direct INSERT so audits still land
 * when observability is most needed.
 */
export const enqueueAuditLog = async (data: AuditLogData): Promise<void> => {
  try {
    await auditLogQueue.add(data, { jobId: undefined });
  } catch (error) {
    logger.error('Failed to enqueue audit log, falling back to direct insert', {
      error: errorMessage(error),
    });
    // Fallback chain when the queue itself is unavailable:
    //   1. Try a direct INSERT against the audit_logs table.
    //   2. If that also fails, persist the event to the on-disk DLQ
    //      (auditLogDeadLetter.ts) so the cluster's startup recovery
    //      sweep can replay it once Redis/DB are back.
    try {
      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          data.action,
          data.entityType,
          data.entityId ?? null,
          data.userId ?? null,
          data.details ? JSON.stringify(data.details) : null,
          data.ipAddress ?? null,
          data.userAgent ?? null,
        ]
      );
    } catch (directError) {
      logger.error('Direct audit log fallback insert failed; writing to DLQ file', {
        error: errorMessage(directError),
      });
      await writeAuditDeadLetter(data);
    }
  }
};

let processorStarted = false;

export const startAuditLogProcessor = (): void => {
  if (processorStarted) {
    return;
  }
  processorStarted = true;

  auditLogQueue
    .process(10, async job => {
      const data = job.data;
      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          data.action,
          data.entityType,
          data.entityId ?? null,
          data.userId ?? null,
          data.details ? JSON.stringify(data.details) : null,
          data.ipAddress ?? null,
          data.userAgent ?? null,
        ]
      );
    })
    .catch(err => {
      logger.error('Audit log processor setup error:', err);
    });

  auditLogQueue.on('failed', (job, err) => {
    const opts = job.opts ?? {};
    const maxAttempts = typeof opts.attempts === 'number' ? opts.attempts : 1;
    logger.warn('Audit log job failed', {
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts,
      action: job.data.action,
      entityType: job.data.entityType,
      error: err.message,
    });
    // After Bull has exhausted all retries the job is removed by
    // removeOnFail policy and the event would otherwise be lost.
    // Persist the payload to the file-based DLQ so the next process
    // start can replay it.
    if (job.attemptsMade >= maxAttempts) {
      void writeAuditDeadLetter(job.data);
    }
  });

  // Best-effort replay of any events parked in the DLQ during a
  // previous outage. Runs once per process start, after the worker is
  // attached so the re-enqueued jobs are picked up immediately.
  void recoverAuditDeadLetter(enqueueAuditLog).catch(err => {
    logger.error('Audit DLQ recovery sweep failed', { error: errorMessage(err) });
  });

  logger.info('Audit log queue processor started');
};

export const stopAuditLogProcessor = async (): Promise<void> => {
  try {
    await auditLogQueue.close();
    processorStarted = false;
  } catch (error) {
    logger.error('Failed to close audit log queue:', error);
  }
};
