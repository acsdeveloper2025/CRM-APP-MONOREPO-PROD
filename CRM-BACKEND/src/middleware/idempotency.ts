import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { query, withTransaction } from '@/config/database';
import { redisClient, isRedisHealthy } from '@/config/redis';
import { logger } from '@/config/logger';
import type { PoolClient } from 'pg';
import { MobileTelemetryService } from '@/services/mobileTelemetryService';

type IdempotencyOptions = {
  required?: boolean;
  scope?: string;
  ttlHours?: number;
};

type IdempotencyRequestContext = {
  key: string;
  userId: string | null;
  scope: string;
  requestHash: string;
};

type ReplayRow = {
  responseStatus: number | null;
  responseBody: unknown;
  requestHash: string;
  createdAt: Date;
};

type IdempotencyLocals = {
  __idempotency?: IdempotencyRequestContext;
  __idempotencyCapturedBody?: unknown;
};

const IDEMPOTENCY_HEADER = 'idempotency-key';

// F-B4.7: thin Redis read-cache for COMPLETED-response replays.
// Reservation rows (response_status=NULL), conflict detection on
// pending state, orphan recovery, and durability all stay on DB —
// the cache only short-circuits the hot replay path (a retried
// request whose original response is already persisted). Saves the
// SELECT + INSERT-ON-CONFLICT round-trip on the most common path
// without compromising the documented case-1 incident protections.
type CachedReplay = {
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
};

const buildCacheKey = (scope: string, userId: string | null, key: string): string =>
  `idem:${scope}:${userId ?? 'anon'}:${key}`;

const cacheGetCompletedReplay = async (
  scope: string,
  userId: string | null,
  key: string
): Promise<CachedReplay | null> => {
  if (!isRedisHealthy()) {
    return null;
  }
  try {
    const raw = await redisClient.get(buildCacheKey(scope, userId, key));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedReplay;
    if (typeof parsed.responseStatus !== 'number' || typeof parsed.requestHash !== 'string') {
      return null;
    }
    return parsed;
  } catch (error) {
    logger.warn('Idempotency Redis GET failed; falling back to DB lookup', { error });
    return null;
  }
};

const cacheSetCompletedReplay = async (
  scope: string,
  userId: string | null,
  key: string,
  payload: CachedReplay,
  ttlHours: number
): Promise<void> => {
  if (!isRedisHealthy()) {
    return;
  }
  try {
    await redisClient.set(buildCacheKey(scope, userId, key), JSON.stringify(payload), {
      EX: ttlHours * 3600,
    });
  } catch (error) {
    logger.warn('Idempotency Redis SET failed; cache miss is non-fatal', { error });
  }
};

const cacheDelete = async (scope: string, userId: string | null, key: string): Promise<void> => {
  if (!isRedisHealthy()) {
    return;
  }
  try {
    await redisClient.del(buildCacheKey(scope, userId, key));
  } catch (error) {
    logger.warn('Idempotency Redis DEL failed; stale cache will TTL out', { error });
  }
};

function normalizeBody(body: unknown): string {
  if (body == null) {
    return '';
  }

  if (typeof body === 'string') {
    return body;
  }

  try {
    return JSON.stringify(body);
  } catch {
    return '[unserializable-body]';
  }
}

function buildRequestHash(req: Request, scope: string): string {
  const base = JSON.stringify({
    scope,
    method: req.method,
    path: req.originalUrl,
    body: req.body ?? null,
    query: req.query ?? null,
  });
  return crypto.createHash('sha256').update(base).digest('hex');
}

function getUserId(req: Request): string | null {
  const user = (req as Request & { user?: { id?: string } }).user;
  return user?.id || null;
}

async function getReplayRow(
  client: PoolClient,
  key: string,
  userId: string | null,
  scope: string
): Promise<ReplayRow | null> {
  const replayRes = await client.query<ReplayRow>(
    `SELECT request_hash, response_status, response_body, created_at
     FROM mobile_idempotency_keys
     WHERE idempotency_key = $1
       AND user_id IS NOT DISTINCT FROM $2::uuid
       AND scope = $3
       AND expires_at > NOW()
     LIMIT 1`,
    [key, userId, scope]
  );
  return replayRes.rows[0] || null;
}

/**
 * Attempt to reserve an idempotency key atomically.
 *
 * Returns `true` if this caller won the race and now owns the key (the
 * request should proceed). Returns `false` if another caller already reserved
 * the key — the caller should re-read the existing row and replay it.
 *
 * The `INSERT ... ON CONFLICT DO NOTHING RETURNING idempotency_key` form
 * collapses the check-and-insert into a single atomic statement, eliminating
 * the race where two concurrent transactions both see "no existing row" and
 * both proceed to execute the handler.
 */
