import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getRates,
  getAvailableRateTypesForAssignment,
  createOrUpdateRate,
  deleteRate,
  getRateStats
} from '@/controllers/ratesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const listRatesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
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
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['clientName', 'productName', 'verificationTypeName', 'rateTypeName', 'amount', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const availableRateTypesValidation = [
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

const createOrUpdateRateValidation = [
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
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (Number(value) < 0) {
        throw new Error('Amount must be non-negative');
      }
      return true;
    }),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code')
    .matches(/^[A-Z]{3}$/)
    .withMessage('Currency must be uppercase letters only'),
];

// Routes
router.get('/',
  listRatesValidation,
  handleValidationErrors,
  getRates
);

router.get('/available-for-assignment',
  availableRateTypesValidation,
  handleValidationErrors,
  getAvailableRateTypesForAssignment
);

router.get('/stats', getRateStats);

router.post('/',
  createOrUpdateRateValidation,
  handleValidationErrors,
  createOrUpdateRate
);

router.delete('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Rate ID must be a valid integer')],
  handleValidationErrors,
  deleteRate
);

export default router;
