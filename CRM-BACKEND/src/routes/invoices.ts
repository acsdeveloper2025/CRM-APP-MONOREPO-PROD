import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  regenerateInvoice,
  cancelInvoice,
  downloadInvoice,
  getInvoiceStats,
  exportInvoicesToExcel,
} from '@/controllers/invoicesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const createInvoiceValidation = [
  body('clientId').trim().notEmpty().withMessage('Client ID is required'),
  body('clientName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Client name must be between 1 and 200 characters'),
  body('items').optional().isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Item description must be between 1 and 500 characters'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  body('items.*.unitPrice').optional().isNumeric().withMessage('Item unit price must be a number'),
  body('items.*.caseIds').optional().isArray().withMessage('Case IDs must be an array'),
  body('taskIds').optional().isArray().withMessage('Task IDs must be an array'),
  body('productId').optional().trim().notEmpty().withMessage('Product ID must not be empty'),
  body('billingPeriodFrom')
    .optional()
    .isISO8601()
    .withMessage('Billing period from must be a valid date'),
  body('billingPeriodTo')
    .optional()
    .isISO8601()
    .withMessage('Billing period to must be a valid date'),
  body('dueDate').isISO8601().withMessage('Due date must be a valid date'),
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
  body('items').optional().isArray({ min: 1 }).withMessage('Items array must not be empty'),
  body('items.*.description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Item description must be between 1 and 500 characters'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  body('items.*.unitPrice').optional().isNumeric().withMessage('Item unit price must be a number'),
  body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

const listInvoicesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('clientId').optional().trim().notEmpty().withMessage('Client ID must not be empty'),
  query('status')
    .optional()
    .isIn(['DRAFT', 'SENT', 'OVERDUE', 'CANCELLED'])
    .withMessage('Invalid status'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('sortBy')
    .optional()
    .isIn([
      'invoiceNumber',
      'clientName',
      'amount',
      'totalAmount',
      'issueDate',
      'dueDate',
      'status',
    ])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

// Core CRUD routes
router.get('/', authorize('billing.download'), listInvoicesValidation, validate, getInvoices);

router.get('/stats', authorize('billing.download'), getInvoiceStats);

router.get('/export', authorize('billing.download'), exportInvoicesToExcel);

router.post('/', authorize('billing.generate'), createInvoiceValidation, validate, createInvoice);

router.get(
  '/:id',
  authorize('billing.download'),
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')],
  validate,
  getInvoiceById
);

router.put(
  '/:id',
  authorize('billing.generate'),
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')],
  updateInvoiceValidation,
  validate,
  updateInvoice
);

router.delete(
  '/:id',
  authorize('billing.generate'),
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')],
  validate,
  deleteInvoice
);

router.post(
  '/:id/regenerate',
  authorize('billing.generate'),
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')],
  validate,
  regenerateInvoice
);

router.post(
  '/:id/cancel',
  authorize('billing.generate'),
  [
    param('id').trim().notEmpty().withMessage('Invoice ID is required'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters'),
  ],
  validate,
  cancelInvoice
);

router.get(
  '/:id/download',
  authorize('billing.download'),
  [param('id').trim().notEmpty().withMessage('Invoice ID is required')],
  validate,
  downloadInvoice
);

export default router;
