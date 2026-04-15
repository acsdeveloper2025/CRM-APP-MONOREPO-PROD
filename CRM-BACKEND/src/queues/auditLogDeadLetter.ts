// File-based dead-letter queue for audit events.
//
// The Bull-backed audit queue (auditLogQueue.ts) already retries with
// exponential backoff and falls back to a direct DB insert when Redis
// is down. The remaining gap — flagged by the 2026-03-26 audit — is
// the case where BOTH paths fail in the same outage window: Redis is
// unreachable AND the DB is unreachable (or rejecting the insert).
// Before this module the only record of the event was a `logger.error`
// line on stdout, which doesn't survive log rotation and isn't replayed
// when the cluster recovers.
//
// This module appends those final-fallback events to a JSONL file on
// local disk and provides a recovery routine that drains the file back
// into the queue at startup. Append is line-oriented and lock-free —
// fs.appendFile on POSIX is atomic for writes ≤ PIPE_BUF (typically
// 4096 bytes), and our serialised AuditLogData rows are well under
// that, so a multi-process cluster can all write to the same file
// without interleaving.
//
// Format: one JSON object per line. Each line is a complete
// AuditLogData payload plus an `enqueueFailedAt` ISO timestamp so
// recovery can preserve original ordering for forensics.

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from '@/config/logger';
import { config } from '@/config';
import { errorMessage } from '@/utils/errorMessage';
import type { AuditLogData } from '@/utils/auditLogger';

const DLQ_FILENAME = 'audit-dlq.jsonl';

interface DeadLetterEntry extends AuditLogData {
  enqueueFailedAt: string;
}

let cachedDlqPath: string | null = null;

/**
 * Resolve the absolute path to the DLQ file. Lives next to the
 * configured upload path so it shares the same writable mount in
 * containerised deployments. Created lazily — the directory is only
 * touched when something actually needs to write.
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
 * Append a single audit event to the DLQ file. Caller is expected to
 * have already exhausted the queue + direct-insert paths. This call
 * never throws; if writing the DLQ itself fails we log loudly so the
 * loss is visible in stdout / the log shipper.
 */
export const writeAuditDeadLetter = async (data: AuditLogData): Promise<void> => {
  const entry: DeadLetterEntry = {
    ...data,
    enqueueFailedAt: new Date().toISOString(),
  };
  const line = `${JSON.stringify(entry)}\n`;
  const dlqPath = getDlqPath();
  try {
    await fs.mkdir(path.dirname(dlqPath), { recursive: true });
    await fs.appendFile(dlqPath, line, { encoding: 'utf8' });
    logger.warn('Audit event written to local dead-letter file', {
      action: data.action,
      entityType: data.entityType,
      dlqPath,
    });
  } catch (error) {
    logger.error('Failed to write audit event to dead-letter file', {
      action: data.action,
      entityType: data.entityType,
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
 * Recover audit events from the DLQ file by re-enqueueing them. Run at
 * boot (after the queue processor is attached) so a previous outage's
 * dropped events get a fresh attempt as soon as Redis is reachable
 * again.
 *
 * Atomicity: the DLQ file is renamed to a `.replay` sibling before
 * processing so concurrent `writeAuditDeadLetter` calls during the
 * recovery don't get re-read in the same sweep. Successfully recovered
 * lines are dropped; lines that fail to re-enqueue are written to a
 * new `.failed` file for manual triage rather than re-appended to the
 * live DLQ (which would create a busy retry loop).
 *
 * The enqueue function is injected to avoid a circular import between
 * this module and auditLogQueue.ts.
 */
export const recoverAuditDeadLetter = async (
  enqueue: (data: AuditLogData) => Promise<void>
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
    logger.error('Failed to claim audit DLQ file for recovery (skipping run)', {
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
      logger.warn('Malformed line in audit DLQ replay; routing to .failed', {
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
      // Strip the recovery-only field before re-enqueueing so the
      // event reaches the queue processor with its original shape.
      const { enqueueFailedAt: _ignored, ...payload } = entry;
      await enqueue(payload);
      result.reEnqueued += 1;
    } catch (enqueueError) {
      logger.warn('Failed to re-enqueue audit DLQ entry; routing to .failed', {
        replayPath,
        action: entry.action,
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

  // Clean up the consumed replay file regardless of outcome — we've
  // either re-enqueued the entry or copied it to .failed.
  try {
    await fs.unlink(replayPath);
  } catch (cleanupError) {
    logger.warn('Failed to delete consumed audit DLQ replay file', {
      replayPath,
      error: errorMessage(cleanupError),
    });
  }

  if (result.totalLines > 0) {
    logger.info('Audit DLQ recovery completed', result);
  }
  return result;
};
