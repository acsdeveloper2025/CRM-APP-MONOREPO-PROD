import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  corsOrigin: ['https://app.example.com', 'http://localhost:5173'],
}));

vi.mock('@/config', () => ({ config: mockConfig }));
vi.mock('@/config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { refreshCsrfGuard } from './refreshCsrfGuard';
import type { Request, Response, NextFunction } from 'express';

interface MockReq {
  cookies?: Record<string, string>;
  headers: Record<string, string>;
  ip?: string;
  get(name: string): string | undefined;
}

function makeReq(opts: {
  cookie?: string;
  origin?: string;
  referer?: string;
  requestedWith?: string;
  userAgent?: string;
}): MockReq {
  const headers: Record<string, string> = {};
  if (opts.origin) {
    headers.origin = opts.origin;
  }
  if (opts.referer) {
    headers.referer = opts.referer;
  }
  if (opts.requestedWith) {
    headers['x-requested-with'] = opts.requestedWith;
  }
  if (opts.userAgent) {
    headers['user-agent'] = opts.userAgent;
  }
  return {
    cookies: opts.cookie ? { crm_refresh_token: opts.cookie } : undefined,
    headers,
    ip: '127.0.0.1',
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

function makeRes(): {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} & Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  } & Response;
}

describe('refreshCsrfGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through when no refresh cookie is present (mobile/body-token path)', () => {
    const req = makeReq({});
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    refreshCsrfGuard(req as unknown as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects when cookie is present but Origin is missing', () => {
    const req = makeReq({ cookie: 't', requestedWith: 'fetch' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    refreshCsrfGuard(req as unknown as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: { code: 'CSRF_REFRESH_DENIED' },
      })
    );
  });

  it('rejects when Origin is not in the allowlist', () => {
    const req = makeReq({
      cookie: 't',
      origin: 'https://attacker.example.com',
      requestedWith: 'fetch',
    });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    refreshCsrfGuard(req as unknown as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('falls back to Referer when Origin is missing and the host is allowed', () => {
    const req = makeReq({
      cookie: 't',
      referer: 'https://app.example.com/some/page',
      requestedWith: 'fetch',
    });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    refreshCsrfGuard(req as unknown as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects when X-Requested-With is missing even with a valid Origin', () => {
    const req = makeReq({ cookie: 't', origin: 'https://app.example.com' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    refreshCsrfGuard(req as unknown as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('passes through when cookie + allowed Origin + X-Requested-With are all present', () => {
    const req = makeReq({
      cookie: 't',
      origin: 'http://localhost:5173',
      requestedWith: 'fetch',
    });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    refreshCsrfGuard(req as unknown as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