async function reserveKey(
  client: PoolClient,
  key: string,
  userId: string | null,
  scope: string,
  requestHash: string,
  ttlHours: number
): Promise<boolean> {
  const insertRes = await client.query<{ idempotencyKey: string }>(
    `INSERT INTO mobile_idempotency_keys (
       idempotency_key,
       user_id,
       scope,
       request_hash,
       response_status,
       response_body,
       expires_at
     )
     VALUES ($1, $2::uuid, $3, $4, NULL, NULL, NOW() + ($5 || ' hours')::interval)
     ON CONFLICT (idempotency_key, user_id, scope)
     DO NOTHING
     RETURNING idempotency_key`,
    [key, userId, scope, requestHash, String(ttlHours)]
  );
  return insertRes.rowCount !== null && insertRes.rowCount > 0;
}

async function persistResponse(
  ctx: IdempotencyRequestContext,
  statusCode: number,
  body: unknown,
  ttlHours: number
): Promise<void> {
  try {
    await query(
      `UPDATE mobile_idempotency_keys
       SET response_status = $4,
           response_body = $5::jsonb,
           updated_at = NOW()
       WHERE idempotency_key = $1
         AND user_id IS NOT DISTINCT FROM $2::uuid
         AND scope = $3`,
      [
        ctx.key,
        ctx.userId,
        ctx.scope,
        statusCode,
        normalizeBody(body) ? JSON.stringify(body) : JSON.stringify(null),
      ]
    );
  } catch {
    // Never block the primary API response on idempotency persistence failure.
  }
  // F-B4.7: dual-write to Redis cache so the next replay short-circuits
  // the DB lookup. Best-effort — DB row is the source of truth.
  await cacheSetCompletedReplay(
    ctx.scope,
    ctx.userId,
    ctx.key,
    {
      requestHash: ctx.requestHash,
      responseStatus: statusCode,
      responseBody: body,
    },
    ttlHours
  );
}

/**
 * Drop a reservation row when the request failed (4xx/5xx).
 *
 * Without this, a 5xx left the reservation in `response_status=NULL`
 * limbo, and the next retry's `reserveKey` lost the `ON CONFLICT DO
 * NOTHING` race, fetched the orphan row, and returned 409
 * `IDEMPOTENCY_KEY_IN_PROGRESS` forever (the row stays for 72h). Mobile's
 * FormUploader silently swallowed that 409 as success and the user's
 * data was lost (case 1 / 2026-04-25 incident). Deleting the reservation
 * lets the next retry execute against the controller fresh, exactly as
 * if the failed attempt had never happened. The client gains a real
 * second chance instead of being permanently locked out.
 */
async function deleteReservation(ctx: IdempotencyRequestContext): Promise<void> {
  try {
    await query(
      `DELETE FROM mobile_idempotency_keys
       WHERE idempotency_key = $1
         AND user_id IS NOT DISTINCT FROM $2::uuid
         AND scope = $3`,
      [ctx.key, ctx.userId, ctx.scope]
    );
  } catch {
    // Defensive — never block the primary API response on cleanup failure.
  }
  // F-B4.7: also drop the Redis cache so a replay can't serve a
  // response that's been deleted from durable storage.
  await cacheDelete(ctx.scope, ctx.userId, ctx.key);
}

// Reservation rows in `response_status=NULL` state older than this are
// treated as orphaned (server crashed / process restarted mid-request).
// Younger rows might still be a legitimate concurrent retry; we let
// IDEMPOTENCY_KEY_IN_PROGRESS surface so the client backs off briefly.
const STALE_RESERVATION_MS = 5 * 60 * 1000;

