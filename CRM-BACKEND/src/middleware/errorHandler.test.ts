import { describe, it, expect, vi } from 'vitest';

// vi.hoisted runs before vi.mock hoisting — safe to reference in factory
const mockConfig = vi.hoisted(() => ({
  nodeEnv: 'test',
  port: 3000,
  jwtSecret: 'test-secret',
  jwtExpiresIn: '24h',
  corsOrigin: ['http://localhost:3000'],
  logLevel: 'error',
}));

vi.mock('@/config', () => ({
  config: mockConfig,
}));

// Mock logger to prevent actual log output during tests
vi.mock('@/config/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { errorHandler, notFoundHandler, createError } from './errorHandler';
import type { Request, Response, NextFunction } from 'express';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    url: '/test',
    method: 'GET',
    originalUrl: '/api/test',
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('test-agent'),
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  } as unknown as Response & { _status: number; _json: unknown };
  return res;
}

describe('errorHandler', () => {
  const next: NextFunction = vi.fn();

  it('returns 500 with generic message for unknown errors', () => {
    const error = new Error('something broke');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(error, req, res, next);

    expect(res._status).toBe(500);
    expect((res._json as { success: boolean }).success).toBe(false);
    expect((res._json as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 401 for JsonWebTokenError', () => {
    const error = new Error('jwt malformed');
    error.name = 'JsonWebTokenError';
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(error, req, res, next);

    expect(res._status).toBe(401);
    expect((res._json as { error: { code: string } }).error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 for TokenExpiredError', () => {
    const error = new Error('jwt expired');
    error.name = 'TokenExpiredError';
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(error, req, res, next);

    expect(res._status).toBe(401);
    expect((res._json as { error: { code: string } }).error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 400 for MulterError with LIMIT_FILE_SIZE', () => {
    const error = new Error('File too large') as Error & { code?: string };
    error.name = 'MulterError';
    error.code = 'LIMIT_FILE_SIZE';
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(error, req, res, next);

    expect(res._status).toBe(400);
    expect((res._json as { message: string }).message).toBe('File too large');
  });

  it('hides internal error details in production', () => {
    const originalNodeEnv = mockConfig.nodeEnv;
    mockConfig.nodeEnv = 'production';

    const error = new Error('database connection string leaked');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(error, req, res, next);

    expect(res._status).toBe(500);
    expect((res._json as { message: string }).message).toBe('Internal server error');
    expect((res._json as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');

    mockConfig.nodeEnv = originalNodeEnv;
  });

  it('preserves custom status codes and error codes', () => {
    const error = createError('Not found', 404, 'RESOURCE_NOT_FOUND', { id: '123' });
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(error, req, res, next);

    expect(res._status).toBe(404);
    expect((res._json as { error: { code: string } }).error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with route info', () => {
    const req = createMockReq({ originalUrl: '/api/nonexistent' });
    const res = createMockRes();

    notFoundHandler(req, res);

    expect(res._status).toBe(404);
    expect((res._json as { message: string }).message).toContain('/api/nonexistent');
    expect((res._json as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});

describe('createError', () => {
  it('creates an error with custom properties', () => {
    const error = createError('Bad request', 400, 'VALIDATION_ERROR', { field: 'email' });

    expect(error.message).toBe('Bad request');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('defaults to 500 and ERROR code', () => {
    const error = createError('Unknown error');

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('ERROR');
  });
});
