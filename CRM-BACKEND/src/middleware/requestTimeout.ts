import type { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger';

// F-B4.1: per-request AbortSignal so handlers (or shared utilities
// like pg query wrappers) can opt-in to cancellation when the
// request times out. Augmenting Express's Request type makes
// `req.abortSignal` strongly typed at every consumer.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      abortSignal?: AbortSignal;
    }
  }
}

/**
 * Request timeout middleware
 *
 * F-B4.1: in addition to sending 504, this middleware now:
 *   1. Attaches an `AbortSignal` to `req.abortSignal` so handlers
 *      can short-circuit (`if (req.abortSignal?.aborted) return;`).
 *   2. Calls `req.destroy()` on timeout, which severs the underlying
 *      socket so the next request can reuse it. The handler's
 *      pending awaits still run to completion (Node has no way to
 *      kill an in-flight async fn), but at least the socket isn't
 *      held open while the cosmetic 504 is being prepared.
 *
 * True per-handler cancellation requires threading `req.abortSignal`
 * through every `query()` / `fetch()` / etc. call — that migration
 * is intentionally NOT done here (touches ~100 controllers); see
 * project_backend_audit_2026_04_28.md for the Tier 3 work item.
 */
export const requestTimeout = (timeoutMs = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const controller = new AbortController();
    req.abortSignal = controller.signal;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout exceeded', {
          method: req.method,
          url: req.originalUrl,
          timeoutMs,
          ip: req.ip,
        });

        res.status(504).json({
          success: false,
          message: 'Request timeout — the server took too long to respond',
          error: {
            code: 'REQUEST_TIMEOUT',
            timestamp: new Date().toISOString(),
          },
        });
      }
      // Fire abort first so any handler watching the signal can bail
      // before we tear down the socket.
      if (!controller.signal.aborted) {
        controller.abort();
      }
      // Sever the socket so it's released back to the pool. Pending
      // handler awaits still run, but their res.json() will no-op on
      // a destroyed socket.
      if (!req.destroyed) {
        req.destroy();
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };

    // Clear timeout when response finishes (also aborts the signal
    // so any post-response work watching the signal cleans up too).
    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };
};

/**
 * Extended timeout for specific heavy operations (exports, reports, file uploads)
 */
export const extendedTimeout = requestTimeout(120000); // 2 minutes

/**
 * Default timeout for standard API requests
 */
export const defaultTimeout = requestTimeout(30000); // 30 seconds
