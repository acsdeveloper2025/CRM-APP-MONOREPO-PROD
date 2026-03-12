import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MobileTelemetryService } from '@/services/mobileTelemetryService';

type TelemetryEvent = {
  id?: string;
  category?: string;
  name?: string;
  severity?: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
};

type TelemetryIngestRequest = {
  platform?: string;
  appVersion?: string;
  environment?: string;
  events?: TelemetryEvent[];
};

const MAX_EVENTS_PER_BATCH = 100;

export class MobileTelemetryController {
  static async ingest(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const body = (req.body || {}) as TelemetryIngestRequest;
      const events = Array.isArray(body.events) ? body.events : [];

      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one telemetry event is required',
          error: {
            code: 'INVALID_TELEMETRY_PAYLOAD',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (events.length > MAX_EVENTS_PER_BATCH) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_EVENTS_PER_BATCH} telemetry events allowed per request`,
          error: {
            code: 'TELEMETRY_BATCH_TOO_LARGE',
            timestamp: new Date().toISOString(),
            details: {
              max: MAX_EVENTS_PER_BATCH,
              received: events.length,
            },
          },
        });
      }

      const baseTags: Record<string, string | number | boolean | null | undefined> = {
        userId: req.user?.id || 'unknown',
        platform: body.platform || 'unknown',
        appVersion: body.appVersion || 'unknown',
        environment: body.environment || 'unknown',
      };

      await Promise.all(
        events.map(async event => {
          const category = (event.category || 'unknown').toLowerCase();
          const severity = (event.severity || 'info').toLowerCase();
          const eventName = (event.name || 'unnamed_event').toLowerCase();

          await MobileTelemetryService.increment('mobile_telemetry_events', 1, {
            ...baseTags,
            category,
            severity,
            eventName,
          });

          if (severity === 'error') {
            await MobileTelemetryService.increment('mobile_telemetry_errors', 1, {
              ...baseTags,
              category,
              eventName,
            });
          }
        })
      );

      return res.status(202).json({
        success: true,
        message: 'Telemetry events accepted',
        data: {
          accepted: events.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to ingest telemetry events',
        error: {
          code: 'TELEMETRY_INGEST_FAILED',
          timestamp: new Date().toISOString(),
          details: {
            reason: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }
}
