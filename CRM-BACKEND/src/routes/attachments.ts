import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken, requireFieldOrHigher } from '@/middleware/auth';
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
  bulkDeleteAttachments
} from '@/controllers/attachmentsController';

const router = express.Router();

// Apply authentication and rate limiting
router.use(authenticateToken);
router.use(requireFieldOrHigher);
router.use(uploadRateLimit);

// Validation schemas
const caseAttachmentsValidation = [
  param('caseId')
    .trim()
    .notEmpty()
    .withMessage('Case ID is required'),
  query('category')
    .optional()
    .isIn(['PHOTO', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER'])
    .withMessage('Category must be one of: PHOTO, DOCUMENT, VIDEO, AUDIO, OTHER'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const updateAttachmentValidation = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Attachment ID is required'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('category')
    .optional()
    .isIn(['PHOTO', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER'])
    .withMessage('Category must be one of: PHOTO, DOCUMENT, VIDEO, AUDIO, OTHER'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
];

const bulkDeleteValidation = [
  body('attachmentIds')
    .isArray({ min: 1 })
    .withMessage('Attachment IDs array is required'),
  body('attachmentIds.*')
    .isString()
    .withMessage('Each attachment ID must be a string'),
];

// File upload routes
router.post('/upload', uploadAttachment);

router.post('/bulk-upload', bulkUploadAttachments);

// File retrieval routes
router.get('/case/:caseId',
  caseAttachmentsValidation,
  validate,
  getAttachmentsByCase
);

router.get('/types', getSupportedFileTypes);

router.get('/:id',
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  getAttachmentById
);

// File download route
router.post('/:id/download',
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  downloadAttachment
);

// File serve route for preview (GET)
router.get('/:id/serve',
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  serveAttachment
);

// File management routes
router.put('/:id',
  updateAttachmentValidation,
  validate,
  updateAttachment
);

router.delete('/:id',
  [param('id').trim().notEmpty().withMessage('Attachment ID is required')],
  validate,
  deleteAttachment
);

router.post('/bulk-delete',
  bulkDeleteValidation,
  validate,
  bulkDeleteAttachments
);

export default router;
