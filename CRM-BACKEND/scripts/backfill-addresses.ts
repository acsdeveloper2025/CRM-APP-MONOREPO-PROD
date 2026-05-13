#!/usr/bin/env ts-node
// One-shot backfill: enqueue reverse-geocode jobs for every
// verification_attachments row whose reverse_geocoded_address is NULL.
// Run once after deploy to populate the ~67% of rows that were
// uploaded before the upload-time enqueue was wired.
//
//   cd CRM-BACKEND && npx ts-node scripts/backfill-addresses.ts
//
// Idempotent: re-runs skip already-resolved rows (worker also rechecks
// before calling Google). bullmq dedupes by jobId so re-enqueues land
// as no-ops while the previous run is still draining.

import { query } from '../src/config/database';
import { enqueueReverseGeocode } from '../src/queues/reverseGeocodeQueue';
import { logger } from '../src/config/logger';

interface UnresolvedRow {
  id: number;
  latitude: number | null;
  longitude: number | null;
}

async function main(): Promise<void> {
  logger.info('Reverse-geocode backfill: scanning for unresolved attachments…');

  const result = await query<UnresolvedRow>(
    `SELECT id,
            NULLIF(geo_location->>'latitude','')::double precision  AS latitude,
            NULLIF(geo_location->>'longitude','')::double precision AS longitude
       FROM verification_attachments
      WHERE reverse_geocoded_address IS NULL
        AND geo_location IS NOT NULL
        AND deleted_at IS NULL
      ORDER BY id ASC`
  );

  const candidates = result.rows.filter(
    r =>
      r.latitude != null &&
      r.longitude != null &&
      Number.isFinite(r.latitude) &&
      Number.isFinite(r.longitude)
  );

  logger.info(`Found ${candidates.length} unresolved attachments`);

  let enqueued = 0;
  for (const row of candidates) {
    await enqueueReverseGeocode({
      attachmentId: row.id,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
    });
    enqueued++;
    if (enqueued % 50 === 0) {
      logger.info(`  …enqueued ${enqueued}/${candidates.length}`);
    }
  }

  logger.info(`Backfill complete: ${enqueued} jobs queued`);
  logger.info(
    'Worker concurrency=5 → drains ~5/sec at Google QPS; check pm2 logs for "Reverse-geocode job failed" entries.'
  );
  process.exit(0);
}

main().catch(err => {
  logger.error('Backfill failed:', err);
  process.exit(1);
});
