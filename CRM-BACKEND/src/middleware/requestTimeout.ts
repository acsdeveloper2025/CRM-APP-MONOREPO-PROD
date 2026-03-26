import type { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger';

/**
 * Request timeout middleware
 * Aborts requests that exceed the specified timeout and returns 504 Gateway Timeout.
 * Prevents long-running requests from exhausting server resources.
 */
export const requestTimeout = (timeoutMs = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

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
