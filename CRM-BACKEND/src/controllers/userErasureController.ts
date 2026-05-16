// C-HIGH-1 (AUDIT 2026-05-17): DPDP §15 erasure right — data principal
// can request deletion of personal data. India's DPDP carves out
// retention "for purposes" — statutory + business-record obligations
// take precedence over erasure (RBI 7-yr KYC retention, IT Act §65B
// evidence chain, employer's audit-log of who did what).
//
// Route: DELETE /api/users/:id/data
//
// Strategy:
//   REDACT the users row (name → '[ERASED]', email/phone/employee_id/
//     profile_photo_url → NULL, username → 'erased-<id>-<ts>' to satisfy
//     UNIQUE+NOT NULL, is_active → false, deleted_at → now(),
//     token_version bumped to invalidate every active session).
//   HARD-DELETE purely-personal-side state:
//     refresh_tokens, mobile_device_sync, notification_tokens,
//     notification_preferences, notification_mutes,
//     mobile_idempotency_keys.
//   KEEP (statutory / business-record retention):
//     audit_logs           — compliance trail of who did what (with WHEN
//                            the actor is now a redacted shell).
//     commission_calculations — RBI 7-yr; employer's payroll record.
//     verification_tasks / verification_attachments /
//       kyc_document_verifications / form_submissions — these are
//       end-customer KYC records owned by the data fiduciary (employer
//       + their clients). FE's authorship of them does not make the
//       content the FE's personal data.
//     user_consents         — audit trail of lawful-basis grant.
//     user_roles + user_*_assignments — grant history (inert after
//                            is_active=false + token_version bump).
//
// All operations in a single transaction. Idempotent: 409 if already
// erased (deleted_at already non-null).
//
// Authorization:
//   - self → can request own erasure (signing out as a side effect)
//   - admin with `settings.manage` → can process erasure requests
//   - else → 403
//
// Audit-logged with action='USER_ERASURE' BEFORE the redactions — so
// the audit row carries the actor + reason even after the user shell
// is redacted.

import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { withTransaction } from '@/config/db';
import { logger } from '@/config/logger';
import { errorMessage } from '@/utils/errorMessage';
import { userHasPermission } from '@/security/rbacAccess';
import { createAuditLog } from '@/utils/auditLogger';
import { invalidateAuthContextCache } from '@/middleware/auth';

export const eraseUserData = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
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

  const isSelf = requesterId === targetUserId;
  if (!isSelf && !userHasPermission(req.user, 'settings.manage')) {
    res.status(403).json({
      success: false,
      message: 'You may only erase your own data',
      error: { code: 'DATA_ERASURE_FORBIDDEN' },
    });
    return;
  }

  // Optional reason from request body — recorded in audit_logs for
  // compliance (e.g., subject-access-request ticket id).
  const reason =
    typeof req.body?.reason === 'string' && req.body.reason.length > 0
      ? req.body.reason.slice(0, 500)
      : null;

  try {
    const result = await withTransaction(async client => {
      // 1. Idempotency check — was the user already erased?
      const existing = await client.query<{ id: string; deleted_at: Date | null }>(
        `SELECT id, deleted_at FROM users WHERE id = $1`,
        [targetUserId]
      );
      if (existing.rows.length === 0) {
        return { status: 404 as const };
      }
      if (existing.rows[0].deleted_at !== null) {
        return { status: 409 as const };
      }

      // 2. Redact the users row.
      //    username: must remain UNIQUE + NOT NULL → deterministic
      //      placeholder `erased-<uuid>` (43 chars; column is varchar(50);
      //      UUID guarantees per-user uniqueness; idempotency 409 above
      //      prevents collision on retry).
      //    name: NOT NULL → '[ERASED]'.
      //    email/phone/employee_id/profile_photo_url: nullable → NULL.
      //    is_active: false (blocks login).
      //    deleted_at: now() (soft-delete marker for filter queries).
      //    token_version: +1 (invalidates every in-flight access token).
      await client.query(
        `UPDATE users
            SET name = '[ERASED]',
                username = $2,
                email = NULL,
                phone = NULL,
                employee_id = NULL,
                profile_photo_url = NULL,
                is_active = false,
                deleted_at = now(),
                updated_at = now(),
                token_version = token_version + 1
          WHERE id = $1`,
        [targetUserId, `erased-${targetUserId}`]
      );

      // 3. Hard-delete purely-personal-side state. Sessions, devices,
      //    notification prefs/tokens, idempotency keys — none of these
      //    have statutory retention; they're operational state tied to
      //    a live user account.
      await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [targetUserId]);
      await client.query(`DELETE FROM mobile_device_sync WHERE user_id = $1`, [targetUserId]);
      await client.query(`DELETE FROM notification_tokens WHERE user_id = $1`, [targetUserId]);
      await client.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [targetUserId]);
      await client.query(`DELETE FROM notification_mutes WHERE user_id = $1`, [targetUserId]);
      await client.query(`DELETE FROM mobile_idempotency_keys WHERE user_id = $1`, [targetUserId]);

      return { status: 200 as const };
    });

    if (result.status === 404) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' },
      });
      return;
    }
    if (result.status === 409) {
      res.status(409).json({
        success: false,
        message: 'User already erased',
        error: { code: 'USER_ALREADY_ERASED' },
      });
      return;
    }

    // 4. Cross-worker auth cache invalidation (token_version bump on
    //    its own only invalidates within the local process; the Redis
    //    pub/sub channel propagates to peers).
    invalidateAuthContextCache(targetUserId);

    // 5. Audit-log the erasure AFTER commit so a rolled-back tx doesn't
    //    leave a dangling "I erased X" record. BullMQ-enqueued — won't
    //    block the response. The audit_logs row itself is retained
    //    per the statutory exception (DPDP §15 carve-out).
    void createAuditLog({
      action: 'USER_ERASURE',
      entityType: 'USER',
      entityId: targetUserId,
      userId: requesterId,
      details: {
        requestedBy: isSelf ? 'self' : 'admin',
        dpdpSection: '§15',
        reason,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('User data erased', {
      targetUserId,
      requesterId,
      isSelf,
    });

    res.json({
      success: true,
      message: 'User data erased',
      data: {
        userId: targetUserId,
        erasedAt: new Date().toISOString(),
        retainedRecords: {
          reason:
            'Per DPDP §15 statutory exceptions + RBI/IT Act retention obligations',
          tables: [
            'audit_logs',
            'commission_calculations',
            'verification_tasks',
            'verification_attachments',
            'kyc_document_verifications',
            'form_submissions',
            'user_consents',
            'user_roles',
            'user_*_assignments',
          ],
        },
      },
    });
  } catch (err) {
    logger.error('eraseUserData failed', {
      targetUserId,
      requesterId,
      error: errorMessage(err),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to erase user data',
      error: { code: 'DATA_ERASURE_FAILED' },
    });
  }
};
