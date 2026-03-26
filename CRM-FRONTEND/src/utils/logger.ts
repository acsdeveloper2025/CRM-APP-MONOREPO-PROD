/**
 * Lightweight browser logger with level control.
 * In production, only warn/error are emitted. In development, all levels are active.
 * Centralising log calls makes it easy to add remote error reporting (Sentry, etc.) later.
 */

const IS_DEV = import.meta.env.DEV;

function noop(..._args: unknown[]): void {
  // intentionally empty — suppresses logs in production
}

/* eslint-disable no-console -- Logger facade intentionally wraps console methods */
export const logger = {
  debug: IS_DEV ? console.debug.bind(console) : noop,
  info: IS_DEV ? console.info.bind(console) : noop,
  log: IS_DEV ? console.log.bind(console) : noop,
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
/* eslint-enable no-console */
