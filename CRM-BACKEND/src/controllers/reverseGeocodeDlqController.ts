// G-HIGH-3 (AUDIT 2026-05-17): admin surface for reverse-geocode DLQ.
//
// When the BullMQ reverseGeocodeQueue worker exhausts its retry budget
// (Google outage, billing lapse, key revoked, etc.) the job is now
// persisted to reverse_geocode_dlq instead of vanishing. This controller
// exposes two ops endpoints to inspect + replay those failures.
//
// Routes (mounted at /api/reverse-geocode-dlq):
//   GET  /            — paginated list of unreplayed entries
//   POST /:id/replay  — re-enqueue the geocode job + mark replayed

import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { errorMessage } from '@/utils/errorMessage';
import { enqueueReverseGeocode } from '@/queues/reverseGeocodeQueue';

interface DlqRow {
  id: string;
  attachment_id: string;
  latitude: string;
  longitude: string;
  error: string;
  attempts: number;
  created_at: Date;
  replayed_at: Date | null;
}

export const listReverseGeocodeDlq = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
  const offset = (page - 1) * limit;
  const includeReplayed = String(req.query.includeReplayed ?? 'false') === 'true';

  try {
    const where = includeReplayed ? '' : 'WHERE replayed_at IS NULL';
    const dataRes = await query<DlqRow>(
      `SELECT id, attachment_id, latitude, longitude, error, attempts, created_at, replayed_at
         FROM reverse_geocode_dlq
         ${where}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countRes = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM reverse_geocode_dlq ${where}`
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        total: Number(countRes.rows[0]?.total ?? 0),
      },
    });
  } catch (err) {
    logger.error('listReverseGeocodeDlq failed', { error: errorMessage(err) });
    res.status(500).json({
      success: false,
      message: 'Failed to list reverse-geocode DLQ entries',
      error: { code: 'DLQ_LIST_FAILED' },
    });
  }
};

export const replayReverseGeocodeDlqEntry = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const idStr = String(req.params.id ?? '');
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({
      success: false,
      message: 'Invalid DLQ entry id',
      error: { code: 'INVALID_DLQ_ID' },
    });
    return;
  }

  try {
    // Atomic claim: set replayed_at IF still NULL. Prevents double-replay
    // races between two admins clicking the button at the same moment.
    const claim = await query<DlqRow>(
      `UPDATE reverse_geocode_dlq
          SET replayed_at = now()
        WHERE id = $1
          AND replayed_at IS NULL
        RETURNING id, attachment_id, latitude, longitude, error, attempts, created_at, replayed_at`,
      [id]
    );

    if (claim.rows.length === 0) {
      res.status(409).json({
        success: false,
        message: 'DLQ entry not found or already replayed',
        error: { code: 'DLQ_ALREADY_REPLAYED' },
      });
      return;
    }

    const row = claim.rows[0];
    await enqueueReverseGeocode({
      attachmentId: Number(row.attachment_id),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });

    res.json({
      success: true,
      message: 'Reverse-geocode job re-enqueued',
      data: row,
    });
  } catch (err) {
    logger.error('replayReverseGeocodeDlqEntry failed', {
      id,
      error: errorMessage(err),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to replay DLQ entry',
      error: { code: 'DLQ_REPLAY_FAILED' },
    });
  }
};
