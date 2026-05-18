// Self-service profile update endpoint (D2 — audit 2026-05-18).
//
// Route: PATCH /api/users/me/profile
//
// A signed-in user can update a tightly-whitelisted subset of their OWN
// profile fields. Today exposes ONLY `email` and `phone` — the two
// contact fields that change in real life. Name / employeeId / role /
// dept / designation remain admin-managed; password has its own flow.
//
// Authorization: req.user.id — no perm required (least-privilege).

import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { errorMessage } from '@/utils/errorMessage';
import { createAuditLog } from '@/utils/auditLogger';

const PHONE_E164_REGEX = /^\+?[1-9]\d{1,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SelfProfilePatch = {
  // null = clear field; undefined = no change
  email?: string | null;
  phone?: string | null;
};

const parsePatch = (
  body: unknown
): { ok: true; patch: SelfProfilePatch } | { ok: false; code: string; message: string } => {
  const raw = (body ?? {}) as Record<string, unknown>;
  const patch: SelfProfilePatch = {};

  // Email — optional. '' / null → clear; otherwise must look like an email.
  if ('email' in raw) {
    const v = raw.email;
    if (v === null || v === '' || v === undefined) {
      patch.email = null;
    } else if (typeof v !== 'string') {
      return { ok: false, code: 'INVALID_EMAIL_TYPE', message: 'email must be a string' };
    } else {
      const trimmed = v.trim().toLowerCase();
      if (trimmed === '') {
        patch.email = null;
      } else if (!EMAIL_REGEX.test(trimmed) || trimmed.length > 100) {
        return {
          ok: false,
          code: 'INVALID_EMAIL',
          message: 'Email must be a valid address (max 100 chars)',
        };
      } else {
        patch.email = trimmed;
      }
    }
  }

  // Phone — optional. '' / null → clear; otherwise strict E.164.
  if ('phone' in raw) {
    const v = raw.phone;
    if (v === null || v === '' || v === undefined) {
      patch.phone = null;
    } else if (typeof v !== 'string') {
      return { ok: false, code: 'INVALID_PHONE_TYPE', message: 'phone must be a string' };
    } else {
      const trimmed = v.trim();
      if (trimmed === '') {
        patch.phone = null;
      } else if (!PHONE_E164_REGEX.test(trimmed)) {
        return {
          ok: false,
          code: 'INVALID_PHONE',
          message: 'Phone must be valid E.164 (e.g. +919876543210)',
        };
      } else {
        patch.phone = trimmed;
      }
    }
  }

  return { ok: true, patch };
};

export const updateMyProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Unauthenticated',
      error: { code: 'UNAUTHENTICATED' },
    });
    return;
  }

  const parsed = parsePatch(req.body);
  if (!parsed.ok) {
    res.status(400).json({
      success: false,
      message: parsed.message,
      error: { code: parsed.code },
    });
    return;
  }
  const patch = parsed.patch;

  // Nothing to do — friendly 200 with current values rather than 400.
  if (!('email' in patch) && !('phone' in patch)) {
    const current = await query<{ email: string | null; phone: string | null }>(
      'SELECT email, phone FROM users WHERE id = $1',
      [userId]
    );
    res.json({
      success: true,
      message: 'No changes',
      data: current.rows[0] ?? { email: null, phone: null },
    });
    return;
  }

  // Email uniqueness check — mirrors usersController.updateUser pattern.
  // Skip when clearing (email = null) or when no email field was sent.
  if (patch.email && patch.email !== null) {
    const dup = await query<{ id: string }>(
      'SELECT id FROM users WHERE lower(email) = $1 AND id <> $2 LIMIT 1',
      [patch.email, userId]
    );
    if (dup.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Email already in use by another account',
        error: { code: 'EMAIL_TAKEN' },
      });
      return;
    }
  }

  try {
    // Dynamic SET clause — only update fields the caller actually sent.
    const setParts: string[] = [];
    const params: unknown[] = [];
    if ('email' in patch) {
      params.push(patch.email);
      setParts.push(`email = $${params.length}`);
    }
    if ('phone' in patch) {
      params.push(patch.phone);
      setParts.push(`phone = $${params.length}`);
    }
    setParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);
    const updateSql = `
      UPDATE users
         SET ${setParts.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, email, phone
    `;
    const result = await query<{ id: string; email: string | null; phone: string | null }>(
      updateSql,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' },
      });
      return;
    }

    const updated = result.rows[0];

    void createAuditLog({
      action: 'USER_SELF_PROFILE_UPDATE',
      entityType: 'USER',
      entityId: userId,
      userId,
      details: {
        fields: Object.keys(patch),
        emailSet: 'email' in patch ? patch.email !== null : undefined,
        phoneSet: 'phone' in patch ? patch.phone !== null : undefined,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    logger.info('User updated own profile', { userId, fields: Object.keys(patch) });

    res.json({
      success: true,
      message: 'Profile updated',
      data: { email: updated.email, phone: updated.phone },
    });
  } catch (err) {
    logger.error('updateMyProfile failed', { userId, error: errorMessage(err) });
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: { code: 'SELF_PROFILE_UPDATE_FAILED' },
    });
  }
};
