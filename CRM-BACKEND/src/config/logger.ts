import winston from 'winston';
import { redact } from '@/utils/logRedact';

const logLevel = process.env.LOG_LEVEL || 'info';

// Regex patterns applied to plain string values (message body, raw log
// lines). The structural / field-name redaction is delegated to
// `redact()` in src/utils/logRedact.ts so there is a single source of
// truth for "which keys are sensitive". Phase F2 unifies the two
// previously separate redaction paths into one winston formatter.
const PII_PATTERNS: [RegExp, string][] = [
  // Phone numbers (10+ digits, with optional country code/dashes/spaces)
  [/\b(\+?\d[\d\s-]{8,}\d)\b/g, '[PHONE_REDACTED]'],
  // PAN numbers (Indian tax ID: ABCDE1234F)
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN_REDACTED]'],
  // Aadhaar numbers (12 digits, sometimes spaced)
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR_REDACTED]'],
  // Email addresses
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL_REDACTED]'],
];

/** Apply the regex patterns above to a single string value. */
function scrubString(value: string): string {
  let redacted = value;
  for (const [pattern, replacement] of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/** Recursively apply string scrubbing to a value already returned by `redact()`. */
function scrubPIIInPlace(value: unknown): unknown {
  if (typeof value === 'string') {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map(scrubPIIInPlace);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = scrubPIIInPlace(v);
    }
    return result;
  }
  return value;
}

/**
 * Phase F2: single winston formatter that pipes every log entry's
 * metadata through the canonical `redact()` helper (from
 * src/utils/logRedact.ts) for field-name / depth / length redaction
 * AND through the regex-based PII scrubber above for phone / PAN /
 * Aadhaar / email scraping from free-text fields. The two were
 * previously separate implementations; unifying them means adding a
 * new sensitive field name (say `nationalId`) to logRedact.ts
 * automatically takes effect in winston output.
 */
const piiRedactionFormat = winston.format(info => {
  if (info.message && typeof info.message === 'string') {
    info.message = scrubString(info.message);
  }
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp' || key === 'service') {
      continue;
    }
    // First redact by field name / depth / length, then regex-strip
    // the residual strings. Applying in this order means a
    // sensitive-field value is fully masked before the regex pass
    // even looks at it.
    info[key] = scrubPIIInPlace(redact(info[key]));
  }
  return info;
});

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  piiRedactionFormat(),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const ts = typeof timestamp === 'string' ? timestamp : JSON.stringify(timestamp);
    const lvl = typeof level === 'string' ? level : JSON.stringify(level);
    const msgText =
      typeof message === 'string'
        ? message
        : typeof message === 'object'
          ? JSON.stringify(message)
          : String(message as number | boolean | undefined | null);
    let msg = `${ts} [${lvl}]: ${msgText}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'crm-backend' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (_error) {
  // Directory already exists or permission error
}
