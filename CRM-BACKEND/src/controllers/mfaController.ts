// T1-2 (audit 2026-05-17): MFA enrollment/disable endpoints.
//
// This commit ships ENROLLMENT only. The login-flow integration (issuing
// an mfaChallenge token when a user with an MFA-required role logs in,
// and the `/auth/mfa/verify` endpoint) lands in a follow-up commit so
// MFA cannot be required by the system before there is a way to satisfy
// the challenge.

import { Response } from 'express';
import { query } from '@/config/database';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { createAuditLog } from '@/utils/auditLogger';
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  totpVerify,
} from '@/utils/mfa';
import type { AuthenticatedRequest } from '@/types/auth';

const ISSUER = 'CRM-APP';

/**
 * POST /api/auth/mfa/enroll/start
 *
 * Auth required. Generates a fresh TOTP secret and returns it to the
 * caller along with the otpauth URI for QR rendering. The secret is
 * NOT persisted yet — the client holds it until /enroll/verify confirms
 * the user has it loaded in their authenticator app. (Persisting an
 * unverified secret would let an enrollment-abort leave the account in
 * a half-locked state.)
 */
export const startEnrollment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  // Block re-enrollment of an already-enrolled user; require explicit
  // disable first. Prevents a leaked session from silently rotating
  // the second-factor away from the legitimate user.
  const existing = await query('SELECT 1 FROM user_mfa_secrets WHERE user_id = $1', [req.user.id]);
  if (existing.rows.length > 0) {
    res.status(409).json({
      success: false,
      message: 'MFA already enrolled. Disable existing enrollment before re-enrolling.',
    });
    return;
  }

  const secret = generateTotpSecret();
  const secretBase32 = base32Encode(secret);
  const uri = otpauthUri(secretBase32, req.user.username, ISSUER);

  res.json({
    success: true,
    data: {
      secret: secretBase32,
      otpauthUri: uri,
    },
  });
};

/**
 * POST /api/auth/mfa/enroll/verify
 *
 * Auth required. Body: { secret: base32, code: '123456' }.
 * Verifies the TOTP code against the supplied secret; if it matches,
 * encrypts the secret + generates + hashes 10 recovery codes, persists
 * to user_mfa_secrets, and returns the plaintext recovery codes to the
 * caller. The plaintexts are shown to the user ONCE — they are not
 * stored and cannot be re-shown.
 */
export const verifyEnrollment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const { secret, code } = req.body as { secret?: string; code?: string };
  if (!secret || !code) {
    res.status(400).json({ success: false, message: 'secret and code are required' });
    return;
  }

  let secretBuf: Buffer;
  try {
    secretBuf = base32Decode(secret);
  } catch {
    res.status(400).json({ success: false, message: 'Invalid secret encoding' });
    return;
  }

  if (!totpVerify(secretBuf, code)) {
    res.status(400).json({ success: false, message: 'Invalid code' });
    return;
  }

  // Re-check existence inside the verify path (race window between
  // /enroll/start and /enroll/verify): if a different concurrent
  // session enrolled, reject.
  const existing = await query('SELECT 1 FROM user_mfa_secrets WHERE user_id = $1', [req.user.id]);
  if (existing.rows.length > 0) {
    res.status(409).json({ success: false, message: 'MFA already enrolled in another session' });
    return;
  }

  const encrypted = encryptSecret(secretBuf, config.mfaEncryptionKey);
  const { plaintexts, hashes } = generateRecoveryCodes();

  await query(
    `INSERT INTO user_mfa_secrets (user_id, secret_encrypted, recovery_code_hashes)
     VALUES ($1, $2, $3)`,
    [req.user.id, encrypted, hashes]
  );

  await createAuditLog({
    action: 'MFA_ENROLLED',
    entityType: 'user_mfa_secrets',
    entityId: req.user.id,
    userId: req.user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    success: true,
    data: {
      recoveryCodes: plaintexts,
    },
    message:
      'MFA enrolled. Save these recovery codes — they will not be shown again and each works exactly once.',
  });
};

