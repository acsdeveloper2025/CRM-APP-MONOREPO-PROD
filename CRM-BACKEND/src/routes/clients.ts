import express from 'express';
import multer from 'multer';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { addClientFiltering, validateClientAccess } from '@/middleware/clientAccess';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientProducts,
  getClientVerificationTypes,
  getVerificationTypesForClientProduct,
  getDocumentTypesForClientProduct,
  uploadClientLogo,
  uploadClientStamp,
  deleteClientLogo,
  deleteClientStamp,
} from '@/controllers/clientsController';

// Dedicated uploader for branding assets. Memory storage is fine because the
// controller writes the file to disk itself (allows us to tee the bytes to
// whatever storage backend we add later without a second read).
const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB: plenty for logos / stamps
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/webp' ||
      file.mimetype === 'image/svg+xml';
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image type (PNG, JPEG, WEBP, SVG only)'));
    }
  },
});

const router = express.Router();

router.use(authenticateToken);
// Validation rules
const createClientValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Client name must be between 1 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Client code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Client code must contain only uppercase letters, numbers, and underscores'),
  body('productIds').optional().isArray().withMessage('productIds must be an array of IDs'),
  body('productIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each productId must be a positive integer'),
  body('verificationTypeIds')
    .optional()
    .isArray()
    .withMessage('verificationTypeIds must be an array of IDs'),
  body('verificationTypeIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each verificationTypeId must be a positive integer'),
  body('documentTypeIds')
    .optional()
    .isArray()
    .withMessage('documentTypeIds must be an array of IDs'),
  body('documentTypeIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each documentTypeId must be a positive integer'),
];

const updateClientValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Client name must be between 1 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Client code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Client code must contain only uppercase letters, numbers, and underscores'),
  body('productIds').optional().isArray().withMessage('productIds must be an array of IDs'),
  body('productIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each productId must be a positive integer'),
  body('verificationTypeIds')
    .optional()
    .isArray()
    .withMessage('verificationTypeIds must be an array of IDs'),
  body('verificationTypeIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each verificationTypeId must be a positive integer'),
  body('documentTypeIds')
    .optional()
    .isArray()
    .withMessage('documentTypeIds must be an array of IDs'),
  body('documentTypeIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each documentTypeId must be a positive integer'),
];

// GET /api/clients - Get all clients (CACHED)
router.get(
  '/',
  authenticateToken,
  EnterpriseCache.create(EnterpriseCacheConfigs.clientList),
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500'),
    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search term too long'),
  ]),
  addClientFiltering,
  getClients
);

// GET /api/clients/:id - Get client by ID (CACHED)
router.get(
  '/:id',
  authenticateToken,
  EnterpriseCache.create(EnterpriseCacheConfigs.clientList),
  validate([param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer')]),
  validateClientAccess(),
  getClientById
);

// GET /api/clients/:id/verification-types - Get verification types by client (CACHED)
router.get(
  '/:id/verification-types',
  authenticateToken,
  EnterpriseCache.create(EnterpriseCacheConfigs.verificationTypes),
  validate([
    param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ]),
  validateClientAccess(),
  getClientVerificationTypes
);

// POST /api/clients - Create new client (INVALIDATES CACHE)
router.post(
  '/',
  authorize('settings.manage'),
  authenticateToken,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientUpdate),
  validate(createClientValidation),
  createClient
);

// PUT /api/clients/:id - Update client (INVALIDATES CACHE)
router.put(
  '/:id',
  authorize('settings.manage'),
  authenticateToken,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientUpdate),
  validate([
    param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
    ...updateClientValidation,
  ]),
  updateClient
);

// DELETE /api/clients/:id - Delete client (INVALIDATES CACHE)
router.delete(
  '/:id',
  authorize('settings.manage'),
  authenticateToken,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientUpdate),
  validate([param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer')]),
  deleteClient
);

// GET /api/clients/:id/products - Get products by client
router.get(
  '/:id/products',
  authenticateToken,
  validate([
    param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ]),
  validateClientAccess(),
  getClientProducts
);

// GET /api/clients/:clientId/products/:productId/verification-types
router.get(
  '/:clientId/products/:productId/verification-types',
  authenticateToken,
  validate([param('clientId').isInt({ min: 1 }), param('productId').isInt({ min: 1 })]),
  getVerificationTypesForClientProduct
);

// GET /api/clients/:clientId/products/:productId/document-types
router.get(
  '/:clientId/products/:productId/document-types',
  authenticateToken,
  validate([param('clientId').isInt({ min: 1 }), param('productId').isInt({ min: 1 })]),
  getDocumentTypesForClientProduct
);

// -----------------------------------------------------------------------
// Branding asset routes (logo + stamp). Uploads are multipart/form-data;
// DELETE clears the column and removes the file on disk.
// -----------------------------------------------------------------------

const brandingParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
];

router.post(
  '/:id/logo',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientUpdate),
  brandingUpload.single('file'),
  validate(brandingParamValidation),
  uploadClientLogo
);

router.delete(
  '/:id/logo',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientUpdate),
  validate(brandingParamValidation),
  deleteClientLogo
);

router.post(
  '/:id/stamp',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientUpdate),
  brandingUpload.single('file'),
  validate(brandingParamValidation),
  uploadClientStamp
);

router.delete(
  '/:id/stamp',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientUpdate),
  validate(brandingParamValidation),
  deleteClientStamp
);

export default router;
