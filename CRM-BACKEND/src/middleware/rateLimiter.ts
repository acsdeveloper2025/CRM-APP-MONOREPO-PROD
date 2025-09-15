import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { ApiResponse } from '@/types/api';
import { AuthenticatedRequest } from './auth';

const createRateLimiter = (windowMs: number, max: number, message: string, skipForAllUsers = false) => {
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
    skip: skipForAllUsers ? (req: AuthenticatedRequest) => {
      try {
        // Check if user is authenticated
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return false; // Apply rate limiting for unauthenticated requests
        }

        const token = authHeader.substring(7);

        // Handle dev token for SUPER_ADMIN
        if (token === 'dev-token') {
          return true; // Skip rate limiting for dev token
        }

        const decoded = jwt.verify(token, config.jwtSecret) as any;

        // Skip rate limiting for ALL authenticated users (SUPER_ADMIN, ADMIN, BACKEND_USER, FIELD_AGENT)
        // This prevents rate limiting issues for field agents processing 100+ cases per day
        return decoded.role && ['SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'FIELD_AGENT'].includes(decoded.role);
      } catch (error) {
        return false; // Apply rate limiting if token verification fails
      }
    } : undefined,
  });
};

// General API rate limiter - skip for all authenticated users
export const generalRateLimit = createRateLimiter(
  config.rateLimitWindowMs,
  config.rateLimitMaxRequests,
  'Too many requests from this IP, please try again later',
  true // Skip rate limiting for all authenticated users
);

// Auth endpoints - stricter limits (only for unauthenticated requests)
export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // Increased from 5 to 10 attempts per 15 minutes
  'Too many authentication attempts, please try again later'
);

// File upload - generous limits, skip for all authenticated users
export const uploadRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  200, // Increased from 50 to 200 uploads per minute for field agents
  'Too many file uploads, please try again later',
  true // Skip rate limiting for all authenticated users
);

// Case operations - generous limits, skip for all authenticated users
export const caseRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  500, // Increased from 100 to 500 requests per minute for high-volume field operations
  'Too many case operations, please try again later',
  true // Skip rate limiting for all authenticated users
);

// Geolocation - generous limits, skip for all authenticated users
export const geoRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  100, // Increased from 20 to 100 requests per minute
  'Too many geolocation requests, please try again later',
  true // Skip rate limiting for all authenticated users
);
