// Profile-photo multipart upload middleware.
//
// Separate from the general `upload.ts` (CSV-only) and from the mobile
// attachments controller's multer (verification photos). Single file,
// in-memory buffer so the controller can normalize via `sharp` before
// persisting to disk.

import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// 2 MB ceiling on input. Mobile pre-resizes to 512×512 so the payload
// should sit at ~50-100 KB in practice; the ceiling catches abuse.
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Only JPEG, PNG, or WEBP images are allowed (got ${file.mimetype})`));
  }
};

export const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_BYTES,
    files: 1,
  },
});
