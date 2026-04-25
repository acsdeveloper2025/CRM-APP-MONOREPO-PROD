import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { query, withTransaction } from '@/config/database';
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
};

type IdempotencyLocals = {
  __idempotency?: IdempotencyRequestContext;
  __idempotencyCapturedBody?: unknown;
};

const IDEMPOTENCY_HEADER = 'idempotency-key';

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
    `SELECT request_hash, response_status, response_body
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
  body: unknown
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
}

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

        return res.status(409).json({
          success: false,
          message: 'Operation with this Idempotency-Key is in progress',
          error: {
            code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
            timestamp: new Date().toISOString(),
          },
        });
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
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return;
        }

        const capturedBody = (res.locals as IdempotencyLocals).__idempotencyCapturedBody;
        void persistResponse(state, res.statusCode, capturedBody ?? null);
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
