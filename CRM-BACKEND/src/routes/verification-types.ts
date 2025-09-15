import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getVerificationTypes,
  getVerificationTypeById,
  createVerificationType,
  updateVerificationType,
  deleteVerificationType,
  getVerificationTypeStats
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
];

const listVerificationTypesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .isIn(['ADDRESS_VERIFICATION', 'EMPLOYMENT_VERIFICATION', 'BUSINESS_VERIFICATION', 'IDENTITY_VERIFICATION', 'FINANCIAL_VERIFICATION', 'OTHER'])
    .withMessage('Invalid category'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'category', 'basePrice', 'estimatedTime', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

// TODO: Implement bulk import validation when needed
// const bulkImportValidation = [
//   body('verificationTypes')
//     .isArray({ min: 1 })
//     .withMessage('Verification types array is required'),
//   body('verificationTypes.*.name')
//     .trim()
//     .isLength({ min: 1, max: 200 })
//     .withMessage('Name is required and must be less than 200 characters'),
//   body('verificationTypes.*.code')
//     .trim()
//     .isLength({ min: 2, max: 50 })
//     .withMessage('Code is required and must be between 2 and 50 characters'),
// ];

// Core CRUD routes
router.get('/',
  listVerificationTypesValidation,
  handleValidationErrors,
  getVerificationTypes
);

// TODO: Implement these endpoints
// router.get('/categories', getVerificationTypeCategories);
router.get('/stats', getVerificationTypeStats);

router.post('/',
  createVerificationTypeValidation,
  handleValidationErrors,
  createVerificationType
);

// TODO: Implement bulk import endpoint
// router.post('/bulk-import',
//   bulkImportValidation,
//   validate,
//   bulkImportVerificationTypes
// );

router.get('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Verification type ID must be a positive integer')],
  handleValidationErrors,
  getVerificationTypeById
);

router.put('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Verification type ID must be a positive integer')],
  updateVerificationTypeValidation,
  handleValidationErrors,
  updateVerificationType
);

router.delete('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Verification type ID must be a positive integer')],
  handleValidationErrors,
  deleteVerificationType
);

export default router;
