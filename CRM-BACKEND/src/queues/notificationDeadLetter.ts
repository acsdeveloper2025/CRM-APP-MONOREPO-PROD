// File-based dead-letter queue for notification jobs.
//
// The BullMQ notification queue (notificationQueue.ts) retries failed jobs
// up to 3× with exponential backoff, then evicts them (removeOnFail keeps
// only the last 50 for inspection). The gap — flagged by the 2026-06-01
// error-handling audit (#10) — is the terminally-failed job: a
// CASE_ASSIGNED / REVOCATION notification that exhausts all attempts is
// dropped with only a `logger.error` line, which doesn't survive log
// rotation and isn't replayed when the cluster recovers.
//
// This module appends those terminally-failed jobs to a JSONL file on
// local disk and provides a recovery routine that drains the file back
// into the queue at startup. It mirrors auditLogDeadLetter.ts (same
// rename-to-.replay atomicity + .failed quarantine). The one difference:
// the notification queue dispatches by job NAME (6 names on one queue), so
// each entry stores `{ jobName, data }` and recovery re-enqueues with the
// original name.
//
// Append is line-oriented and lock-free — fs.appendFile on POSIX is atomic
// for writes ≤ PIPE_BUF (typically 4096 bytes); serialised notification
// payloads are well under that, so a multi-process cluster can all write to
// the same file without interleaving.

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { errorMessage } from '@/utils/errorMessage';
import type { NotificationJobData } from './notificationQueue';

const DLQ_FILENAME = 'notification-dlq.jsonl';

interface DeadLetterEntry {
  jobName: string;
  data: NotificationJobData;
  enqueueFailedAt: string;
}

let cachedDlqPath: string | null = null;

/**
 * Resolve the absolute path to the DLQ file. Lives next to the configured
 * upload path so it shares the same writable mount in containerised
 * deployments. Created lazily.
 */
const getDlqPath = (): string => {
  if (cachedDlqPath) {
    return cachedDlqPath;
  }
  const dir = path.resolve(config.uploadPath || './uploads');
  cachedDlqPath = path.join(dir, DLQ_FILENAME);
  return cachedDlqPath;
};

/**
 * Append a single terminally-failed notification job to the DLQ file.
 * Caller is expected to have already exhausted the queue's retry budget.
 * Never throws; if writing the DLQ itself fails we log loudly so the loss
 * is visible in stdout / the log shipper.
 */
export const writeNotificationDeadLetter = async (
  jobName: string,
  data: NotificationJobData
): Promise<void> => {
  const entry: DeadLetterEntry = {
    jobName,
    data,
    enqueueFailedAt: new Date().toISOString(),
  };
  const line = `${JSON.stringify(entry)}\n`;
  const dlqPath = getDlqPath();
  try {
    await fs.mkdir(path.dirname(dlqPath), { recursive: true });
    await fs.appendFile(dlqPath, line, { encoding: 'utf8' });
    logger.warn('Notification job written to local dead-letter file', { jobName, dlqPath });
  } catch (error) {
    logger.error('Failed to write notification job to dead-letter file', {
      jobName,
      dlqPath,
      error: errorMessage(error),
    });
  }
};

/**
 * Result of a recovery sweep, returned for telemetry / startup logs.
 */
export interface RecoveryResult {
  filePresent: boolean;
  totalLines: number;
  reEnqueued: number;
  failed: number;
  remainingPath: string | null;
}

/**
 * Recover notification jobs from the DLQ file by re-enqueueing them. Run at
 * boot (after the queue processor is attached) so a previous outage's
 * dropped notifications get a fresh attempt as soon as Redis is reachable.
 *
 * Atomicity: the DLQ file is renamed to a `.replay` sibling before
 * processing so concurrent `writeNotificationDeadLetter` calls during
 * recovery aren't re-read in the same sweep. Successfully recovered lines
 * are dropped; lines that fail to re-enqueue go to a new `.failed` file for
 * manual triage rather than back into the live DLQ (which would create a
 * busy retry loop).
 *
 * The re-enqueue function is injected to avoid a circular import between
 * this module and notificationQueue.ts.
 */
export const recoverNotificationDeadLetter = async (
  reEnqueue: (jobName: string, data: NotificationJobData) => Promise<void>
): Promise<RecoveryResult> => {
  const dlqPath = getDlqPath();
  const result: RecoveryResult = {
    filePresent: false,
    totalLines: 0,
    reEnqueued: 0,
    failed: 0,
    remainingPath: null,
  };

  if (!fsSync.existsSync(dlqPath)) {
    return result;
  }
  result.filePresent = true;

  const replayPath = `${dlqPath}.${Date.now()}.replay`;
  try {
    await fs.rename(dlqPath, replayPath);
  } catch (error) {
    logger.error('Failed to claim notification DLQ file for recovery (skipping run)', {
      dlqPath,
      error: errorMessage(error),
    });
    return result;
  }

  const failedPath = `${replayPath}.failed`;
  let failedHandle: fsSync.WriteStream | null = null;
  const readStream = fsSync.createReadStream(replayPath, { encoding: 'utf8' });
  const reader = readline.createInterface({ input: readStream, crlfDelay: Infinity });

  for await (const line of reader) {
    if (!line.trim()) {
      continue;
    }
    result.totalLines += 1;
    let entry: DeadLetterEntry;
    try {
      entry = JSON.parse(line) as DeadLetterEntry;
    } catch (parseError) {
      logger.warn('Malformed line in notification DLQ replay; routing to .failed', {
        replayPath,
        error: errorMessage(parseError),
      });
      if (!failedHandle) {
        failedHandle = fsSync.createWriteStream(failedPath, { flags: 'a' });
      }
      failedHandle.write(`${line}\n`);
      result.failed += 1;
      continue;
    }
    try {
      await reEnqueue(entry.jobName, entry.data);
      result.reEnqueued += 1;
    } catch (enqueueError) {
      logger.warn('Failed to re-enqueue notification DLQ entry; routing to .failed', {
        replayPath,
        jobName: entry.jobName,
        error: errorMessage(enqueueError),
      });
      if (!failedHandle) {
        failedHandle = fsSync.createWriteStream(failedPath, { flags: 'a' });
      }
      failedHandle.write(`${line}\n`);
      result.failed += 1;
    }
  }

  if (failedHandle) {
    const handle = failedHandle;
    await new Promise<void>(resolve => handle.end(() => resolve()));
    result.remainingPath = failedPath;
  }

  // Clean up the consumed replay file regardless of outcome — we've either
  // re-enqueued the entry or copied it to .failed.
  try {
    await fs.unlink(replayPath);
  } catch (cleanupError) {
    logger.warn('Failed to delete consumed notification DLQ replay file', {
      replayPath,
      error: errorMessage(cleanupError),
    });
  }

  if (result.totalLines > 0) {
    logger.info('Notification DLQ recovery completed', result);
  }
  return result;
};
