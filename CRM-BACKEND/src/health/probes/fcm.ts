// FCM health probe — surfaces push-notification subsystem state to ops via
// `/api/health?level=full`. Added 2026-05-21 after a two-bug outage (worker
// could not read /run/secrets/firebase-service-account; mobile APK shipped
// with deleted Firebase project config). Both bugs were silent — the
// `'Notification sent successfully'` log line fired because the parallel WS
// delivery leg succeeded, masking the push failure.
//
// Probe answers three operational questions:
//   1. Did the worker's PushNotificationService.initializeFCM() succeed?
//      (fcm_initialized: false → unhealthy → page ops)
//   2. When did we last successfully hand a push to FCM/APNs?
//      (last_successful_push timestamp)
//   3. How many push attempts have failed in the past hour?
//      (push_failures_last_hour — high values may indicate stale tokens,
//      throttling, Firebase outage, or upstream APK-side misconfig)
//
// Failure classification:
//   - unhealthy: FCM SDK didn't initialize at all
//   - degraded:  > THRESHOLD failures in last hour (likely token rot or
//                upstream issue), OR no successful push in 24h while
//                tokens exist
//   - healthy:   FCM ready + recent success OR no recent attempts (cold
//                queue is not a problem)

import { query } from '@/config/database';
import { PushNotificationService } from '@/services/PushNotificationService';
import { withTimeout } from '@/health/withTimeout';
import type { ServiceHealth } from '@/health/types';

const PROBE_TIMEOUT_MS = 1500;
// Soft cap — above this, mark degraded so ops investigates. Push failures
// usually come in bursts (token rot after an app reinstall fleet-wide).
// 50/hr is conservative for a 30-50 agent fleet; tune up as fleet grows.
const FAILURE_THRESHOLD_PER_HOUR = 50;
// If we've never seen a successful push in the last 24h while tokens
// exist in the DB, the path is silently broken — degraded.
const SUCCESS_DROUGHT_HOURS = 24;

type StatsRow = {
  last_success: Date | null;
  failures_last_hour: number;
  active_tokens: number;
};

export async function probeFcm(): Promise<ServiceHealth> {
  try {
    const pushService = PushNotificationService.getInstance();
    const fcmReady = pushService.isFcmReady();
    const apnsReady = pushService.isApnsReady();

    // One round-trip for all three counters. notification_delivery_log
    // is small (delivery attempts only) and indexed on attempted_at;
    // notification_tokens is < a few hundred rows.
    const result = await withTimeout('fcm', PROBE_TIMEOUT_MS, () =>
      query<StatsRow>(
        `SELECT
           (SELECT MAX(attempted_at) FROM notification_delivery_log
              WHERE delivery_method = 'PUSH' AND delivery_status = 'SENT') AS last_success,
           (SELECT COUNT(*)::int FROM notification_delivery_log
              WHERE delivery_method = 'PUSH' AND delivery_status = 'FAILED'
              AND attempted_at > now() - interval '1 hour') AS failures_last_hour,
           (SELECT COUNT(*)::int FROM notification_tokens
              WHERE is_active = true) AS active_tokens`
      )
    );

    const row = result.rows[0] || ({} as StatsRow);
    const lastSuccessIso = row.last_success ? new Date(row.last_success).toISOString() : null;
    const failuresLastHour = Number(row.failures_last_hour ?? 0);
    const activeTokens = Number(row.active_tokens ?? 0);

    const lastSuccessAgeHours = row.last_success
      ? (Date.now() - new Date(row.last_success).getTime()) / 3_600_000
      : Infinity;

    let status: ServiceHealth['status'] = 'healthy';
    let message: string | undefined;

    if (!fcmReady) {
      status = 'unhealthy';
      message = 'FCM admin SDK not initialized (check worker logs)';
    } else if (failuresLastHour > FAILURE_THRESHOLD_PER_HOUR) {
      status = 'degraded';
      message = `${failuresLastHour} PUSH failures in last hour (threshold ${FAILURE_THRESHOLD_PER_HOUR})`;
    } else if (activeTokens > 0 && lastSuccessAgeHours > SUCCESS_DROUGHT_HOURS) {
      // We have devices to push to, but no successful push in 24h.
      // Could be normal on low-traffic days; flag as degraded for visibility.
      status = 'degraded';
      message = `no successful push in ${SUCCESS_DROUGHT_HOURS}h despite ${activeTokens} active tokens`;
    }

    return {
      status,
      message,
      details: {
        fcm_initialized: fcmReady,
        apns_initialized: apnsReady,
        last_successful_push: lastSuccessIso,
        push_failures_last_hour: failuresLastHour,
        active_push_tokens: activeTokens,
      },
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      message: err instanceof Error ? err.message : 'fcm probe failed',
    };
  }
}
