import type { Request, Response, NextFunction } from 'express';

import { config } from '@/config';
import { logger } from '@/config/logger';
import type { ApiResponse } from '@/types/api';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let code = error.code || 'INTERNAL_ERROR';
  let details = error.details;

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Handle multer errors (file upload)
  if (error.name === 'MulterError') {
    statusCode = 400;
    code = error.code || 'FILE_UPLOAD_ERROR';

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        details = { limitType: 'LIMIT_FILE_SIZE' };
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        details = { limitType: 'LIMIT_FILE_COUNT' };
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        details = { limitType: 'LIMIT_UNEXPECTED_FILE' };
        break;
      default:
        message = 'File upload error';
        details = { limitType: error.code || 'UNKNOWN' };
    }
  }

  const response: ApiResponse = {
    success: false,
    message,
    error: {
      code,
      timestamp: new Date().toISOString(),
      details,
    },
  };

  // Don't expose internal errors in production
  if (config.nodeEnv === 'production' && statusCode === 500) {
    response.message = 'Internal server error';
    response.error = {
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: {
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    },
  };

  res.status(404).json(response);
};

export const createError = (
  message: string,
  statusCode = 500,
  code = 'ERROR',
  details?: unknown
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};
