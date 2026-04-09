import type { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import { toSnakeCase } from '@/utils/caseConverter';

/**
 * Recursively sanitize all string values in an object to prevent stored XSS.
 * Preserves non-string types (numbers, booleans, null, arrays, nested objects).
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeValue(obj[key]);
  }
  return sanitized;
}

/**
 * Express middleware that:
 * 1. Sanitizes req.body and req.query to strip XSS
 * 2. Converts req.body keys from camelCase to snake_case
 *
 * This is the REQUEST counterpart to camelCaseResponse middleware:
 *   Frontend (camelCase) → sanitizeInput (XSS + snake_case) → Controller (snake_case)
 *   Controller (snake_case) → camelCaseResponse → Frontend (camelCase)
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    // Step 1: Sanitize XSS
    req.body = sanitizeObject(req.body as Record<string, unknown>);
    // Step 2: Convert camelCase keys to snake_case (so controllers always get snake_case)
    req.body = toSnakeCase(req.body as Record<string, unknown>);
  }

  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = xss(val);
      }
    }
  }

  next();
};
