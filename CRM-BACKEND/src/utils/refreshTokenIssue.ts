// A-CRIT-1 chunk 2/N (AUDIT 2026-05-17): refresh-token issue helper with
// device-binding support.
//
// Centralises the "revoke prior active session for this (user, device)
// then INSERT new" semantics so login + rotation paths share one
// implementation.
//
// Backwards compatible: if `deviceId` is null/undefined/empty, falls
// back to a plain INSERT — no prior-revoke, no device columns set.
// Legacy clients that haven't opted into device-binding keep working.
//
// When `deviceId` IS provided:
//   1. Revoke any prior active token for (userId, deviceId) with reason
//      'replaced_by_new_session' (preserves forensic trail per F1.7.2
//      soft-delete pattern).
//   2. INSERT new token row with device_id + device_label populated.
//   3. The partial-unique index `uq_refresh_tokens_user_device_active`
//      (chunk 1) guarantees only one active token per (user, device).

import type { PoolClient } from 'pg';

interface IssueParams {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  deviceLabel?: string | null;
}

/** Truncate user-agent to a human-friendly label, max varchar(200). */
const deriveDeviceLabel = (userAgent: string | null | undefined): string | null => {
  if (!userAgent) {
    return null;
  }
  return userAgent.length > 200 ? userAgent.slice(0, 200) : userAgent;
};

/**
 * Issue a new refresh_tokens row for a (user, device) pair.
 *
 * Takes a `PoolClient` (so the work joins a caller-supplied transaction).
 * Login sites that aren't in a tx today should wrap this call in
 * `withTransaction(async client => issueRefreshTokenForDevice(client, ...))`
 * so the revoke-prior + insert become atomic.
 *
 * When `deviceId` is null/empty: plain INSERT (legacy clients unchanged).
 * When `deviceId` IS provided:
 *   1. Revoke any prior active token for (userId, deviceId) with reason
 *      'replaced_by_new_session' (soft-delete forensic trail per F1.7.2).
 *   2. INSERT new row with device_id + device_label.
 *   3. Partial-unique index `uq_refresh_tokens_user_device_active`
 *      (chunk 1) guarantees exactly one active row per (user, device).
 */
export const issueRefreshTokenForDevice = async (
  client: PoolClient,
  params: IssueParams
): Promise<void> => {
  const deviceId =
    typeof params.deviceId === 'string' && params.deviceId.length > 0 ? params.deviceId : null;
  const deviceLabel = params.deviceLabel ?? deriveDeviceLabel(params.userAgent);

  if (deviceId) {
    await client.query(
      `UPDATE refresh_tokens
          SET revoked_at = CURRENT_TIMESTAMP,
              revoked_reason = 'replaced_by_new_session'
        WHERE user_id = $1
          AND device_id = $2
          AND revoked_at IS NULL`,
      [params.userId, deviceId]
    );
  }

  await client.query(
    `INSERT INTO refresh_tokens (
       token, user_id, expires_at, created_at, ip_address, user_agent,
       device_id, device_label
     ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7)`,
    [
      params.tokenHash,
      params.userId,
      params.expiresAt,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      deviceId,
      deviceLabel,
    ]
  );
};
