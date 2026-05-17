// C-HIGH-3 (AUDIT 2026-05-17): DPDP §9(4) self-service audit-log access.
//
// Returns the audit_logs trail for a specific user — paginated. A data
// subject (the user themselves) can audit who/what accessed their data.
// Admins with `settings.manage` can view any user's trail for incident
// response.
//
// Route: GET /api/users/:id/audit-log?page=1&limit=50
//
// Authorization:
//   - self (req.user.id === req.params.id) → always allowed
//   - admin with `settings.manage` permission → allowed for any user
//   - else → 403

import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { errorMessage } from '@/utils/errorMessage';
import { userHasPermission } from '@/security/rbacAccess';

interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  details: unknown;
}

export const getUserAuditLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const targetUserId = String(req.params.id ?? '');
  const requesterId = req.user?.id;

  if (!targetUserId) {
    res.status(400).json({
      success: false,
      message: 'User id is required',
      error: { code: 'INVALID_USER_ID' },
    });
    return;
  }

  // Self OR settings.manage admin only. No client/scope leak path here —
  // audit-log is the highest-trust read in the system.
  const isSelf = requesterId === targetUserId;
  if (!isSelf && !userHasPermission(req.user, 'settings.manage')) {
    res.status(403).json({
      success: false,
      message: 'You may only view your own audit log',
      error: { code: 'AUDIT_LOG_FORBIDDEN' },
    });
    return;
  }

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
  const offset = (page - 1) * limit;

  try {
    // Return rows where the user is either the ACTOR (user_id) OR the
    // SUBJECT (entity_type='USER' AND entity_id = target). Both lenses
    // matter for DPDP transparency: "what did I do?" + "what was done
    // to my account?".
    const dataRes = await query<AuditLogRow>(
      `SELECT id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at, details
         FROM audit_logs
        WHERE user_id = $1
           OR (entity_type = 'USER' AND entity_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset]
    );
    const countRes = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
         FROM audit_logs
        WHERE user_id = $1
           OR (entity_type = 'USER' AND entity_id = $1)`,
      [targetUserId]
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        total: Number(countRes.rows[0]?.total ?? 0),
      },
      meta: {
        viewer: isSelf ? 'self' : 'admin',
      },
    });
  } catch (err) {
    logger.error('getUserAuditLog failed', {
      targetUserId,
      requesterId,
      error: errorMessage(err),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user audit log',
      error: { code: 'AUDIT_LOG_FETCH_FAILED' },
    });
  }
};
