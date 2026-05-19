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
// This module replaces the direct INSERT with a durable bullmq-backed
// queue. Every audit event is enqueued synchronously with a
// fire-and-forget call from the request path. A worker attached to
// the same queue then drains events onto the audit_logs table with
// bullmq's retry + dead-letter semantics.
//
// 2026-04-28 Medium Fix 7: migrated bull v4 → bullmq v5.
// - bullmq separates Queue (producer) from Worker (consumer); previous
//   single Bull object handled both via `.process()`.
// - bullmq requires every job to have a name string at `add()` time.
// - `removeOnComplete: <number>` is now `removeOnComplete: { count: <number> }`.
// - Worker reuses the same Redis connection config; events are exposed
//   on the Worker instance directly (no separate QueueEvents needed for
//   the failed/completed handlers we use).
//
// Public API (unchanged shape — callers don't notice the migration):
//   - enqueueAuditLog(data): fast synchronous-looking enqueue used
//     by src/utils/auditLogger.ts
//   - startAuditLogProcessor(): attach the worker; called once at
//     boot from src/index.ts
//   - stopAuditLogProcessor(): best-effort shutdown used by graceful
//     shutdown in src/index.ts

import { Queue, Worker, type Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { withTransaction } from '@/config/db';
import type { AuditLogData } from '@/utils/auditLogger';
import { computeRowHash } from '@/utils/auditChain';
import { errorMessage } from '@/utils/errorMessage';
import { writeAuditDeadLetter, recoverAuditDeadLetter } from './auditLogDeadLetter';

// T1-1 (audit 2026-05-17): single canonical insert path for the hash
// chain. Both the worker and the Redis-down fallback funnel through
// this so the hash logic cannot drift.
//
// Per-INSERT we take a transaction-scoped pg advisory lock to serialize
// the "read latest row_hash + compute new hash + INSERT" critical
// section across all worker concurrency slots and across all PM2
// workers. The lock auto-releases at COMMIT/ROLLBACK.
//
// `hashtext('audit_logs_chain')` is a stable int4. Postgres advisory
// locks take a bigint, so we sign-extend via bigint cast in SQL.
const ADVISORY_LOCK_KEY_SQL = "hashtext('audit_logs_chain')::bigint";

const insertAuditLogRow = async (data: AuditLogData): Promise<void> => {
  await withTransaction(async client => {
    await client.query(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY_SQL})`);

    // Pin created_at at the application clock so the value we feed to
    // computeRowHash matches the value the DB stores. (Reading
    // CURRENT_TIMESTAMP from the DB after insert would race; pinning
    // is the only way to keep sign-time = verify-time identical.)
    const createdAt = new Date();

    const prevRes = await client.query<{ row_hash: Buffer | null }>(
      `SELECT row_hash FROM audit_logs
        WHERE row_hash IS NOT NULL
        ORDER BY id DESC
        LIMIT 1`
    );
    const prevHash = prevRes.rows[0]?.row_hash ?? null;

    const rowHash = computeRowHash(prevHash, data, createdAt, config.auditLogHmacSecret);

    await client.query(
      `INSERT INTO audit_logs (
         action, entity_type, entity_id, user_id, details,
         ip_address, user_agent, created_at, prev_hash, row_hash
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.action,
        data.entityType,
        data.entityId ?? null,
        data.userId ?? null,
        data.details ? JSON.stringify(data.details) : null,
        data.ipAddress ?? null,
        data.userAgent ?? null,
        createdAt,
        prevHash,
        rowHash,
      ]
    );
  });
};

const QUEUE_NAME = 'audit-log-processing';
const JOB_NAME = 'audit-log';

// Parse Redis URL once — bullmq takes a structured connection config
// rather than a URL string. Mirror the pattern used in config/queue.ts
// so all bullmq queues across the codebase share the same connection
// shape (and the same Ops behaviour around hostname/port/password).
const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
  password: config.redisPassword || undefined,
};

export const auditLogQueue = new Queue<AuditLogData>(QUEUE_NAME, {
  connection,
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
    // bullmq syntax requires the object form: `{ count: N }`.
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

/**
 * Enqueue a single audit event. Returns a promise that resolves once
 * the job is accepted by bullmq — NOT once it's been persisted. Callers
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
    // bullmq requires a job name as the first argument to `.add()`.
    // We use a single job name (JOB_NAME) since the worker treats all
    // audit events identically.
    await auditLogQueue.add(JOB_NAME, data);
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
      await insertAuditLogRow(data);
    } catch (directError) {
      logger.error('Direct audit log fallback insert failed; writing to DLQ file', {
        error: errorMessage(directError),
      });
      await writeAuditDeadLetter(data);
    }
  }
};

let worker: Worker<AuditLogData> | null = null;

export const startAuditLogProcessor = (): void => {
  if (worker) {
    return;
  }

  // bullmq Worker is the consumer side. Concurrency is set on the
  // Worker constructor (was the first arg to bull's `.process()`).
  worker = new Worker<AuditLogData>(
    QUEUE_NAME,
    async (job: Job<AuditLogData>) => {
      await insertAuditLogRow(job.data);
    },
    {
      connection,
      concurrency: 10,
    }
  );

  worker.on('failed', (job, err) => {
    if (!job) {
      logger.warn('Audit log worker failure with no job context', {
        error: err.message,
      });
      return;
    }
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
    // After bullmq has exhausted all retries the job is removed by the
    // removeOnFail policy and the event would otherwise be lost.
    // Persist the payload to the file-based DLQ so the next process
    // start can replay it. (`attemptsMade` increments before the
    // failed event fires, so >= maxAttempts means terminal failure.)
    if (job.attemptsMade >= maxAttempts) {
      void writeAuditDeadLetter(job.data);
    }
  });

  worker.on('error', err => {
    logger.error('Audit log worker error', { error: errorMessage(err) });
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
    if (worker) {
      await worker.close();
      worker = null;
    }
    await auditLogQueue.close();
  } catch (error) {
    logger.error('Failed to close audit log queue:', error);
  }
};
