import { logger } from '@/config/logger';
import { redisClient } from '@/config/redis';

type MetricTags = Record<string, string | number | boolean | null | undefined>;

const METRIC_TTL_SECONDS = 14 * 24 * 60 * 60;

function normalizeTagValue(value: MetricTags[string]): string {
  if (value === null || value === undefined) {
    return 'unknown';
  }
  return String(value).replace(/[^a-zA-Z0-9_.:-]/g, '_');
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function metricKey(metricName: string): string {
  return `mobile:telemetry:${metricName}:${dayKey()}`;
}

function tagKey(tags?: MetricTags): string {
  if (!tags || Object.keys(tags).length === 0) {
    return 'all';
  }

  const parts = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${normalizeTagValue(v)}`);

  return parts.join('|');
}

export class MobileTelemetryService {
  static async increment(metricName: string, value = 1, tags?: MetricTags): Promise<void> {
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    const key = metricKey(metricName);
    const metricField = tagKey(tags);

    if (redisClient.isOpen) {
      try {
        const pipeline = redisClient.multi();
        pipeline.hIncrBy(key, metricField, Math.trunc(value));
        pipeline.expire(key, METRIC_TTL_SECONDS);
        await pipeline.exec();
        return;
      } catch (error) {
        logger.warn('Failed to persist mobile telemetry metric to redis', {
          metricName,
          metricField,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('mobile_telemetry_metric', {
      metricName,
      value,
      tags: tags || {},
      timestamp: new Date().toISOString(),
    });
  }

  static async observeDuration(
    metricName: string,
    durationMs: number,
    tags?: MetricTags
  ): Promise<void> {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    const roundedDuration = Math.round(durationMs);
    await Promise.all([
      this.increment(`${metricName}_count`, 1, tags),
      this.increment(`${metricName}_total_ms`, roundedDuration, tags),
    ]);
  }
}
