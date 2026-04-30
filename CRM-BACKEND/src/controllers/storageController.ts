/**
 * Auth-gated storage streaming controller.
 *
 * Routes:
 *   GET /api/storage/:key+
 *
 * Replaces unauthenticated `app.use('/uploads', express.static(...))` for
 * client-facing reads. Closes audit F-B1.1 (DPDP exposure of attachments,
 * verification photos, KYC docs via direct URL).
 *
 * For LocalFsStorage backend, this is the actual byte source.
 * For S3Storage backend, callers should prefer `getSignedUrl(key)` instead
 * — the signed URL goes directly to S3 without proxying bytes through Node.
 *
 * Authorization: any authenticated user can read keys IF they would have
 * access to the underlying entity. Authorization is delegated to the entity-
 * level controllers (e.g., attachmentsController.serveAttachment) which look
 * up the row, run scope checks, then call `storage.get(key)`.
 *
 * This generic /api/storage/:key endpoint is for cases where the caller has
 * already passed entity-scoped auth (e.g., via signed-URL redirect chain).
 * It restricts to authenticated requests as a baseline; entity-scoped reads
 * MUST go through the relevant controller, not this one.
 */

import type { Response } from 'express';
import { storage } from '@/services/storage';
import { logger } from '@/utils/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';

export const streamStorageObject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  // Reconstruct key from wildcard param (req.params[0] holds everything after /api/storage/)
  const key = (req.params[0] || '').trim();
  if (!key) {
    res.status(400).json({
      success: false,
      message: 'Storage key is required',
      error: { code: 'STORAGE_KEY_MISSING' },
    });
    return;
  }

  try {
    const exists = await storage.exists(key);
    if (!exists) {
      res.status(404).json({
        success: false,
        message: 'Object not found',
        error: { code: 'STORAGE_OBJECT_NOT_FOUND' },
      });
      return;
    }

    const obj = await storage.get(key);
    res.setHeader('Content-Type', obj.mimeType);
    res.setHeader('Content-Length', String(obj.size));
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 min auth-gated cache
    obj.stream.pipe(res);
  } catch (error) {
    logger.error('Storage stream failed', { key, error: String(error) });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to stream storage object',
        error: { code: 'STORAGE_STREAM_FAILED' },
      });
    }
  }
};