/**
 * GET /api/auth/mfa/status
 *
 * Returns the current user's MFA enrollment + requirement state.
 * `mfaRequiredForUser` = true means at least one of the caller's roles
 * has mfa_required=true on roles_v2; the FE uses this to decide whether
 * to nag the user about enrollment.
 */
export const getStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const result = await query<{ enrolled: boolean; mfa_required_for_user: boolean }>(
    `SELECT
       EXISTS (SELECT 1 FROM user_mfa_secrets WHERE user_id = $1) AS enrolled,
       EXISTS (
         SELECT 1 FROM user_roles ur
         JOIN roles_v2 rv2 ON rv2.id = ur.role_id
         WHERE ur.user_id = $1 AND rv2.mfa_required = true
       ) AS mfa_required_for_user`,
    [req.user.id]
  );
  const row = result.rows[0];
  res.json({
    success: true,
    data: {
      enrolled: row?.enrolled ?? false,
      mfaRequiredForUser: row?.mfa_required_for_user ?? false,
    },
  });
};

/**
 * POST /api/auth/mfa/disable/:userId
 *
 * Admin-only break-glass (authorize('settings.manage')). Removes a
 * user's MFA enrollment so they can log in with password only and
 * re-enroll. Logs the action against the tamper-evident audit chain
 * so the operation is observable forever.
 */
export const adminDisable = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const targetId = req.params.userId;
  if (!targetId) {
    res.status(400).json({ success: false, message: 'userId is required' });
    return;
  }

  const result = await query('DELETE FROM user_mfa_secrets WHERE user_id = $1', [targetId]);

  if (result.rowCount === 0) {
    res.status(404).json({ success: false, message: 'No MFA enrollment found for that user' });
    return;
  }

  await createAuditLog({
    action: 'MFA_DISABLED_BY_ADMIN',
    entityType: 'user_mfa_secrets',
    entityId: targetId,
    userId: req.user.id,
    details: { targetUserId: targetId, adminUserId: req.user.id },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.warn('MFA disabled by admin', { admin: req.user.id, target: targetId });

  res.json({ success: true });
};

/**
 * Verify a TOTP code or recovery code for a user. Returns true on
 * match; consumes the recovery code if used. Exported so the
 * follow-up login-flow integration commit can call it from the
 * `/auth/mfa/verify` endpoint and from a middleware that gates
 * MFA-required role traffic.
 */
export const verifyUserCode = async (userId: string, code: string): Promise<boolean> => {
  const result = await query<{
    secret_encrypted: Buffer;
    recovery_code_hashes: Buffer[];
    recovery_code_used_at: (Date | null)[];
  }>(
    `SELECT secret_encrypted, recovery_code_hashes, recovery_code_used_at
       FROM user_mfa_secrets
      WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    return false;
  }
  const row = result.rows[0];

  const trimmed = code.trim();

  // TOTP path: 6 digits
  if (/^\d{6}$/.test(trimmed)) {
    const secret = decryptSecret(row.secret_encrypted, config.mfaEncryptionKey);
    if (totpVerify(secret, trimmed)) {
      await query('UPDATE user_mfa_secrets SET last_used_at = NOW() WHERE user_id = $1', [userId]);
      return true;
    }
    return false;
  }

  // Recovery code path: anything else (hash + match against unused codes)
  const candidate = hashRecoveryCode(trimmed);
  for (let i = 0; i < row.recovery_code_hashes.length; i++) {
    if (row.recovery_code_used_at[i] !== null) {
      continue;
    }
    if (row.recovery_code_hashes[i].equals(candidate)) {
      // Mark just this index consumed.
      await query(
        `UPDATE user_mfa_secrets
            SET recovery_code_used_at[$2] = NOW(),
                last_used_at = NOW()
          WHERE user_id = $1`,
        [userId, i + 1] // PG arrays are 1-indexed
      );
      return true;
    }
  }
  return false;
};
