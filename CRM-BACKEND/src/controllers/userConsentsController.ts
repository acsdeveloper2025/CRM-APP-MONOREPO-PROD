// User consent records — Field Executive Acknowledgement (DPDP §5 +
// internal compliance audit trail).
//
// Two surfaces:
//   1. Mobile: POST /api/mobile/consents/accept (called from
//      PrivacyConsentScreen after the agent taps "I Accept"). One row
//      per (userId, policyVersion) — re-acceptances are idempotent.
//   2. Admin: GET /api/users/:id/consents (latest + history). Surfaced
//      in the FE user-detail page so an admin can confirm acceptance
//      status during a dispute / audit / compliance review.
//
// 2026-05-13.

import type { Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { createAuditLog } from '@/utils/auditLogger';
import { errorMessage } from '@/utils/errorMessage';

interface UserConsentRow {
  id: string;
  userId: string;
  policyVersion: number;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  source: 'MOBILE' | 'WEB';
}

const normalizeIp = (raw: string | undefined): string | null => {
  if (!raw) {
    return null;
  }
  // Strip IPv4-mapped IPv6 prefix (Express's req.ip frequently returns
  // ::ffff:1.2.3.4 even on plain IPv4 connections — Postgres `inet`
  // accepts both, but the bare form is cleaner for audit display.
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
};

/**
 * Mobile-facing: record the agent's acceptance of a specific policy
 * version. Idempotent — the UNIQUE (user_id, policy_version) constraint
 * dedupes re-acceptance from re-installs / new devices. Re-acceptance
 * after a version bump produces a new row (different policy_version).
 *
 * Returns 200 with the row id + accepted_at. Never blocks the user —
 * if BE-side write fails, the mobile already has local-KV acceptance
 * gating the UI; we just lose the BE audit row for this attempt.
 */
export const acceptConsent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthenticated',
        error: { code: 'UNAUTHENTICATED' },
      });
      return;
    }

    const policyVersion = Number(req.body?.policyVersion);
    if (!Number.isFinite(policyVersion) || policyVersion <= 0) {
      res.status(400).json({
        success: false,
        message: 'policyVersion is required and must be a positive integer',
        error: { code: 'INVALID_POLICY_VERSION' },
      });
      return;
    }

    const ipAddress = normalizeIp(req.ip);
    const userAgent = req.get('User-Agent') || null;
    const source = (typeof req.body?.source === 'string' ? req.body.source : 'MOBILE') as
      | 'MOBILE'
      | 'WEB';

    const result = await query<UserConsentRow>(
      `INSERT INTO user_consents (user_id, policy_version, ip_address, user_agent, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, policy_version)
         DO UPDATE SET
           accepted_at = EXCLUDED.accepted_at,
           ip_address  = EXCLUDED.ip_address,
           user_agent  = EXCLUDED.user_agent,
           source      = EXCLUDED.source
         RETURNING id, accepted_at AS "acceptedAt"`,
      [userId, policyVersion, ipAddress, userAgent, source]
    );
    const row = result.rows[0];

    void createAuditLog({
      action: 'USER_CONSENT_ACCEPTED',
      entityType: 'USER_CONSENT',
      entityId: String(row.id),
      userId,
      details: { policyVersion, source, ipAddress },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    logger.info('User consent recorded', {
      userId,
      policyVersion,
      source,
      consentId: row.id,
    });

    res.json({
      success: true,
      message: 'Consent recorded',
      data: {
        id: String(row.id),
        policyVersion,
        acceptedAt: row.acceptedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to record user consent', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record consent',
      error: {
        code: 'CONSENT_RECORD_FAILED',
        details: errorMessage(error),
      },
    });
  }
};

/**
 * Admin-facing: list a single user's full consent history (one row per
 * policy version they've accepted, newest first). Used by the FE user-
 * detail page's Consent section + audit/compliance flows.
 */
export const getUserConsents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const targetUserId =
      typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '');
    if (!targetUserId) {
      res.status(400).json({
        success: false,
        message: 'User id is required',
        error: { code: 'MISSING_USER_ID' },
      });
      return;
    }

    const result = await query<UserConsentRow>(
      `SELECT
         id::text AS id,
         user_id AS "userId",
         policy_version AS "policyVersion",
         accepted_at AS "acceptedAt",
         host(ip_address) AS "ipAddress",
         user_agent AS "userAgent",
         source
       FROM user_consents
       WHERE user_id = $1
       ORDER BY accepted_at DESC`,
      [targetUserId]
    );

    res.json({
      success: true,
      message: 'Consent history retrieved',
      data: result.rows,
    });
  } catch (error) {
    logger.error('Failed to fetch user consents', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consent history',
      error: {
        code: 'CONSENT_FETCH_FAILED',
        details: errorMessage(error),
      },
    });
  }
};
