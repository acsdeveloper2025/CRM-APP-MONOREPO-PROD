import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';
import {
  getVerificationTypes,
  getVerificationTypeById,
  createVerificationType,
  updateVerificationType,
  deleteVerificationType,
  getVerificationTypeStats,
  exportVerificationTypes,
} from '@/controllers/verificationTypesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);
// Validation schemas
const createVerificationTypeValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Code must contain only uppercase letters, numbers, and underscores'),
];

const updateVerificationTypeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Code must contain only uppercase letters, numbers, and underscores'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const listVerificationTypesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('category')
    .optional()
    .isIn([
      'ADDRESS_VERIFICATION',
      'EMPLOYMENT_VERIFICATION',
      'BUSINESS_VERIFICATION',
      'IDENTITY_VERIFICATION',
      'FINANCIAL_VERIFICATION',
      'OTHER',
    ])
    .withMessage('Invalid category'),
  query('isActive')
    .optional()
    .custom(v => v === 'true' || v === 'false' || v === 'all' || typeof v === 'boolean')
    .withMessage("isActive must be 'true', 'false', or 'all'"),
  query('createdFrom').optional().isISO8601().withMessage('createdFrom must be ISO 8601'),
  query('createdTo').optional().isISO8601().withMessage('createdTo must be ISO 8601'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'category', 'basePrice', 'estimatedTime', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

// Core CRUD routes (CACHED)
router.get(
  '/',
  EnterpriseCache.create(EnterpriseCacheConfigs.verificationTypes),
  listVerificationTypesValidation,
  handleValidationErrors,
  getVerificationTypes
);

router.get(
  '/stats',
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getVerificationTypeStats
);

// GET /api/verification-types/export - xlsx download mirroring list filters.
// NOT cached. MUST stay above /:id so Express route-matching catches /export first.
router.get(
  '/export',
  listVerificationTypesValidation,
  handleValidationErrors,
  exportVerificationTypes
);

router.post(
  '/',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.verificationTypeUpdate),
  createVerificationTypeValidation,
  handleValidationErrors,
  createVerificationType
);

router.get(
  '/:id',
  EnterpriseCache.create(EnterpriseCacheConfigs.verificationTypes),
  [param('id').isInt({ min: 1 }).withMessage('Verification type ID must be a positive integer')],
  handleValidationErrors,
  getVerificationTypeById
);

router.put(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.verificationTypeUpdate),
  [param('id').isInt({ min: 1 }).withMessage('Verification type ID must be a positive integer')],
  updateVerificationTypeValidation,
  handleValidationErrors,
  updateVerificationType
);

router.delete(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.verificationTypeUpdate),
  [param('id').isInt({ min: 1 }).withMessage('Verification type ID must be a positive integer')],
  handleValidationErrors,
  deleteVerificationType
);

export default router;
