import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import { EnterpriseCache, CacheInvalidationPatterns } from '@/middleware/enterpriseCache';
import {
  getRateTypes,
  getRateTypeById,
  createRateType,
  updateRateType,
  deleteRateType,
  getRateTypeStats,
  getAvailableRateTypesForCase,
  exportRateTypes,
} from '@/controllers/rateTypesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);
// Validation schemas
const createRateTypeValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Rate type name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateRateTypeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Rate type name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

// Reusable query-param validators for list + export (kept in lockstep with
// buildRateTypesWhereClause in rateTypesController.ts).
const rateTypesQueryValidation = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('isActive')
    .optional()
    .isIn(['true', 'false', 'all'])
    .withMessage("isActive must be 'true', 'false', or 'all'"),
  query('createdFrom').optional().isISO8601().withMessage('createdFrom must be ISO 8601'),
  query('createdTo').optional().isISO8601().withMessage('createdTo must be ISO 8601'),
  query('sortBy')
    .optional()
    .isIn(['name', 'description', 'isActive', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

const listRateTypesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  ...rateTypesQueryValidation,
];

const availableRateTypesValidation = [
  query('clientId')
    .trim()
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Client ID is required and must be a positive integer'),
  query('productId')
    .trim()
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Product ID is required and must be a positive integer'),
  query('verificationTypeId')
    .trim()
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Verification Type ID is required and must be a positive integer'),
];

// Core CRUD routes
router.get(
  '/',
  authorize('page.masterdata'),
  listRateTypesValidation,
  handleValidationErrors,
  getRateTypes
);

router.get('/stats', authorize('page.masterdata'), getRateTypeStats);

// GET /api/rate-types/export - xlsx download mirroring list filters. MUST
// stay declared BEFORE /:id (Express matches in declaration order).
router.get(
  '/export',
  authorize('page.masterdata'),
  rateTypesQueryValidation,
  handleValidationErrors,
  exportRateTypes
);

// GET /api/rate-types/available-for-case - Get available rate types for case assignment
router.get(
  '/available-for-case',
  authorizeAny(['page.masterdata', 'case.create']),
  availableRateTypesValidation,
  handleValidationErrors,
  getAvailableRateTypesForCase
);

router.post(
  '/',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.rateTypeUpdate),
  createRateTypeValidation,
  handleValidationErrors,
  createRateType
);

router.get(
  '/:id',
  authorize('page.masterdata'),
  [param('id').trim().notEmpty().withMessage('Rate type ID is required')],
  handleValidationErrors,
  getRateTypeById
);

router.put(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.rateTypeUpdate),
  [param('id').trim().notEmpty().withMessage('Rate type ID is required')],
  updateRateTypeValidation,
  handleValidationErrors,
  updateRateType
);

router.delete(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.rateTypeUpdate),
  [param('id').trim().notEmpty().withMessage('Rate type ID is required')],
  handleValidationErrors,
  deleteRateType
);

export default router;