export function idempotencyMiddleware(options: IdempotencyOptions = {}) {
  const { required = false, scope = 'global', ttlHours = 72 } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const keyHeader = req.header(IDEMPOTENCY_HEADER)?.trim();
    const key = keyHeader || '';

    if (!key) {
      if (required) {
        return res.status(400).json({
          success: false,
          message: 'Idempotency-Key header is required',
          error: {
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }
      return next();
    }

    const userId = getUserId(req);
    const requestHash = buildRequestHash(req, scope);

    // F-B4.7: hot replay path — completed responses are cached in
    // Redis. If we hit, we skip the DB transaction entirely.
    // Reservation rows / orphan recovery / conflict on pending state
    // still flow through DB below.
    try {
      const cached = await cacheGetCompletedReplay(scope, userId, key);
      if (cached) {
        if (cached.requestHash !== requestHash) {
          return res.status(409).json({
            success: false,
            message: 'Idempotency-Key already used with different payload',
            error: {
              code: 'IDEMPOTENCY_KEY_CONFLICT',
              timestamp: new Date().toISOString(),
            },
          });
        }
        res.setHeader('X-Idempotent-Replay', 'true');
        res.setHeader('X-Idempotent-Replay-Source', 'cache');
        void MobileTelemetryService.increment('idempotentReplayCount', 1, { scope });
        return res.status(cached.responseStatus).json(cached.responseBody);
      }
    } catch (error) {
      logger.warn('Idempotency cache lookup failed; falling back to DB path', { error });
    }

    try {
      const replay = await withTransaction(async client => {
        // First try to atomically reserve the key. If we win the race, we own
        // the request and no replay row exists. If we lose, another caller
        // already inserted — re-read the existing row to serve as the replay.
        const reserved = await reserveKey(client, key, userId, scope, requestHash, ttlHours);
        if (reserved) {
          return null;
        }
        return getReplayRow(client, key, userId, scope);
      });

      if (replay) {
        if (replay.requestHash !== requestHash) {
          return res.status(409).json({
            success: false,
            message: 'Idempotency-Key already used with different payload',
            error: {
              code: 'IDEMPOTENCY_KEY_CONFLICT',
              timestamp: new Date().toISOString(),
            },
          });
        }

        if (replay.responseStatus && replay.responseBody !== null) {
          res.setHeader('X-Idempotent-Replay', 'true');
          void MobileTelemetryService.increment('idempotentReplayCount', 1, { scope });
          return res.status(replay.responseStatus).json(replay.responseBody);
        }

        // Reservation row exists with response_status=NULL — either the
        // original request is still in-flight, or a 5xx left it orphaned
        // (pre-2026-04-26 fix). New code DELETEs reservations on 5xx
        // finish, so fresh orphans shouldn't accumulate. To recover from
        // historical orphans + crash-induced ones, treat reservations
        // older than STALE_RESERVATION_MS as stale: drop them and let
        // this request execute fresh against the controller. Younger
        // reservations are returned as IDEMPOTENCY_KEY_IN_PROGRESS so a
        // legitimate concurrent retry backs off briefly.
        const reservationAgeMs = Date.now() - new Date(replay.createdAt).getTime();
        if (reservationAgeMs >= STALE_RESERVATION_MS) {
          await deleteReservation({ key, userId, scope, requestHash });
          // Re-reserve with our own request hash so the new attempt owns
          // the key going forward. If this re-reserve loses (very tight
          // race with another stale-recovery), fall through to the
          // in-progress 409.
          const reReserved = await withTransaction(async client =>
            reserveKey(client, key, userId, scope, requestHash, ttlHours)
          );
          if (reReserved) {
            // Continue to the handler below as if no reservation existed.
          } else {
            return res.status(409).json({
              success: false,
              message: 'Operation with this Idempotency-Key is in progress',
              error: {
                code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
                timestamp: new Date().toISOString(),
              },
            });
          }
        } else {
          return res.status(409).json({
            success: false,
            message: 'Operation with this Idempotency-Key is in progress',
            error: {
              code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      const locals = res.locals as IdempotencyLocals;
      locals.__idempotency = {
        key,
        userId,
        scope,
        requestHash,
      };

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = ((body: unknown) => {
        (res.locals as IdempotencyLocals).__idempotencyCapturedBody = body;
        return originalJson(body);
      }) as Response['json'];

      res.send = ((body: unknown) => {
        const localsRef = res.locals as IdempotencyLocals;
        if (localsRef.__idempotencyCapturedBody === undefined) {
          localsRef.__idempotencyCapturedBody = body;
        }
        return originalSend(body);
      }) as Response['send'];

      res.on('finish', () => {
        const state = (res.locals as IdempotencyLocals).__idempotency;
        if (!state) {
          return;
        }

        // Only persist successful responses. Caching 4xx/5xx as if they
        // were "completed" outcomes turns transient failures (auth race,
        // validation gap, server hiccup) into 72-hour lockouts because
        // every retry replays the same Idempotency-Key. Failed requests
        // by definition committed no side effect, so re-executing them
        // on retry is safe and is what the client actually wants.
        //
        // Crucially: don't just *skip* persistence on non-2xx — also
        // DELETE the reservation row we already inserted. Otherwise the
        // row sits with response_status=NULL and the next retry hits
        // the IDEMPOTENCY_KEY_IN_PROGRESS branch above, which mobile's
        // FormUploader (pre-2026-04-26 fix) silently swallowed as
        // success. This is exactly how case 1 lost a residence
        // verification on 2026-04-25 — see project_form_field_mapping_drift_audit.md.
        if (res.statusCode < 200 || res.statusCode >= 300) {
          void deleteReservation(state);
          return;
        }

        const capturedBody = (res.locals as IdempotencyLocals).__idempotencyCapturedBody;
        void persistResponse(state, res.statusCode, capturedBody ?? null, ttlHours);
      });

      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize idempotency handling',
        error: {
          code: 'IDEMPOTENCY_INIT_FAILED',
          timestamp: new Date().toISOString(),
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  };
}
