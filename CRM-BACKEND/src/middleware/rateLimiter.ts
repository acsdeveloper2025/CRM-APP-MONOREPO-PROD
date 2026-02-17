import type { ApiResponse } from '@/types/api';
import type { AuthenticatedRequest } from '@/types/auth';
import rateLimit from 'express-rate-limit';

const createRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
  keyType: 'IP' | 'USER' | 'AUTO' = 'AUTO'
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
      },
    } as ApiResponse,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => {
      if (keyType === 'USER' && req.user?.id) {
        return req.user.id;
      }
      if (keyType === 'AUTO') {
        return req.user?.id || req.ip || 'unknown';
      }
      return req.ip || 'unknown';
    },
    // We removed the blanket 'skip' for authenticated users to ensure all activity is capped
    skip: (req: AuthenticatedRequest) => {
      // Still skip for dev-token to avoid blocking local development tests
      const authHeader = req.headers.authorization;
      return authHeader === 'Bearer dev-token';
    },
  });
};

/**
 * Tier 1: Auth Endpoints - Very Strict
 * Prevents brute force on login/refresh
 */
export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 attempts
  'Too many authentication attempts, please try again later',
  'IP' // Always IP-based for auth since user ID isn't known yet
);

/**
 * Tier 2: General API Usage
 * Provides a generous ceiling for normal user activity
 */
export const generalRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  200, // 200 requests per minute
  'Too many requests, please slow down',
  'AUTO' // Uses userId if authenticated, IP otherwise
);

/**
 * Tier 3: Sensitive/Heavy Operations
 * Stricter limits for resource-intensive tasks
 */

// File Uploads
export const uploadRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 uploads per minute
  'Too many file uploads, please wait before uploading more',
  'USER'
);

// Reports & Exports (Heavy DB/CPU)
export const exportRateLimit = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  5, // 5 exports per 5 minutes
  'Too many report/export requests, please wait for previous ones to complete',
  'USER'
);

// High-volume List operations
export const listRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  60, // 1 request per second on average for lists
  'Too many list operations, please refine your filters',
  'USER'
);

// Geolocation tracking (Mobile)
export const geoRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  120, // 2 updates per second allowed
  'Too many location updates',
  'USER'
);
