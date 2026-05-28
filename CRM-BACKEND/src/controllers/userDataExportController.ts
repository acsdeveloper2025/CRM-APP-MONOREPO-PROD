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
import { reportTemplateRenderer } from '@/services/reportTemplateRenderer';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { errorMessage } from '@/utils/errorMessage';
import { userHasPermission } from '@/security/rbacAccess';

// HTML entity-escape for any value that will land inside a tag body.
// Numbers / booleans / null / undefined coerced to string first.
// We deliberately stringify primitives via JSON for objects/arrays so a
// Postgres row value that lands here as `{}` doesn't render literal
// "[object Object]" (caught by @typescript-eslint/no-base-to-string).
const esc = (raw: unknown): string => {
  let str: string;
  if (raw === null || raw === undefined) {
    str = '';
  } else if (typeof raw === 'object') {
    str = JSON.stringify(raw);
  } else if (typeof raw === 'string') {
    str = raw;
  } else if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint') {
    str = String(raw);
  } else {
    str = '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Render the export bundle to a print-ready HTML document. Inline CSS only —
// puppeteer's setContent({ waitUntil: 'load' }) has no network fetcher for
// our pipeline, so external stylesheets / fonts won't load.
const bundleToHtml = (bundle: Record<string, unknown>, targetUserId: string): string => {
  const subject = (bundle.subject as Record<string, unknown>) || {};
  const roles = (bundle.roles as Array<Record<string, unknown>>) || [];
  const consents = (bundle.consents as Array<Record<string, unknown>>) || [];
  const assignments = (bundle.assignments as Record<string, Array<Record<string, unknown>>>) || {};
  const commissions = (bundle.commissions as Record<string, Array<Record<string, unknown>>>) || {};
  const devices = (bundle.devices as Array<Record<string, unknown>>) || [];

  const kv = (label: string, value: unknown): string =>
    `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`;

  const rowsTable = (headers: string[], rows: Array<Record<string, unknown>>): string => {
    if (rows.length === 0) {
      return `<p class="empty">No records.</p>`;
    }
    return `<table class="data"><thead><tr>${headers
      .map(h => `<th>${esc(h)}</th>`)
      .join('')}</tr></thead><tbody>${rows
      .map(r => `<tr>${headers.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>DPDP §11 Data Export — ${esc(subject.name)}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1f2937; margin: 0; line-height: 1.45; }
    h1 { font-size: 18pt; margin: 0 0 4pt 0; color: #047857; }
    h2 { font-size: 13pt; margin: 14pt 0 6pt 0; padding-bottom: 3pt; border-bottom: 1.5pt solid #047857; color: #064e3b; }
    .header { border-bottom: 2pt solid #047857; padding-bottom: 8pt; margin-bottom: 12pt; }
    .meta { font-size: 9pt; color: #6b7280; margin-top: 4pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; font-size: 9.5pt; }
    table.kv th { text-align: left; width: 38%; padding: 4pt 6pt; background: #f3f4f6; border: 0.5pt solid #d1d5db; font-weight: 600; }
    table.kv td { padding: 4pt 6pt; border: 0.5pt solid #d1d5db; word-break: break-word; }
    table.data th { background: #047857; color: #ffffff; text-align: left; padding: 4pt 6pt; font-size: 8.5pt; font-weight: 600; }
    table.data td { padding: 3pt 6pt; border-bottom: 0.5pt solid #e5e7eb; word-break: break-word; vertical-align: top; font-size: 8.5pt; }
    .empty { color: #9ca3af; font-style: italic; font-size: 9pt; margin: 4pt 0 8pt 0; }
    .pre { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 8pt; background: #f9fafb; padding: 6pt; border-left: 2pt solid #047857; white-space: pre-wrap; word-break: break-word; }
    .footer { margin-top: 18pt; padding-top: 6pt; border-top: 0.5pt solid #d1d5db; font-size: 8pt; color: #6b7280; }
    .pill { display: inline-block; padding: 1pt 6pt; border-radius: 8pt; background: #d1fae5; color: #047857; font-size: 8pt; font-weight: 600; margin-right: 4pt; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Personal Data Export</h1>
    <div class="meta">
      <strong>${esc(subject.name)}</strong>
      &nbsp;·&nbsp; ${esc(subject.username)}
      &nbsp;·&nbsp; ID ${esc(targetUserId)}
    </div>
    <div class="meta">
      ${esc(bundle.dpdpSection)} &nbsp;·&nbsp;
      Generated ${esc(bundle.exportedAt)} &nbsp;·&nbsp;
      Requested by ${esc(bundle.exportedBy)}
    </div>
  </div>

  <h2>1. Identity &amp; profile</h2>
  <table class="kv">
    ${kv('Full name', subject.name)}
    ${kv('Username', subject.username)}
    ${kv('Employee ID', subject.employee_id)}
    ${kv('Email', subject.email)}
    ${kv('Phone', subject.phone)}
    ${kv('Active', subject.is_active)}
    ${kv('Last login', subject.last_login)}
    ${kv('Created at', subject.created_at)}
    ${kv('Updated at', subject.updated_at)}
    ${kv('Profile photo URL', subject.profile_photo_url)}
    ${kv('Department ID', subject.department_id)}
    ${kv('Designation ID', subject.designation_id)}
    ${kv('Team leader ID', subject.team_leader_id)}
    ${kv('Manager ID', subject.manager_id)}
  </table>

  <h2>2. Roles</h2>
  ${rowsTable(['id', 'name', 'description', 'assigned_at'], roles)}

  <h2>3. Policy acceptances (consents)</h2>
  ${rowsTable(['policy_version', 'accepted_at', 'source', 'ip_address', 'user_agent'], consents)}

  <h2>4. Scope assignments</h2>
  <h3 style="font-size:10pt;margin:6pt 0 4pt 0;">Clients</h3>
  ${rowsTable(['client_id', 'created_at'], assignments.clients || [])}
  <h3 style="font-size:10pt;margin:6pt 0 4pt 0;">Products</h3>
  ${rowsTable(['product_id', 'created_at'], assignments.products || [])}
  <h3 style="font-size:10pt;margin:6pt 0 4pt 0;">Pincodes</h3>
  ${rowsTable(['pincode_id', 'created_at'], assignments.pincodes || [])}
  <h3 style="font-size:10pt;margin:6pt 0 4pt 0;">Areas</h3>
  ${rowsTable(['pincode_id', 'user_pincode_assignment_id', 'created_at'], assignments.areas || [])}

  <h2>5. Commissions</h2>
  <h3 style="font-size:10pt;margin:6pt 0 4pt 0;">Rate assignments</h3>
  ${rowsTable(['client_id', 'rate_type_id', 'created_at'], commissions.assignments || [])}
  <h3 style="font-size:10pt;margin:6pt 0 4pt 0;">Earned</h3>
  ${rowsTable(
    [
      'case_id',
      'client_id',
      'base_amount',
      'commission_amount',
      'status',
      'case_completed_at',
      'paid_at',
    ],
    commissions.earned || []
  )}

  <h2>6. Devices</h2>
  ${rowsTable(['device_id', 'platform', 'app_version', 'sync_count', 'last_sync_at'], devices)}

  <h2>7. Notification preferences</h2>
  <div class="pre">${esc(JSON.stringify(bundle.notificationPreferences ?? null, null, 2))}</div>

  <h2>8. Cross-references</h2>
  <p>${esc(bundle.auditLogReference)}</p>

  <h2>9. Fields excluded from this export</h2>
  <p class="meta">${esc((bundle.excludedFields as { reason?: string })?.reason)}</p>

  <div class="footer">
    <span class="pill">DPDP §11</span>
    Generated by All Check Services CRM &nbsp;·&nbsp;
    Document ID: ${esc(targetUserId)}-${esc(bundle.exportedAt)}
  </div>
</body>
</html>`;
};

// Render HTML → PDF via the shared, pooled reportTemplateRenderer browser
// (singleton + connected-check/relaunch + concurrency slot) instead of
// launching a fresh Chromium per call. A per-request puppeteer.launch() costs
// ~300-800ms + significant memory and, under a few concurrent self-service
// exports, could exhaust memory. renderHtmlToPdfBuffer skips Handlebars
// compilation so the export markup / user data is rendered verbatim.
const htmlToPdf = (html: string): Promise<Buffer> =>
  reportTemplateRenderer.renderHtmlToPdfBuffer(html, {
    marginTop: '16mm',
    marginRight: '14mm',
    marginBottom: '16mm',
    marginLeft: '14mm',
  });

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

    // 2. Roles — user_roles uses assigned_at (not created_at) per schema.
    const rolesRes = await query(
      `SELECT rv.id, rv.name, rv.description, ur.assigned_at
         FROM user_roles ur
         JOIN roles_v2 rv ON rv.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY ur.assigned_at DESC`,
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

    // 2026-05-17: format changed from JSON to PDF per user request. The
    // bundle assembly above is unchanged — it's still the authoritative
    // data source — but the response now renders it through puppeteer
    // into a print-ready A4 document so the data principal receives a
    // single signed-looking artifact (better DPDP §11 UX).
    const html = bundleToHtml(bundle, targetUserId);
    const pdfBuffer = await htmlToPdf(html);
    const filename = `user-${targetUserId}-data-export-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(pdfBuffer);
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
