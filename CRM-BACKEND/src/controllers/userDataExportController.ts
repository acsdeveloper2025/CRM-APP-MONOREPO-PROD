// C-HIGH-1 (AUDIT 2026-05-17): DPDP §11 access right — data subject can
// request a copy of all personal data the system holds about them.
//
// Route: GET /api/users/:id/data-export
//
// Returns a sanitized JSON download bundling:
//   - profile (users row; password_hash + token_version EXCLUDED)
//   - roles (user_roles → roles_v2)
//   - consents (user_consents)
//   - scope assignments (clients / products / pincodes / areas)
//   - commission assignments + earned commissions
//   - device list (mobile_device_sync; raw FCM tokens REDACTED)
//   - notification preferences (notification_preferences row)
//
// Excluded by design (not "personal data of the data principal" per DPDP):
//   - cases / verification_tasks / form_submissions / attachments
//     → these are the EMPLOYER's business records (client KYC data).
//       FEs working on them does not make the content their personal data.
//   - audit_logs → separate self-service endpoint exists (see
//     userAuditLogController.ts). Cross-reference noted in response.
//
// Excluded sensitive fields:
//   - users.password_hash, users.token_version (internal auth state)
//   - notification_tokens.token, notification_tokens.device_token
//     (raw push tokens — keeping them in an export would expose a
//     channel the subject hasn't actively requested)
//   - refresh_tokens table contents (current session secrets — never
//     export)
//
// Authorization (same as audit-log):
//   - self (req.user.id === req.params.id) → always allowed
//   - admin with `settings.manage` permission → allowed for any user
//   - else → 403

import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { errorMessage } from '@/utils/errorMessage';
import { userHasPermission } from '@/security/rbacAccess';

export const exportUserData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      message: 'You may only export your own data',
      error: { code: 'DATA_EXPORT_FORBIDDEN' },
    });
    return;
  }

  try {
    // 1. Profile (sanitized — password_hash + token_version dropped)
    const profileRes = await query(
      `SELECT id, name, username, email, phone, is_active, last_login,
              created_at, updated_at, employee_id, profile_photo_url,
              department_id, designation_id, performance_rating,
              total_cases_handled, avg_case_completion_days, last_active_at,
              deleted_at, team_leader_id, manager_id
         FROM users WHERE id = $1`,
      [targetUserId]
    );

    if (profileRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' },
      });
      return;
    }

    // 2. Roles
    const rolesRes = await query(
      `SELECT rv.id, rv.name, rv.description, ur.created_at AS assigned_at
         FROM user_roles ur
         JOIN roles_v2 rv ON rv.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY ur.created_at DESC`,
      [targetUserId]
    );

    // 3. Consents granted by the subject
    const consentsRes = await query(
      `SELECT id, policy_version, accepted_at, ip_address, user_agent, source
         FROM user_consents WHERE user_id = $1 ORDER BY accepted_at DESC`,
      [targetUserId]
    );

    // 4. Scope assignments — what they've been given access to
    const [clientsRes, productsRes, pincodesRes, areasRes] = await Promise.all([
      query(`SELECT client_id, created_at FROM user_client_assignments WHERE user_id = $1`, [
        targetUserId,
      ]),
      query(`SELECT product_id, created_at FROM user_product_assignments WHERE user_id = $1`, [
        targetUserId,
      ]),
      query(`SELECT pincode_id, created_at FROM user_pincode_assignments WHERE user_id = $1`, [
        targetUserId,
      ]),
      query(
        `SELECT pincode_id, user_pincode_assignment_id, created_at FROM user_area_assignments WHERE user_id = $1`,
        [targetUserId]
      ),
    ]);

    // 5. Commission assignments + earned commissions
    const [commAssignmentsRes, commEarnedRes] = await Promise.all([
      query(
        `SELECT client_id, rate_type_id, created_at
           FROM field_user_commission_assignments
          WHERE user_id = $1
          ORDER BY created_at DESC`,
        [targetUserId]
      ),
      query(
        `SELECT id, case_id, client_id, rate_type_id, base_amount,
                commission_amount, calculated_commission, currency, status,
                case_completed_at, approved_at, paid_at, created_at
           FROM commission_calculations
          WHERE user_id = $1
          ORDER BY created_at DESC`,
        [targetUserId]
      ),
    ]);

    // 6. Device list (mobile_device_sync; no raw tokens — table has none)
    const devicesRes = await query(
      `SELECT id, device_id, platform, app_version, sync_count, last_sync_at, created_at
         FROM mobile_device_sync
        WHERE user_id = $1
        ORDER BY last_sync_at DESC NULLS LAST`,
      [targetUserId]
    );

    // 7. Notification preferences (single row)
    const notifPrefRes = await query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [
      targetUserId,
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      exportedBy: isSelf ? 'self' : `admin:${requesterId}`,
      dpdpSection: 'DPDP Act 2023 §11 — Right to access personal data',
      subject: profileRes.rows[0],
      roles: rolesRes.rows,
      consents: consentsRes.rows,
      assignments: {
        clients: clientsRes.rows,
        products: productsRes.rows,
        pincodes: pincodesRes.rows,
        areas: areasRes.rows,
      },
      commissions: {
        assignments: commAssignmentsRes.rows,
        earned: commEarnedRes.rows,
      },
      devices: devicesRes.rows,
      notificationPreferences: notifPrefRes.rows[0] ?? null,
      auditLogReference: `GET /api/users/${targetUserId}/audit-log for the full audit trail (DPDP §9(4))`,
      excludedFields: {
        reason:
          'Per DPDP scope: business records (cases, verification tasks, KYC docs) belong to the data fiduciary (employer), not the data principal. Internal auth state (password_hash, token_version, push tokens, refresh tokens) is intentionally excluded for security.',
      },
    };

    // Audit-log this export (admin-driven access to subject data is itself
    // a §9(4)-relevant event).
    logger.info('User data export issued', {
      targetUserId,
      requesterId,
      isSelf,
    });

    const filename = `user-${targetUserId}-data-export-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(bundle);
  } catch (err) {
    logger.error('exportUserData failed', {
      targetUserId,
      requesterId,
      error: errorMessage(err),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to export user data',
      error: { code: 'DATA_EXPORT_FAILED' },
    });
  }
};
