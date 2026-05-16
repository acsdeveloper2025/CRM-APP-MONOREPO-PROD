// A-CRIT-1 chunk 3/N (AUDIT 2026-05-17): admin + self-service session
// management. Lets a stolen-phone scenario be remediated by revoking
// just ONE device's session instead of nuking every active session via
// `token_version` bump.
//
// Routes:
//   GET    /api/users/:id/sessions             list active sessions
//   DELETE /api/users/:id/sessions/:sessionId  revoke one session
//
// Authorization: self OR `settings.manage` admin.
//
// Why no token_version bump on revoke?
//   - Bumping evicts EVERY active session for the user — the wrong
//     blast radius for a single-device revoke.
//   - The revoked device's refresh token is now invalid → on next
//     refresh attempt the client gets a 401 and logs out.
//   - The access token (15min web / 24h mobile) survives until natural
//     TTL OR the chunk-4 mobile WS `auth:session_revoked` push lands +
//     wipes Keychain.
//   - For "all sessions out" use the existing logout-all infrastructure
//     which DOES bump token_version.

import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { errorMessage } from '@/utils/errorMessage';
import { userHasPermission } from '@/security/rbacAccess';
import { createAuditLog } from '@/utils/auditLogger';
import { emitSessionRevoked } from '@/websocket/server';

interface SessionRow {
  id: string;
  device_id: string | null;
  device_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  expires_at: Date;
}

const checkAuthorized = (
  req: AuthenticatedRequest,
  targetUserId: string,
  res: Response
): boolean => {
  const isSelf = req.user?.id === targetUserId;
  if (isSelf) {
    return true;
  }
  if (!userHasPermission(req.user, 'settings.manage')) {
    res.status(403).json({
      success: false,
      message: 'You may only manage your own sessions',
      error: { code: 'SESSIONS_FORBIDDEN' },
    });
    return false;
  }
  return true;
};

export const listUserSessions = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const targetUserId = String(req.params.id ?? '');
  if (!targetUserId) {
    res.status(400).json({
      success: false,
      message: 'User id is required',
      error: { code: 'INVALID_USER_ID' },
    });
    return;
  }
  if (!checkAuthorized(req, targetUserId, res)) {
    return;
  }

  try {
    const result = await query<SessionRow>(
      `SELECT id::text, device_id, device_label, ip_address, user_agent,
              created_at, expires_at
         FROM refresh_tokens
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC`,
      [targetUserId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        sessionId: row.id,
        deviceId: row.device_id,
        deviceLabel: row.device_label,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        isCurrentSession: false, // FE may set per-token comparison if it surfaces the current session id
      })),
    });
  } catch (err) {
    logger.error('listUserSessions failed', {
      targetUserId,
      requesterId: req.user?.id,
      error: errorMessage(err),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to list user sessions',
      error: { code: 'SESSIONS_LIST_FAILED' },
    });
  }
};

export const revokeUserSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const targetUserId = String(req.params.id ?? '');
  const sessionId = String(req.params.sessionId ?? '');
  const requesterId = req.user?.id;

  if (!targetUserId || !sessionId) {
    res.status(400).json({
      success: false,
      message: 'User id and session id are required',
      error: { code: 'INVALID_INPUT' },
    });
    return;
  }
  if (!checkAuthorized(req, targetUserId, res)) {
    return;
  }

  try {
    // Atomic claim: revoke only if still active. Returning row count
    // distinguishes "revoked just now" from "already revoked" /
    // "not found" / "belongs to different user".
    const result = await query<{ id: string; device_label: string | null }>(
      `UPDATE refresh_tokens
          SET revoked_at = CURRENT_TIMESTAMP,
              revoked_reason = $3
        WHERE id = $1
          AND user_id = $2
          AND revoked_at IS NULL
        RETURNING id::text, device_label`,
      [
        sessionId,
        targetUserId,
        requesterId === targetUserId ? 'self_revoked' : 'admin_force_logout',
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Session not found or already revoked',
        error: { code: 'SESSION_NOT_FOUND' },
      });
      return;
    }

    // Audit the revocation.
    void createAuditLog({
      action: 'SESSION_REVOKED',
      entityType: 'REFRESH_TOKEN',
      entityId: sessionId,
      userId: requesterId,
      details: {
        targetUserId,
        deviceLabel: result.rows[0].device_label,
        revokedBy: requesterId === targetUserId ? 'self' : 'admin',
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // A-CRIT-1 chunk 4 (AUDIT 2026-05-17): real-time WS push to the
    // affected user's room. Mobile client matches its current sessionId
    // and wipes Keychain immediately. Fire-and-forget; durable signal
    // is the refresh_tokens row (will 401 on next refresh anyway).
    emitSessionRevoked(targetUserId, sessionId, result.rows[0].device_label);

    logger.info('User session revoked', {
      sessionId,
      targetUserId,
      requesterId,
    });

    res.json({
      success: true,
      message: 'Session revoked',
      data: {
        sessionId,
        revokedAt: new Date().toISOString(),
        note: 'Affected device will be evicted on next refresh-token attempt (401) or on receipt of auth:session_revoked WebSocket push (chunk 4).',
      },
    });
  } catch (err) {
    logger.error('revokeUserSession failed', {
      sessionId,
      targetUserId,
      requesterId,
      error: errorMessage(err),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to revoke session',
      error: { code: 'SESSION_REVOKE_FAILED' },
    });
  }
};
