import type { Request, Response, NextFunction } from 'express';
import { config } from '@/config';
import { logger } from '@/config/logger';

/**
 * CSRF protection for the cookie-authenticated `/api/auth/refresh-token`
 * endpoint.
 *
 * Context: the rest of the API is Bearer-authenticated via the
 * `Authorization` header. A cross-site attacker cannot read or attach
 * that header from an arbitrary origin, so those routes are inherently
 * CSRF-safe. The refresh endpoint is different — the browser sends the
 * HttpOnly `crm_refresh_token` cookie automatically on any cross-site
 * request, so it needs its own CSRF defence on top of SameSite=Strict.
 *
 * What this middleware enforces when the refresh cookie is present
 * (i.e. a browser caller, not the mobile body-token path):
 *
 *   1. The request's `Origin` (preferred) or `Referer` must be present
 *      and match an entry in `config.corsOrigin`. Same-origin browser
 *      requests always carry `Origin` on non-GET methods; a missing
 *      origin header is a strong signal of a non-browser or
 *      cross-context call attempting to ride the cookie.
 *   2. An `X-Requested-With` header must be present. Browsers will not
 *      allow a cross-origin `<form>` submission or simple `<img>`/`<a>`
 *      request to add a custom header without triggering a CORS
 *      preflight, which our CORS config rejects for disallowed origins.
 *      Requiring this header therefore closes the "simple request"
 *      CSRF vector.
 *
 * If the request has no refresh cookie (the mobile/legacy body-token
 * path), the guard is a no-op — those callers are not browsers and
 * cannot be CSRF'd.
 */

const REFRESH_COOKIE_NAME = 'crm_refresh_token';

const CSRF_ERROR_CODE = 'CSRF_REFRESH_DENIED';

const extractOrigin = (req: Request): string | undefined => {
  const originHeader = req.get('origin');
  if (originHeader) {
    return originHeader;
  }
  const refererHeader = req.get('referer');
  if (!refererHeader) {
    return undefined;
  }
  try {
    const parsed = new URL(refererHeader);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
};

const isAllowedOrigin = (origin: string): boolean => {
  const allowList = Array.isArray(config.corsOrigin) ? config.corsOrigin : [];
  return allowList.includes(origin);
};

export const refreshCsrfGuard = (req: Request, res: Response, next: NextFunction): void => {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const hasRefreshCookie = Boolean(cookies?.[REFRESH_COOKIE_NAME]);

  // Mobile / legacy body-token path — not a browser, nothing to defend.
  if (!hasRefreshCookie) {
    next();
    return;
  }

  const origin = extractOrigin(req);
  if (!origin || !isAllowedOrigin(origin)) {
    logger.warn('Rejected refresh-token request with missing/invalid Origin', {
      origin: origin || null,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.status(403).json({
      success: false,
      message: 'Refresh request rejected: untrusted origin',
      error: { code: CSRF_ERROR_CODE },
    });
    return;
  }

  const requestedWith = req.get('x-requested-with');
  if (!requestedWith) {
    logger.warn('Rejected refresh-token request missing X-Requested-With header', {
      origin,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'Refresh request rejected: missing CSRF header',
      error: { code: CSRF_ERROR_CODE },
    });
    return;
  }

  next();
};
