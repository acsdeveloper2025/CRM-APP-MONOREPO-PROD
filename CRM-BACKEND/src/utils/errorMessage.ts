/**
 * Safely format an `unknown` value (typically a caught error) into a
 * human-readable string for logs and API responses.
 *
 * Why this exists: with `useUnknownInCatchVariables` enabled, every
 * caught value is `unknown`. The naive narrowing
 * `e instanceof Error ? e.message : String(e)` trips ESLint's
 * `@typescript-eslint/no-base-to-string` because `String(plainObject)`
 * collapses to `"[object Object]"`. This helper handles the common
 * non-Error shapes — strings, numbers, JSON-serialisable objects — and
 * falls back to a tag for truly opaque values.
 */
export const errorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'number' || typeof err === 'boolean' || err === null || err === undefined) {
    return String(err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return '[unserialisable error]';
  }
};
