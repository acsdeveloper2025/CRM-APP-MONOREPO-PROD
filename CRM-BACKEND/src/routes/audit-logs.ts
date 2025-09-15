import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getAuditLogs,
  getAuditLogById,
  createAuditLog,
  getAuditActions,
  getAuditCategories,
  getAuditStats,
  exportAuditLogs,
  cleanupAuditLogs
} from '@/controllers/auditLogsController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const listAuditLogsValidation = [
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
  query('action')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Action must be less than 100 characters'),
  query('resource')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Resource must be less than 100 characters'),
  query('category')
    .optional()
    .isIn(['AUTHENTICATION', 'USER_MANAGEMENT', 'CASE_MANAGEMENT', 'CLIENT_MANAGEMENT', 'FILE_MANAGEMENT', 'FINANCIAL', 'SYSTEM', 'SECURITY', 'DATA_MANAGEMENT', 'REPORTING'])
    .withMessage('Invalid category'),
  query('severity')
    .optional()
    .isIn(['INFO', 'WARN', 'ERROR', 'CRITICAL'])
    .withMessage('Invalid severity'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['timestamp', 'userId', 'userName', 'action', 'resource', 'category', 'severity'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const createAuditLogValidation = [
  body('action')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Action is required and must be less than 100 characters'),
  body('resource')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Resource is required and must be less than 100 characters'),
  body('resourceId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Resource ID must be less than 100 characters'),
  body('details')
    .optional()
    .isObject()
    .withMessage('Details must be an object'),
  body('severity')
    .optional()
    .isIn(['INFO', 'WARN', 'ERROR', 'CRITICAL'])
    .withMessage('Invalid severity'),
  body('category')
    .isIn(['AUTHENTICATION', 'USER_MANAGEMENT', 'CASE_MANAGEMENT', 'CLIENT_MANAGEMENT', 'FILE_MANAGEMENT', 'FINANCIAL', 'SYSTEM', 'SECURITY', 'DATA_MANAGEMENT', 'REPORTING'])
    .withMessage('Invalid category'),
];

const statsValidation = [
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Period must be one of: day, week, month, year'),
];

const exportValidation = [
  body('format')
    .optional()
    .isIn(['CSV', 'JSON', 'EXCEL'])
    .withMessage('Format must be one of: CSV, JSON, EXCEL'),
  body('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  body('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
];

const cleanupValidation = [
  body('olderThanDays')
    .optional()
    .isInt({ min: 1, max: 3650 })
    .withMessage('Older than days must be between 1 and 3650'),
];

// Core routes
router.get('/', 
  listAuditLogsValidation, 
  validate, 
  getAuditLogs
);

router.get('/actions', getAuditActions);

router.get('/categories', getAuditCategories);

router.get('/stats', 
  statsValidation, 
  validate, 
  getAuditStats
);

router.post('/', 
  createAuditLogValidation, 
  validate, 
  createAuditLog
);

router.post('/export', 
  exportValidation, 
  validate, 
  exportAuditLogs
);

router.delete('/cleanup', 
  cleanupValidation, 
  validate, 
  cleanupAuditLogs
);

router.get('/:id', 
  [param('id').trim().notEmpty().withMessage('Audit log ID is required')], 
  validate, 
  getAuditLogById
);

export default router;
