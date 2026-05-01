import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestTimeout } from './requestTimeout';
import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

// Mock logger
vi.mock('@/config/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockReq(): Request {
  // 2026-05-01: F-B4.1 abort-signal hardening landed in
  // requestTimeout.ts; the timeout handler now calls `req.destroy()` to
  // release the socket. Mock must provide `destroyed` + `destroy` so
  // the handler doesn't throw "destroy is not a function" mid-test.
  return {
    method: 'GET',
    originalUrl: '/api/test',
    ip: '127.0.0.1',
    destroyed: false,
    destroy: vi.fn(),
  } as unknown as Request;
}

function createMockRes(): Response &
  EventEmitter & { _status: number; _json: unknown; headersSent: boolean } {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    _status: 200,
    _json: null,
    headersSent: false,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      res.headersSent = true;
      return res;
    },
  }) as unknown as Response &
    EventEmitter & { _status: number; _json: unknown; headersSent: boolean };
  return res;
}

describe('requestTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('calls next() immediately', () => {
    const middleware = requestTimeout(1000);
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 504 after timeout expires', () => {
    const middleware = requestTimeout(500);
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    vi.advanceTimersByTime(600);

    expect(res._status).toBe(504);
    expect((res._json as { error: { code: string } }).error.code).toBe('REQUEST_TIMEOUT');
  });

  it('does not send 504 if response already sent', () => {
    const middleware = requestTimeout(500);
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    // Simulate response already sent
    res.headersSent = true;

    vi.advanceTimersByTime(600);

    // Should not have set 504
    expect(res._status).toBe(200);
  });

  it('clears timeout when response finishes', () => {
    const middleware = requestTimeout(500);
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    // Response finishes before timeout
    res.emit('finish');

    vi.advanceTimersByTime(600);

    // Should not have triggered timeout
    expect(res._status).toBe(200);
  });

  it('clears timeout when connection closes', () => {
    const middleware = requestTimeout(500);
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    // Connection drops
    res.emit('close');

    vi.advanceTimersByTime(600);

    expect(res._status).toBe(200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
