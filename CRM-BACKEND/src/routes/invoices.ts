import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  markInvoicePaid,
  downloadInvoice,
  getInvoiceStats
} from '@/controllers/invoicesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const createInvoiceValidation = [
  body('clientId')
    .trim()
    .notEmpty()
    .withMessage('Client ID is required'),
  body('clientName')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Client name must be between 1 and 200 characters'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items array is required'),
  body('items.*.description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Item description must be between 1 and 500 characters'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  body('items.*.unitPrice')
    .isNumeric()
    .withMessage('Item unit price must be a number'),
  body('items.*.caseIds')
    .optional()
    .isArray()
    .withMessage('Case IDs must be an array'),
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  body('currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR'])
    .withMessage('Currency must be one of: INR, USD, EUR'),
];

const updateInvoiceValidation = [
  body('clientName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Client name must be between 1 and 200 characters'),
  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Items array must not be empty'),
  body('items.*.description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Item description must be between 1 and 500 characters'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  body('items.*.unitPrice')
    .optional()
    .isNumeric()
    .withMessage('Item unit price must be a number'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

const listInvoicesValidation = [
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
    .trim()
    .notEmpty()
    .withMessage('Client ID must not be empty'),
  query('status')
    .optional()
    .isIn(['DRAFT', 'SENT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'])
    .withMessage('Invalid status'),
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
    .isIn(['invoiceNumber', 'clientName', 'amount', 'totalAmount', 'issueDate', 'dueDate', 'status'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const sendInvoiceValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Message must be less than 1000 characters'),
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

// Core CRUD routes
router.get('/', 
  listInvoicesValidation, 
  validate, 
  getInvoices
);

router.get('/stats', getInvoiceStats);

router.post('/', 
  createInvoiceValidation, 
  validate, 
  createInvoice
);

router.get('/:id', 
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')], 
  validate, 
  getInvoiceById
);

router.put('/:id', 
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')], 
  updateInvoiceValidation, 
  validate, 
  updateInvoice
);

router.delete('/:id', 
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')], 
  validate, 
  deleteInvoice
);

// Invoice operations
router.post('/:id/send', 
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')], 
  sendInvoiceValidation, 
  validate, 
  sendInvoice
);

router.post('/:id/mark-paid', 
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')], 
  markPaidValidation, 
  validate, 
  markInvoicePaid
);

router.get('/:id/download', 
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')], 
  validate, 
  downloadInvoice
);

export default router;
