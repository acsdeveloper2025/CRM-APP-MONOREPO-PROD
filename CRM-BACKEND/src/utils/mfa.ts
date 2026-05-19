// T1-2 (audit 2026-05-17): TOTP MFA primitives.
//
// Self-contained RFC 6238 (TOTP) + RFC 4648 (base32) + AES-256-GCM
// envelope. No external deps. Pin choices that match the broad-install
// authenticator apps (Google Authenticator, Authy, 1Password):
//   - SHA-1 (still required by Google Authenticator)
//   - 6 digits
//   - 30-second window
//   - ±1 window of clock slip accepted on verify
//
// Encryption envelope for stored secrets:
//   secret_encrypted = IV(12) || authTag(16) || ciphertext
// AES-256-GCM. Key lives in config.mfaEncryptionKey (32 bytes).

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';

// -------------------------- base32 (RFC 4648) --------------------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buf: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
};

export const base32Decode = (s: string): Buffer => {
  const clean = s.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

// -------------------------- TOTP (RFC 6238) ----------------------------

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

const hotp = (secret: Buffer, counter: number): string => {
  const buf = Buffer.alloc(8);
  // counter is a 64-bit big-endian integer; JS bitwise ops are 32-bit,
  // so split into high/low halves.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', secret).update(buf).digest();
  // Dynamic truncation per RFC 4226
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** TOTP_DIGITS;
  return code.toString().padStart(TOTP_DIGITS, '0');
};

export const totpGenerate = (secret: Buffer, atMs: number = Date.now()): string => {
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  return hotp(secret, counter);
};

/**
 * Verify a TOTP code. Accepts the current step + 1 step on either
 * side (±30s) to ride out small clock drift on the user's device.
 * Returns true on match, false otherwise. Uses constant-time-ish
 * comparison via string equality (codes are 6 digits, branch leak is
 * acceptable for non-cryptographic data of this length).
 */
export const totpVerify = (secret: Buffer, code: string, atMs: number = Date.now()): boolean => {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  const currentStep = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  for (const offset of [-1, 0, 1]) {
    if (hotp(secret, currentStep + offset) === code) {
      return true;
    }
  }
  return false;
};

export const generateTotpSecret = (): Buffer => randomBytes(20); // 160-bit, RFC 6238 §5.1 minimum

/**
 * Format an otpauth:// URI for QR-code display in authenticator apps.
 * `accountName` and `issuer` should be URL-safe-ish; we percent-encode
 * just in case (Google Authenticator accepts spaces, but other apps
 * trip on them).
 */
export const otpauthUri = (secretBase32: string, accountName: string, issuer: string): string => {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

// -------------------------- AES-256-GCM envelope ------------------------

const IV_BYTES = 12;
const TAG_BYTES = 16;

export const encryptSecret = (plaintext: Buffer, key: Buffer): Buffer => {
  if (key.length !== 32) {
    throw new Error('MFA encryption key must be 32 bytes');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
};

export const decryptSecret = (envelope: Buffer, key: Buffer): Buffer => {
  if (key.length !== 32) {
    throw new Error('MFA encryption key must be 32 bytes');
  }
  if (envelope.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Encrypted envelope too short');
  }
  const iv = envelope.subarray(0, IV_BYTES);
  const tag = envelope.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = envelope.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
};

// -------------------------- Recovery codes -----------------------------

const RECOVERY_CODE_COUNT = 10;

export const hashRecoveryCode = (code: string): Buffer => {
  // Normalize: strip dashes, uppercase. Recovery codes are not secret
  // by entropy alone (40 bits) — they ride on rate-limiting at the
  // verify endpoint. No PBKDF needed; SHA-256 is fine.
  const normalized = code.replace(/-/g, '').toUpperCase();
  return createHash('sha256').update(normalized).digest();
};

/**
 * Generate 10 single-use recovery codes. Returns the plaintext (shown
 * once to the user) AND the SHA-256 hashes (persisted; plaintext is
 * never stored). Format: XXXX-XXXX-XXXX (12 base32 chars, easy to
 * type, no ambiguous 0/O/1/I).
 */
export const generateRecoveryCodes = (): { plaintexts: string[]; hashes: Buffer[] } => {
  const plaintexts: string[] = [];
  const hashes: Buffer[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const raw = base32Encode(randomBytes(8)).slice(0, 12); // 12 base32 chars
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    plaintexts.push(formatted);
    hashes.push(hashRecoveryCode(formatted));
  }
  return { plaintexts, hashes };
};
