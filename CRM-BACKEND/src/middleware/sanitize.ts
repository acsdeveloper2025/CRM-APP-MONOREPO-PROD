import type { Request, Response, NextFunction } from 'express';
import xss from 'xss';

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
 * Express middleware that sanitizes req.body and req.query string values
 * to strip dangerous HTML/JavaScript and prevent stored XSS attacks.
 *
 * Frontend sends camelCase → controllers read camelCase from req.body.
 * Response conversion (snake→camel) is handled by camelCaseResponse middleware.
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
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
