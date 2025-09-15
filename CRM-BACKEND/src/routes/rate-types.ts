import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getRateTypes,
  getRateTypeById,
  createRateType,
  updateRateType,
  deleteRateType,
  getRateTypeStats,
  getAvailableRateTypesForCase
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
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
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
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const listRateTypesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('sortBy')
    .optional()
    .isIn(['name', 'description', 'isActive', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
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
router.get('/',
  listRateTypesValidation,
  handleValidationErrors,
  getRateTypes
);

router.get('/stats', getRateTypeStats);

// GET /api/rate-types/available-for-case - Get available rate types for case assignment
router.get('/available-for-case',
  availableRateTypesValidation,
  handleValidationErrors,
  getAvailableRateTypesForCase
);

router.post('/',
  createRateTypeValidation,
  handleValidationErrors,
  createRateType
);

router.get('/:id',
  [param('id').trim().notEmpty().withMessage('Rate type ID is required')],
  handleValidationErrors,
  getRateTypeById
);

router.put('/:id',
  [param('id').trim().notEmpty().withMessage('Rate type ID is required')],
  updateRateTypeValidation,
  handleValidationErrors,
  updateRateType
);

router.delete('/:id',
  [param('id').trim().notEmpty().withMessage('Rate type ID is required')],
  handleValidationErrors,
  deleteRateType
);

export default router;
