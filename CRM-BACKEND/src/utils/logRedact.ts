/**
 * Sanitize an object before logging so that sensitive fields (passwords,
 * tokens, secrets, identity/credential numbers) are masked and large nested
 * payloads are truncated.
 *
 * Use this anywhere you want to log request bodies, response payloads, or
 * any external object whose shape you do not fully control. The rule is
 * "log the shape, never the secret".
 */

// Field names whose values are always redacted (case-insensitive, substring).
const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'newpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'apikey',
  'api_key',
  'secret',
  'sessionsecret',
  'privatekey',
  'otp',
  'pin',
  'panNumber',
  'pan_number',
  'aadhaar',
  'aadhar',
  'ssn',
  'cvv',
  'cardnumber',
  'accountnumber',
  'ifsc',
  'bankaccount',
];

const MASK = '[REDACTED]';
const MAX_STRING_LEN = 500;

const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some(s => lower.includes(s));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function redact(value: any, depth = 0): any {
  if (depth > 6) {
    return '[...deep]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length}b]`;
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LEN
      ? `${value.slice(0, MAX_STRING_LEN)}...[truncated ${value.length - MAX_STRING_LEN}]`
      : value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 50) {
      return [...value.slice(0, 50).map(v => redact(v, depth + 1)), `[+${value.length - 50} more]`];
    }
    return value.map(v => redact(v, depth + 1));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const k of Object.keys(value)) {
    if (isSensitiveKey(k)) {
      out[k] = MASK;
    } else {
      out[k] = redact(value[k], depth + 1);
    }
  }
  return out;
}
