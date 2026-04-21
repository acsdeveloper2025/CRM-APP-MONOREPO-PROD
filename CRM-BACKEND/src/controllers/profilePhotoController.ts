// Profile-photo upload / delete handlers.
//
// Design decisions (set 2026-04-21, user-approved):
//  - Mobile field agent can set their OWN photo via POST /api/mobile/users/me/photo.
//  - Admin can set ANYONE's photo via POST /api/users/:userId/profile-photo (user.update).
//  - Admin can DELETE anyone's photo via DELETE /api/users/:userId/profile-photo.
//  - Last-write-wins: any successful write replaces the stored URL.
//  - File layout: `uploads/profile-photos/<userId>.jpg` (flat, overwrite-on-update).
//    Cache-busting via `?v=<timestampMs>` in the stored URL. Single file per
//    user keeps storage bounded and makes deletion trivial.
//  - Input: JPEG / PNG / WEBP up to 2 MB. Output: always JPEG 512×512 @ q85
//    regardless of input. `sharp` normalizes so admin / web uploads that
//    skip the mobile pre-resize still land at the same size.

import type { Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { query } from '@/config/database';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';

const PROFILE_PHOTO_DIR = path.join(process.cwd(), 'uploads', 'profile-photos');
const TARGET_WIDTH = 512;
const TARGET_HEIGHT = 512;
const JPEG_QUALITY = 85;

async function ensureDir(): Promise<void> {
  await fs.mkdir(PROFILE_PHOTO_DIR, { recursive: true });
}

function buildRelativeUrl(userId: string): string {
  // Cache-busting querystring so browsers refetch on update. Express
  // static serving ignores the querystring.
  return `/uploads/profile-photos/${userId}.jpg?v=${Date.now()}`;
}

async function normalizeAndSave(buffer: Buffer, userId: string): Promise<string> {
  await ensureDir();
  const outputPath = path.join(PROFILE_PHOTO_DIR, `${userId}.jpg`);
  await sharp(buffer)
    .rotate() // honour EXIF orientation
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outputPath);
  return outputPath;
}

async function writePhotoForUser(userId: string, buffer: Buffer): Promise<string> {
  await normalizeAndSave(buffer, userId);
  const url = buildRelativeUrl(userId);
  await query(`UPDATE users SET profile_photo_url = $1 WHERE id = $2`, [url, userId]);
  return url;
}

export class ProfilePhotoController {
  // Mobile self-update: authenticated user changes their own photo.
  static async uploadForSelf(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED', timestamp: new Date().toISOString() },
        });
      }
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'photo field is required',
          error: {
            code: 'MISSING_FILE',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const profilePhotoUrl = await writePhotoForUser(userId, req.file.buffer);

      return res.json({
        success: true,
        message: 'Profile photo updated',
        data: { profilePhotoUrl },
      });
    } catch (err) {
      logger.error('Profile photo upload (self) failed', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile photo',
        error: {
          code: 'UPLOAD_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Admin-side: set photo for a specific user.
  static async uploadForUser(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const targetUserId = String(req.params.userId || '').trim();
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required',
          error: {
            code: 'MISSING_USER_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'photo field is required',
          error: {
            code: 'MISSING_FILE',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const userCheck = await query<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [
        targetUserId,
      ]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: {
            code: 'USER_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const profilePhotoUrl = await writePhotoForUser(targetUserId, req.file.buffer);

      return res.json({
        success: true,
        message: 'Profile photo updated',
        data: { profilePhotoUrl },
      });
    } catch (err) {
      logger.error('Profile photo upload (admin) failed', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile photo',
        error: {
          code: 'UPLOAD_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Admin-side: delete a user's photo. Mobile has no delete (user
  // decision 2026-04-21 Q4=B; replace-only).
  static async deleteForUser(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const targetUserId = String(req.params.userId || '').trim();
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required',
          error: {
            code: 'MISSING_USER_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const outputPath = path.join(PROFILE_PHOTO_DIR, `${targetUserId}.jpg`);
      try {
        await fs.unlink(outputPath);
      } catch (unlinkErr) {
        // File may already be absent — not fatal.
        logger.warn(`Profile photo file unlink skipped for user ${targetUserId}`, unlinkErr);
      }

      await query(`UPDATE users SET profile_photo_url = NULL WHERE id = $1`, [targetUserId]);

      return res.json({
        success: true,
        message: 'Profile photo removed',
      });
    } catch (err) {
      logger.error('Profile photo delete failed', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove profile photo',
        error: {
          code: 'DELETE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
