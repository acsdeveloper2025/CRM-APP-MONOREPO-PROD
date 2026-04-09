import type { Request, Response, NextFunction } from 'express';
import { toCamelCase } from '@/utils/caseConverter';

/**
 * Middleware that intercepts res.json() to auto-convert the `data` field
 * from snake_case to camelCase before sending to the client.
 *
 * This is the SINGLE point of conversion for the entire API.
 * Internal code continues using row.snake_case — conversion happens
 * ONLY at the HTTP response boundary.
 *
 * Handles:
 * - { data: { ... } }           → converts data object
 * - { data: [ {...}, {...} ] }   → converts each array element
 * - { data: "string" }          → leaves primitives unchanged
 * - Nested objects and arrays    → recursively converted
 *
 * Does NOT convert:
 * - Top-level keys (success, message, error, pagination) — already camelCase
 * - Error responses (no data field)
 * - Non-JSON responses (files, streams)
 */
export const camelCaseResponse = (_req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json = function (body: any) {
    if (body && typeof body === 'object' && body.data !== undefined) {
      const data = body.data;

      if (Array.isArray(data)) {
        body.data = data.map((item: unknown) =>
          item !== null && typeof item === 'object' && !(item instanceof Date)
            ? toCamelCase(item as Record<string, unknown>)
            : item
        );
      } else if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
        body.data = toCamelCase(data as Record<string, unknown>);
      }
      // primitives (string, number, boolean, null) pass through unchanged
    }

    return originalJson(body);
  };

  next();
};
