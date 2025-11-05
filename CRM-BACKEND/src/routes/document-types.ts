import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import {
  getDocumentTypes,
  getDocumentTypeById,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  getDocumentTypeStats,
  getDocumentTypeCategories,
} from '../controllers/documentTypesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const createDocumentTypeValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Code must contain only uppercase letters, numbers, and underscores'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('category')
    .isIn(['IDENTITY', 'ADDRESS', 'FINANCIAL', 'EDUCATION', 'BUSINESS', 'OTHER'])
    .withMessage('Invalid category'),
  body('isGovernmentIssued')
    .optional()
    .isBoolean()
    .withMessage('isGovernmentIssued must be a boolean'),
  body('requiresVerification')
    .optional()
    .isBoolean()
    .withMessage('requiresVerification must be a boolean'),
  body('validityPeriodMonths')
    .optional()
    .isInt({ min: 1 })
    .withMessage('validityPeriodMonths must be a positive integer'),
  body('formatPattern')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('formatPattern must be less than 255 characters'),
  body('minLength')
    .optional()
    .isInt({ min: 1 })
    .withMessage('minLength must be a positive integer'),
  body('maxLength')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxLength must be a positive integer'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder must be a non-negative integer'),
];

const updateDocumentTypeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Code must contain only uppercase letters, numbers, and underscores'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('category')
    .optional()
    .isIn(['IDENTITY', 'ADDRESS', 'FINANCIAL', 'EDUCATION', 'BUSINESS', 'OTHER'])
    .withMessage('Invalid category'),
  body('isGovernmentIssued')
    .optional()
    .isBoolean()
    .withMessage('isGovernmentIssued must be a boolean'),
  body('requiresVerification')
    .optional()
    .isBoolean()
    .withMessage('requiresVerification must be a boolean'),
  body('validityPeriodMonths')
    .optional()
    .isInt({ min: 1 })
    .withMessage('validityPeriodMonths must be a positive integer'),
  body('formatPattern')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('formatPattern must be less than 255 characters'),
  body('minLength')
    .optional()
    .isInt({ min: 1 })
    .withMessage('minLength must be a positive integer'),
  body('maxLength')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxLength must be a positive integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('sortOrder must be a non-negative integer'),
];

const listDocumentTypesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .isIn(['IDENTITY', 'ADDRESS', 'FINANCIAL', 'EDUCATION', 'BUSINESS', 'OTHER'])
    .withMessage('Invalid category'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('isGovernmentIssued')
    .optional()
    .isBoolean()
    .withMessage('isGovernmentIssued must be a boolean'),
  query('requiresVerification')
    .optional()
    .isBoolean()
    .withMessage('requiresVerification must be a boolean'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'category', 'sort_order', 'created_at', 'updated_at'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

// Core CRUD routes
router.get('/', listDocumentTypesValidation, handleValidationErrors, getDocumentTypes);

router.get('/stats', getDocumentTypeStats);
router.get('/categories', getDocumentTypeCategories);

router.post('/', createDocumentTypeValidation, handleValidationErrors, createDocumentType);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Document type ID must be a positive integer')],
  handleValidationErrors,
  getDocumentTypeById
);

router.put(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Document type ID must be a positive integer')],
  updateDocumentTypeValidation,
  handleValidationErrors,
  updateDocumentType
);

router.delete(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Document type ID must be a positive integer')],
  handleValidationErrors,
  deleteDocumentType
);

export default router;
