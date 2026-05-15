import express from 'express';
import { query, param } from 'express-validator';
import { authenticateToken, authenticateTokenFlexible } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { GeocodeController } from '@/controllers/geocodeController';
import { validate } from '@/middleware/validation';
import { uploadRateLimit } from '@/middleware/rateLimiter';
import {
  uploadAttachment,
  getAttachmentsByCase,
  getAttachmentById,
  deleteAttachment,
  downloadAttachment,
  serveAttachment,
  getSupportedFileTypes,
} from '@/controllers/attachmentsController';

const router = express.Router();

// Validation schemas
const caseAttachmentsValidation = [
  param('caseId').trim().notEmpty().withMessage('Case ID is required'),
  query('category')
    .optional()
    .isIn(['PHOTO', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER'])
    .withMessage('Category must be one of: PHOTO, DOCUMENT, VIDEO, AUDIO, OTHER'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
];

// P15.D-9/10/11: validators for bulkUpload / updateAttachment / bulkDelete
// removed alongside their controllers. The dead handlers wrote to a
// module-local `attachments[]` array and never touched the DB — the FE
// "successful" response masked silent no-ops. If real bulk operations
// are needed later, they should be implemented against the DB with
// proper scope checks (see uploadAttachment + deleteAttachment as the
// canonical single-row patterns).

// File upload routes
router.post(
  '/upload',
  authenticateToken,
  authorize('case.update'),
  uploadRateLimit,
  uploadAttachment
);

// P15.D-9: POST /bulk-upload route + bulkUploadAttachments handler
// removed (handler was in-memory-only — wrote to a JS array, never
// persisted to DB; FE thought uploads succeeded).

// File retrieval routes
router.get(
  '/case/:caseId',
  authenticateToken,
  authorize('case.view'),
  caseAttachmentsValidation,
  validate,
  getAttachmentsByCase
);

router.get('/types', authenticateToken, authorize('case.view'), getSupportedFileTypes);

router.get(
  '/:id',
  authenticateToken,
  authorize('case.view'),
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  getAttachmentById
);

// Attachment-anchored reverse geocode. Address is resolved once via
// Google + stored on the row (reverse_geocoded_address), frozen for
// verification integrity (user directive 2026-04-21).
router.get(
  '/:attachmentId/address',
  authenticateToken,
  authorize('case.view'),
  [param('attachmentId').isInt({ gt: 0 }).withMessage('Attachment id must be a positive integer')],
  validate,
  GeocodeController.attachmentAddress
);

// File download route
router.post(
  '/:id/download',
  authenticateToken,
  authorize('case.view'),
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  downloadAttachment
);

// File serve route for preview (GET) - uses flexible auth for image tags
router.get(
  '/:id/serve',
  authenticateTokenFlexible,
  authorize('case.view'),
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  serveAttachment
);

// File management routes
// P15.D-10: PUT /:id (updateAttachment) removed — handler was an
// in-memory-only stub that never touched the DB.

router.delete(
  '/:id',
  authenticateToken,
  authorize('case.update'),
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  deleteAttachment
);

// P15.D-11: POST /bulk-delete (bulkDeleteAttachments) removed — same
// in-memory-only pattern as the other dead handlers.

export default router;
