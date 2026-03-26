import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import { addProductFiltering, validateProductAccess } from '@/middleware/productAccess';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductVerificationTypes,
} from '@/controllers/productsController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);
// Validation schemas
const createProductValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Product name must be between 1 and 200 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Product code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Product code must contain only uppercase letters, numbers, and underscores'),
];

const updateProductValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Product name must be between 1 and 200 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Product code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Product code must contain only uppercase letters, numbers, and underscores'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('category')
    .optional()
    .isIn([
      'LOAN_VERIFICATION',
      'EMPLOYMENT_VERIFICATION',
      'BUSINESS_VERIFICATION',
      'IDENTITY_VERIFICATION',
      'ADDRESS_VERIFICATION',
      'OTHER',
    ])
    .withMessage('Invalid category'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const listProductsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('clientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
  query('category')
    .optional()
    .isIn([
      'LOAN_VERIFICATION',
      'EMPLOYMENT_VERIFICATION',
      'BUSINESS_VERIFICATION',
      'IDENTITY_VERIFICATION',
      'ADDRESS_VERIFICATION',
      'OTHER',
    ])
    .withMessage('Invalid category'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'category', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

const _clientProductsValidation = [
  param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

// Core CRUD routes (CACHED)
router.get(
  '/',
  authenticateToken,
  EnterpriseCache.create(EnterpriseCacheConfigs.products),
  listProductsValidation,
  handleValidationErrors,
  addProductFiltering,
  getProducts
);

router.get(
  '/stats',
  authenticateToken,
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getProductStats
);

router.post(
  '/',
  authorize('settings.manage'),
  authenticateToken,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.productUpdate),
  createProductValidation,
  handleValidationErrors,
  createProduct
);

router.get(
  '/:id',
  authenticateToken,
  EnterpriseCache.create(EnterpriseCacheConfigs.products),
  [param('id').isInt({ min: 1 }).withMessage('Product ID must be a positive integer')],
  handleValidationErrors,
  validateProductAccess(),
  getProductById
);

router.put(
  '/:id',
  authorize('settings.manage'),
  authenticateToken,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.productUpdate),
  [param('id').isInt({ min: 1 }).withMessage('Product ID must be a positive integer')],
  updateProductValidation,
  handleValidationErrors,
  updateProduct
);

router.delete(
  '/:id',
  authorize('settings.manage'),
  authenticateToken,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.productUpdate),
  [param('id').isInt({ min: 1 }).withMessage('Product ID must be a positive integer')],
  handleValidationErrors,
  deleteProduct
);

// Get verification types for a product (CACHED)
router.get(
  '/:id/verification-types',
  authenticateToken,
  EnterpriseCache.create(EnterpriseCacheConfigs.verificationTypes),
  [
    param('id').isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  handleValidationErrors,
  validateProductAccess(),
  getProductVerificationTypes
);

export default router;
