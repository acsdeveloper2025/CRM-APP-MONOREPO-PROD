import type { Request, Response, NextFunction } from 'express';
import xss from 'xss';

/**
 * Recursively sanitize all string values in a value, including deeply
 * nested arrays and objects (Phase E6). This matters for JSONB payloads
 * where user-supplied fields can live several levels deep (e.g.
 * `residenceVerificationData.applicant.contactDetails.whatsapp`).
 *
 * Preserves non-string types (numbers, booleans, null, Date, Buffer)
 * unchanged. Max depth is bounded to prevent a pathological or
 * adversarial payload (circular reference, 1000-level nested object)
 * from blowing the stack.
 */
const MAX_SANITIZE_DEPTH = 32;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_SANITIZE_DEPTH) {
    // At the depth ceiling we stop recursing and return the value
    // as-is. A payload this deep is almost certainly either
    // adversarial or a bug; the route-level validator will reject it.
    return value;
  }
  if (typeof value === 'string') {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    // Skip Buffer and Date — they'd otherwise be walked as plain
    // objects and their internal state would get corrupted.
    if (Buffer.isBuffer(value) || value instanceof Date) {
      return value;
    }
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>, depth: number): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeValue(obj[key], depth);
  }
  return sanitized;
}

/**
 * Sanitize a query-string value, handling both single strings and the
 * array form that Express produces when a key repeats
 * (e.g. `?status=PENDING&status=ASSIGNED`).
 */
function sanitizeQueryValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'string' ? xss(v) : v));
  }
  return value;
}

/**
 * Express middleware that sanitizes req.body and req.query string values
 * to strip dangerous HTML/JavaScript and prevent stored XSS attacks.
 *
 * Recursion invariant (Phase E6):
 *   - Every string reachable from req.body via arrays or nested objects
 *     is run through xss(), up to MAX_SANITIZE_DEPTH levels.
 *   - Every string in req.query, whether scalar or array, is run
 *     through xss().
 *
 * Frontend sends camelCase → controllers read camelCase from req.body.
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeObject(req.body as Record<string, unknown>, 0);
  }

  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const sanitized = sanitizeQueryValue(req.query[key]);
      (req.query as Record<string, unknown>)[key] = sanitized;
    }
  }

  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      const value = (req.params as Record<string, unknown>)[key];
      if (typeof value === 'string') {
        (req.params as Record<string, unknown>)[key] = xss(value);
      }
    }
  }

  next();
};
