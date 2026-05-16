// Reverse-geocode backfill queue — 2026-05-13.
//
// Shifts the cost-vs-latency Google geocoding call from "first admin
// view of a photo" to "upload time on the backend, fire-and-forget".
// Result: every attachment has its reverse_geocoded_address populated
// shortly after upload, so the GET /api/attachments/:id/address fast
// path always hits the DB-stored value and never calls Google.
//
// Mirrors the bullmq pattern from src/queues/auditLogQueue.ts (single
// non-pub/sub Redis client; explicit worker lifecycle for graceful
// shutdown; retry + light dead-lettering via removeOnFail).
//
// Why not call mobileLocationController.reverseGeocodeHelper inline
// from uploadVerificationImages? Two reasons:
//   1. Google can take 150-400ms; we don't want to extend the
//      mobile upload response by that. Mobile is field network, ms
//      matters for the agent's UX.
//   2. Google can fail (REQUEST_DENIED on billing lapse, 5xx on
//      transient outages). A failed geocode must NOT fail the upload.
//      The queue retries independently; the upload row lands cleanly.

import { Queue, Worker, type Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { query } from '@/config/database';
import { errorMessage } from '@/utils/errorMessage';
import { MobileLocationController } from '@/controllers/mobileLocationController';

const QUEUE_NAME = 'reverse-geocode-backfill';
const JOB_NAME = 'reverse-geocode';

export interface ReverseGeocodeJobData {
  attachmentId: number;
  latitude: number;
  longitude: number;
}

const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
  password: config.redisPassword || undefined,
};

export const reverseGeocodeQueue = new Queue<ReverseGeocodeJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    // Google rate-limits at 50 QPS on the project's default quota; if
    // the API is denied (billing lapse, key invalid) retrying hard
    // just spams quota errors into the log. Three attempts with 5s
    // exponential backoff covers transient network blips without
    // amplifying a real outage.
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

/**
 * Enqueue a reverse-geocode job. Fire-and-forget — if the enqueue
 * itself fails (Redis down) we log and move on. The lazy on-view
 * resolve path in geocodeController.attachmentAddress is the safety
 * net: any attachment whose backfill job got dropped will still get
 * its address on first admin view.
 */
export const enqueueReverseGeocode = async (data: ReverseGeocodeJobData): Promise<void> => {
  if (
    !Number.isFinite(data.attachmentId) ||
    !Number.isFinite(data.latitude) ||
    !Number.isFinite(data.longitude)
  ) {
    return;
  }
  try {
    await reverseGeocodeQueue.add(JOB_NAME, data, {
      // Idempotency: per-attachment dedupe. If the same attachment is
      // re-enqueued (e.g., backfill script + upload-time enqueue
      // racing), bullmq drops the duplicate.
      jobId: `attach_${data.attachmentId}`,
    });
  } catch (error) {
    logger.warn('Failed to enqueue reverse-geocode job', {
      attachmentId: data.attachmentId,
      error: errorMessage(error),
    });
  }
};

let worker: Worker<ReverseGeocodeJobData> | null = null;

export const startReverseGeocodeProcessor = (): void => {
  if (worker) {
    return;
  }

  worker = new Worker<ReverseGeocodeJobData>(
    QUEUE_NAME,
    async (job: Job<ReverseGeocodeJobData>) => {
      const { attachmentId, latitude, longitude } = job.data;

      // Idempotent: skip if already resolved. Avoids redundant Google
      // calls when both the upload-time enqueue + the backfill script
      // queued the same attachment.
      const existing = await query<{ reverse_geocoded_address: string | null }>(
        `SELECT reverse_geocoded_address FROM verification_attachments WHERE id = $1`,
        [attachmentId]
      );
      if (existing.rows.length === 0) {
        // Attachment row was deleted between enqueue + drain. Drop.
        return;
      }
      if (existing.rows[0].reverse_geocoded_address) {
        return;
      }

      const address = await MobileLocationController.reverseGeocodeHelper(latitude, longitude);
      if (!address) {
        // Treat as a job failure so bullmq retries with backoff.
        // The DB row stays NULL; the on-view fallback path will retry
        // later when an admin actually looks at the photo.
        throw new Error(`Reverse geocode returned null for (${latitude},${longitude})`);
      }

      // Write-through with the freeze-trigger-friendly WHERE clause.
      // If a racing on-view resolve already set the value, we drop our
      // update (matches the same idempotency contract as the on-view
      // path in geocodeController.attachmentAddress).
      await query(
        `UPDATE verification_attachments
            SET reverse_geocoded_address = $1
          WHERE id = $2
            AND reverse_geocoded_address IS NULL`,
        [address, attachmentId]
      );
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    if (!job) {
      logger.warn('Reverse-geocode worker failure with no job context', {
        error: err.message,
      });
      return;
    }
    const opts = job.opts ?? {};
    const maxAttempts = typeof opts.attempts === 'number' ? opts.attempts : 1;
    logger.warn('Reverse-geocode job failed', {
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts,
      attachmentId: job.data.attachmentId,
      error: err.message,
    });

    // G-HIGH-3 (AUDIT 2026-05-17): on FINAL failure (retries exhausted),
    // persist to reverse_geocode_dlq so the attachment can be replayed
    // via admin endpoint. Without this, the job vanished silently —
    // any Google outage / billing lapse left attachments permanently
    // address-less because the freeze-trigger blocks future re-resolve.
    if (job.attemptsMade >= maxAttempts) {
      void query(
        `INSERT INTO reverse_geocode_dlq (attachment_id, latitude, longitude, error, attempts)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          job.data.attachmentId,
          job.data.latitude,
          job.data.longitude,
          err.message,
          job.attemptsMade,
        ]
      ).catch(dlqErr => {
        logger.error('Failed to write reverse-geocode DLQ entry', {
          attachmentId: job.data.attachmentId,
          jobError: err.message,
          dlqError: errorMessage(dlqErr),
        });
      });
    }
  });

  worker.on('error', err => {
    logger.error('Reverse-geocode worker error', { error: errorMessage(err) });
  });

  logger.info('Reverse-geocode queue processor started');
};

export const stopReverseGeocodeProcessor = async (): Promise<void> => {
  try {
    if (worker) {
      await worker.close();
      worker = null;
    }
    await reverseGeocodeQueue.close();
  } catch (error) {
    logger.warn('Reverse-geocode queue shutdown error (continuing)', {
      error: errorMessage(error),
    });
  }
};
