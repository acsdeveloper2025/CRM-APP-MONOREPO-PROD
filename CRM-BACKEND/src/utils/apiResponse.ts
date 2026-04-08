import type { Response } from 'express';
import type { ApiResponse } from '@/types/api';

/**
 * Send a standardized success response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  pagination?: ApiResponse['pagination']
): void {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  if (pagination) {
    response.pagination = pagination;
  }
  res.status(statusCode).json(response);
}

/**
 * Send a standardized error response.
 * Matches the format used by errorHandler middleware.
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code: string,
  details?: unknown
): void {
  const response: ApiResponse = {
    success: false,
    message,
    error: {
      code,
      timestamp: new Date().toISOString(),
      ...(details !== undefined && { details }),
    },
  };
  res.status(statusCode).json(response);
}

/** Common error shortcuts */
export const errors = {
  notFound: (res: Response, entity: string) =>
    sendError(res, 404, `${entity} not found`, 'NOT_FOUND'),

  badRequest: (res: Response, message: string, details?: unknown) =>
    sendError(res, 400, message, 'INVALID_INPUT', details),

  internal: (res: Response, message = 'Internal server error') =>
    sendError(res, 500, message, 'INTERNAL_ERROR'),

  forbidden: (res: Response, message = 'Forbidden') => sendError(res, 403, message, 'FORBIDDEN'),

  conflict: (res: Response, message: string) => sendError(res, 409, message, 'CONFLICT'),
};
