import type { ApiResponse } from '@/types/api';
import type { AuthenticatedRequest } from '@/types/auth';
import type { Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '@/config/redis';
import { logger } from '@/config/logger';

/**
 * Creates a Redis-backed store for distributed rate limiting.
 * Falls back to in-memory store if Redis is unavailable (fail-open).
 */
const getStore = (prefix: string) => {
  try {
    if (redisClient.isReady) {
      return new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: `rl:${prefix}:`,
      });
    }
  } catch (err) {
    logger.warn('Redis rate limiter store unavailable, falling back to in-memory', {
      prefix,
      error: (err as Error).message,
    });
  }
  // Fall back to default in-memory store — still works, just not distributed
  return undefined;
};

const createRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
  keyType: 'IP' | 'USER' | 'AUTO' = 'AUTO',
  storePrefix = 'default'
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
    store: getStore(storePrefix),
    keyGenerator: (req: AuthenticatedRequest, _res: Response) => {
      if (keyType === 'USER' && req.user?.id) {
        return req.user.id;
      }
      if (keyType === 'AUTO' && req.user?.id) {
        return req.user.id;
      }
      // Use standard behavior for IP-based limiting (handles IPv6 correctly)
      return ipKeyGenerator(req.ip || 'unknown');
    },
    // Phase E3: DEV_RATE_LIMIT_BYPASS_TOKEN has been removed. There is no
    // way to bypass these limiters at runtime — any such knob is a
    // production footgun waiting to happen.
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
  'IP', // Always IP-based for auth since user ID isn't known yet
  'auth'
);

/**
 * Tier 2: General API Usage
 * Provides a generous ceiling for normal user activity
 */
export const generalRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  200, // 200 requests per minute
  'Too many requests, please slow down',
  'AUTO', // Uses userId if authenticated, IP otherwise
  'general'
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
  'USER',
  'upload'
);

// Reports & Exports (Heavy DB/CPU)
export const exportRateLimit = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  5, // 5 exports per 5 minutes
  'Too many report/export requests, please wait for previous ones to complete',
  'USER',
  'export'
);

// High-volume List operations
export const listRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  60, // 1 request per second on average for lists
  'Too many list operations, please refine your filters',
  'USER',
  'list'
);

// Geolocation tracking (Mobile)
export const geoRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  120, // 2 updates per second allowed
  'Too many location updates',
  'USER',
  'geo'
);

// Mobile umbrella tier — applied once at the top of the mobile router so
// every mobile endpoint inherits the same generous quota. Distributed via
// the same Redis store used by the other tiers; replaces the former
// `mobileRateLimit` factory in mobileValidation.ts which had a non-
// distributed in-memory fallback that allowed limit amplification across
// cluster workers.
export const mobileGeneralRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10000, // 10,000 requests per 15 minutes — high-volume field agent quota
  'Too many requests, please slow down',
  'AUTO',
  'mobile'
);
