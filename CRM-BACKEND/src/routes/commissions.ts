import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getCommissions,
  getCommissionById,
  approveCommission,
  markCommissionPaid,
  getCommissionSummary,
  bulkApproveCommissions,
  bulkMarkCommissionsPaid
} from '@/controllers/commissionsController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const listCommissionsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('userId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('User ID must not be empty'),
  query('status')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'REJECTED'])
    .withMessage('Invalid status'),
  query('clientId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Client ID must not be empty'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  query('sortBy')
    .optional()
    .isIn(['userName', 'caseTitle', 'clientName', 'commissionAmount', 'status', 'createdAt', 'approvedAt', 'paidDate'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const approveValidation = [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

const markPaidValidation = [
  body('paidDate')
    .optional()
    .isISO8601()
    .withMessage('Paid date must be a valid date'),
  body('paymentMethod')
    .optional()
    .isIn(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE', 'UPI', 'CARD'])
    .withMessage('Invalid payment method'),
  body('transactionId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Transaction ID must be less than 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
];

const bulkApproveValidation = [
  body('commissionIds')
    .isArray({ min: 1 })
    .withMessage('Commission IDs array is required'),
  body('commissionIds.*')
    .isString()
    .withMessage('Each commission ID must be a string'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

const bulkMarkPaidValidation = [
  body('commissionIds')
    .isArray({ min: 1 })
    .withMessage('Commission IDs array is required'),
  body('commissionIds.*')
    .isString()
    .withMessage('Each commission ID must be a string'),
  body('paymentMethod')
    .optional()
    .isIn(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE', 'UPI', 'CARD'])
    .withMessage('Invalid payment method'),
  body('transactionId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Transaction ID must be less than 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
];

const summaryValidation = [
  query('userId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('User ID must not be empty'),
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year'])
    .withMessage('Period must be one of: week, month, quarter, year'),
];

// Core routes
router.get('/', 
  listCommissionsValidation, 
  validate, 
  getCommissions
);

router.get('/summary', 
  summaryValidation, 
  validate, 
  getCommissionSummary
);

router.post('/bulk-approve', 
  bulkApproveValidation, 
  validate, 
  bulkApproveCommissions
);

router.post('/bulk-mark-paid', 
  bulkMarkPaidValidation, 
  validate, 
  bulkMarkCommissionsPaid
);

router.get('/:id', 
  [param('id').trim().notEmpty().withMessage('Commission ID is required')], 
  validate, 
  getCommissionById
);

router.post('/:id/approve', 
  [param('id').trim().notEmpty().withMessage('Commission ID is required')], 
  approveValidation, 
  validate, 
  approveCommission
);

router.post('/:id/mark-paid', 
  [param('id').trim().notEmpty().withMessage('Commission ID is required')], 
  markPaidValidation, 
  validate, 
  markCommissionPaid
);

export default router;
