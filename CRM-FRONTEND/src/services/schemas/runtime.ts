// Runtime response validation helper.
//
// Phase B6: the frontend historically trusted every API response and used
// `as unknown as Foo` casts at the service boundary. When the backend
// contract drifts (a field is renamed, a status code flips, a list becomes
// paginated) those casts silently produce `undefined` reads that crash in
// far-away components.
//
// This module provides a thin wrapper over `zod` that validates responses
// without throwing. Validation failures are logged with a structured
// error payload so the team can detect drift in production, while the
// raw parsed data still flows through to the caller unchanged. This keeps
// the rollout safe (no runtime throws from stale schemas) while paying
// back dividends every time a new field or shape issue shows up in logs.
//
// To enforce strict validation (throw on failure) in a specific service
// call, pass `{ strict: true }`. That mode is appropriate for write
// endpoints where accepting a malformed response is more dangerous than
// surfacing the error immediately.

import type { ZodType, ZodError } from 'zod';
import { logger } from '@/utils/logger';

export interface ValidateOptions {
  /** Service name for log grouping — e.g. 'cases', 'attachments'. */
  service: string;
  /** Endpoint path or method name — e.g. 'getCases', '/cases/:id'. */
  endpoint: string;
  /** When true, throw on validation failure instead of warn-and-pass. */
  strict?: boolean;
}

export interface RuntimeValidationError {
  service: string;
  endpoint: string;
  issues: ZodError['issues'];
  // Capture a truncated sample of the raw data — helps diagnose drift
  // without flooding logs with full response bodies.
  sample?: string;
}

function summariseSample(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    return json.length > 400 ? `${json.slice(0, 400)}…(truncated)` : json;
  } catch {
    return '[unserializable]';
  }
}

/**
 * Validate `data` against `schema`.
 *
 * - On success: returns the parsed data (same as `schema.parse(data)`).
 * - On failure in non-strict mode: logs a structured warning and returns
 *   the original `data` cast to `T`. Callers see the behavior they
 *   already expected from the `as unknown as T` pattern, but get a loud
 *   warning in the browser console + any wired log sink.
 * - On failure in strict mode: throws the ZodError so callers can decide
 *   how to surface the contract mismatch.
 */
export function validateResponse<T>(
  schema: ZodType<T>,
  data: unknown,
  options: ValidateOptions
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const payload: RuntimeValidationError = {
    service: options.service,
    endpoint: options.endpoint,
    issues: result.error.issues,
    sample: summariseSample(data),
  };

  if (options.strict) {
    logger.error('API response validation failed (strict):', payload);
    throw result.error;
  }

  logger.warn('API response shape drift detected:', payload);
  // Non-strict rollout: return the raw data so callers keep working until
  // the drift is addressed. The warning above tells the team what changed.
  return data as T;
}
