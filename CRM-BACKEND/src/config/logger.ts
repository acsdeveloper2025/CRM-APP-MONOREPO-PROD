import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

// PII patterns to redact from log output
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

/** Recursively redact PII from any log value */
function redactPII(value: unknown): unknown {
  if (typeof value === 'string') {
    let redacted = value;
    for (const [pattern, replacement] of PII_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }
  if (Array.isArray(value)) {
    return value.map(redactPII);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Redact known sensitive field names entirely
      const lk = k.toLowerCase();
      if (
        lk.includes('password') ||
        lk.includes('token') ||
        lk.includes('secret') ||
        lk.includes('authorization')
      ) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactPII(v);
      }
    }
    return result;
  }
  return value;
}

/** Winston format that strips PII from all log entries */
const piiRedactionFormat = winston.format(info => {
  if (info.message && typeof info.message === 'string') {
    info.message = redactPII(info.message) as string;
  }
  // Redact metadata fields
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp' || key === 'service') {
      continue;
    }
    info[key] = redactPII(info[key]);
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
