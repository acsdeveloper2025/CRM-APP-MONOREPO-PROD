import type { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { config } from '@/config';

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * How it works:
 * 1. Server sends a signed CSRF token in a cookie + response header
 * 2. Client includes the token in X-CSRF-Token header on state-changing requests
 * 3. Server validates the header token matches the cookie token
 *
 * Skipped for:
 * - Mobile API routes (use Bearer token auth, no cookies)
 * - Auth login/refresh routes (no session yet)
 * - Health check endpoints
 * - GET/HEAD/OPTIONS requests (safe methods)
 */

const CSRF_SECRET = config.jwtSecret || 'csrf-fallback-secret';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  getSessionIdentifier: (req: Request) => {
    // Use JWT user ID if available, otherwise use IP as fallback
    const user = (req as Request & { user?: { id?: string } }).user;
    return user?.id || req.ip || 'anonymous';
  },
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: '/',
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  errorConfig: {
    statusCode: 403,
    message: 'CSRF token validation failed',
    code: 'CSRF_INVALID',
  },
});

/**
 * Routes that should skip CSRF protection.
 * Mobile routes use Bearer tokens (no cookies), login has no session yet.
 */
const CSRF_SKIP_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh-token',
  '/api/mobile',
  '/api/health',
  '/health',
];

function shouldSkipCsrf(req: Request): boolean {
  const path = req.path;
  return CSRF_SKIP_PATHS.some(skip => path.startsWith(skip));
}

/**
 * CSRF protection middleware — wraps doubleCsrfProtection with skip logic.
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (shouldSkipCsrf(req)) {
    return next();
  }
  doubleCsrfProtection(req, res, next);
};

/**
 * Endpoint to get a CSRF token. Frontend calls this on app init.
 * GET /api/csrf-token → { token: "..." }
 */
export const csrfTokenHandler = (req: Request, res: Response): void => {
  const token = generateCsrfToken(req, res);
  res.json({ success: true, data: { token } });
};
