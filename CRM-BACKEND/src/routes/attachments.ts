import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken, authenticateTokenFlexible } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { uploadRateLimit } from '@/middleware/rateLimiter';
import {
  uploadAttachment,
  getAttachmentsByCase,
  getAttachmentById,
  deleteAttachment,
  updateAttachment,
  downloadAttachment,
  serveAttachment,
  getSupportedFileTypes,
  bulkUploadAttachments,
  bulkDeleteAttachments,
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

const updateAttachmentValidation = [
  param('id').trim().notEmpty().withMessage('Attachment ID is required'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('category')
    .optional()
    .isIn(['PHOTO', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER'])
    .withMessage('Category must be one of: PHOTO, DOCUMENT, VIDEO, AUDIO, OTHER'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
];

const bulkDeleteValidation = [
  body('attachmentIds').isArray({ min: 1 }).withMessage('Attachment IDs array is required'),
  body('attachmentIds.*').isString().withMessage('Each attachment ID must be a string'),
];

// File upload routes
router.post(
  '/upload',
  authenticateToken,
  authorize('case.update'),
  uploadRateLimit,
  uploadAttachment
);

router.post(
  '/bulk-upload',
  authenticateToken,
  authorize('case.update'),
  uploadRateLimit,
  bulkUploadAttachments
);

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
router.put(
  '/:id',
  authenticateToken,
  authorize('case.update'),
  updateAttachmentValidation,
  validate,
  updateAttachment
);

router.delete(
  '/:id',
  authenticateToken,
  authorize('case.update'),
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  deleteAttachment
);

router.post(
  '/bulk-delete',
  authenticateToken,
  authorize('case.update'),
  bulkDeleteValidation,
  validate,
  bulkDeleteAttachments
);

export default router;
