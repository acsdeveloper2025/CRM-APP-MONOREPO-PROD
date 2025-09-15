import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getRateTypeAssignments,
  getAssignmentsByCombination,
  bulkAssignRateTypes,
  createRateTypeAssignment,
  deleteRateTypeAssignment
} from '@/controllers/rateTypeAssignmentsController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const listAssignmentsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('clientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Client ID must be a valid integer'),
  query('productId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid integer'),
  query('verificationTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Verification Type ID must be a valid integer'),
  query('rateTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Rate Type ID must be a valid integer'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const combinationValidation = [
  query('clientId')
    .isInt({ min: 1 })
    .withMessage('Client ID must be a valid integer'),
  query('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid integer'),
  query('verificationTypeId')
    .isInt({ min: 1 })
    .withMessage('Verification Type ID must be a valid integer'),
];

const bulkAssignValidation = [
  body('clientId')
    .isInt({ min: 1 })
    .withMessage('Client ID must be a valid integer'),
  body('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid integer'),
  body('verificationTypeId')
    .isInt({ min: 1 })
    .withMessage('Verification Type ID must be a valid integer'),
  body('rateTypeIds')
    .isArray()
    .withMessage('Rate Type IDs must be an array'),
  body('rateTypeIds.*')
    .isInt({ min: 1 })
    .withMessage('Each Rate Type ID must be a valid integer'),
];

const createAssignmentValidation = [
  body('clientId')
    .isInt({ min: 1 })
    .withMessage('Client ID must be a valid integer'),
  body('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid integer'),
  body('verificationTypeId')
    .isInt({ min: 1 })
    .withMessage('Verification Type ID must be a valid integer'),
  body('rateTypeId')
    .isInt({ min: 1 })
    .withMessage('Rate Type ID must be a valid integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

// Routes
router.get('/',
  listAssignmentsValidation,
  handleValidationErrors,
  getRateTypeAssignments
);

router.get('/by-combination',
  combinationValidation,
  handleValidationErrors,
  getAssignmentsByCombination
);

router.post('/bulk-assign',
  bulkAssignValidation,
  handleValidationErrors,
  bulkAssignRateTypes
);

router.post('/',
  createAssignmentValidation,
  handleValidationErrors,
  createRateTypeAssignment
);

router.delete('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Assignment ID must be a valid integer')],
  handleValidationErrors,
  deleteRateTypeAssignment
);

export default router;
