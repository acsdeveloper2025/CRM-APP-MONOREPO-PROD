import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getDocumentTypeRates,
  createOrUpdateDocumentTypeRate,
  deleteDocumentTypeRate,
  getDocumentTypeRateStats
} from '@/controllers/documentTypeRatesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const listDocumentTypeRatesValidation = [
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
  query('documentTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Document Type ID must be a valid integer'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search must be between 1 and 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['clientName', 'productName', 'documentTypeName', 'amount', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const createOrUpdateDocumentTypeRateValidation = [
  body('clientId')
    .isInt({ min: 1 })
    .withMessage('Client ID must be a valid integer'),
  body('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid integer'),
  body('documentTypeId')
    .isInt({ min: 1 })
    .withMessage('Document Type ID must be a valid integer'),
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
    .matches(/^[A-Z]{3}$/)
    .withMessage('Currency must be a 3-letter uppercase code (e.g., INR, USD)'),
];

const deleteDocumentTypeRateValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Rate ID must be a valid integer'),
];

// Routes

// GET /api/document-type-rates/stats - Get statistics (must be before /:id route)
router.get(
  '/stats',
  getDocumentTypeRateStats
);

// GET /api/document-type-rates - List document type rates
router.get(
  '/',
  listDocumentTypeRatesValidation,
  handleValidationErrors,
  getDocumentTypeRates
);

// POST /api/document-type-rates - Create or update document type rate
router.post(
  '/',
  createOrUpdateDocumentTypeRateValidation,
  handleValidationErrors,
  createOrUpdateDocumentTypeRate
);

// DELETE /api/document-type-rates/:id - Delete document type rate
router.delete(
  '/:id',
  deleteDocumentTypeRateValidation,
  handleValidationErrors,
  deleteDocumentTypeRate
);

export default router;

