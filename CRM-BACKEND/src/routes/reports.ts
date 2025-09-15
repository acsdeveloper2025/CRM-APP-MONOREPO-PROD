import express from 'express';
import { body, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getCasesReport,
  getUserPerformanceReport,
  getClientReport,
  // Phase 1: New Data Visualization & Reporting APIs
  getFormSubmissions,
  getFormSubmissionsByType,
  getFormValidationStatus,
  getCaseAnalytics,
  getCaseTimeline,
  getAgentPerformance,
  getAgentProductivity
} from '@/controllers/reportsController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const dateRangeValidation = [
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  query('format')
    .optional()
    .isIn(['JSON', 'CSV', 'PDF', 'EXCEL'])
    .withMessage('Format must be one of: JSON, CSV, PDF, EXCEL'),
];

const casesReportValidation = [
  ...dateRangeValidation,
  query('clientId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Client ID must not be empty'),
  query('assignedToId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Assigned user ID must not be empty'),
  query('status')
    .optional()
    .isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'REWORK_REQUIRED'])
    .withMessage('Invalid status'),
  query('priority')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Priority must be between 1 and 5'),
];

const usersReportValidation = [
  ...dateRangeValidation,
  query('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
  query('role')
    .optional()
    .isIn(['ADMIN', 'MANAGER', 'FIELD', 'CLIENT'])
    .withMessage('Invalid role'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const clientsReportValidation = [
  ...dateRangeValidation,
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const financialReportValidation = [
  ...dateRangeValidation,
  query('clientId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Client ID must not be empty'),
];

const productivityReportValidation = [
  ...dateRangeValidation,
  query('userId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('User ID must not be empty'),
  query('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
];

const customReportValidation = [
  body('reportType')
    .isIn(['cases', 'users', 'clients', 'invoices', 'commissions'])
    .withMessage('Invalid report type'),
  body('metrics')
    .isArray({ min: 1 })
    .withMessage('Metrics array is required'),
  body('metrics.*')
    .isIn(['count', 'sum', 'average', 'min', 'max'])
    .withMessage('Invalid metric'),
  body('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  body('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  body('groupBy')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Group by field must be less than 50 characters'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  body('format')
    .optional()
    .isIn(['JSON', 'CSV', 'PDF', 'EXCEL'])
    .withMessage('Format must be one of: JSON, CSV, PDF, EXCEL'),
];

const scheduleReportValidation = [
  body('reportType')
    .isIn(['cases', 'users', 'clients', 'financial', 'productivity', 'custom'])
    .withMessage('Invalid report type'),
  body('parameters')
    .isObject()
    .withMessage('Parameters object is required'),
  body('schedule.frequency')
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Frequency must be one of: daily, weekly, monthly'),
  body('schedule.time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time must be in HH:MM format'),
  body('recipients')
    .isArray({ min: 1 })
    .withMessage('Recipients array is required'),
  body('recipients.*')
    .isEmail()
    .withMessage('Each recipient must be a valid email'),
  body('format')
    .optional()
    .isIn(['PDF', 'EXCEL', 'CSV'])
    .withMessage('Format must be one of: PDF, EXCEL, CSV'),
];

// Phase 1: New validation schemas for data visualization APIs
const formSubmissionsValidation = [
  ...dateRangeValidation,
  query('formType')
    .optional()
    .isIn(['RESIDENCE', 'OFFICE', 'BUSINESS'])
    .withMessage('Form type must be one of: RESIDENCE, OFFICE, BUSINESS'),
  query('agentId')
    .optional()
    .isUUID()
    .withMessage('Agent ID must be a valid UUID'),
  query('validationStatus')
    .optional()
    .isIn(['VALID', 'PENDING', 'INVALID'])
    .withMessage('Validation status must be one of: VALID, PENDING, INVALID'),
  query('caseId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Case ID must not be empty'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
];

const caseAnalyticsValidation = [
  ...dateRangeValidation,
  query('clientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
  query('agentId')
    .optional()
    .isUUID()
    .withMessage('Agent ID must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'REWORK_REQUIRED'])
    .withMessage('Invalid status'),
];

const agentPerformanceValidation = [
  ...dateRangeValidation,
  query('agentId')
    .optional()
    .isUUID()
    .withMessage('Agent ID must be a valid UUID'),
  query('departmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer'),
];

// Report routes
router.get('/cases', 
  casesReportValidation, 
  validate, 
  getCasesReport
);

router.get('/users',
  usersReportValidation,
  validate,
  getUserPerformanceReport
);

router.get('/clients',
  clientsReportValidation,
  validate,
  getClientReport
);

// ===== PHASE 1: NEW DATA VISUALIZATION & REPORTING ROUTES =====

// 1.1 Form Submission Data APIs
router.get('/form-submissions',
  formSubmissionsValidation,
  validate,
  getFormSubmissions
);

router.get('/form-submissions/:formType',
  [
    ...dateRangeValidation,
    query('agentId').optional().isUUID().withMessage('Agent ID must be a valid UUID'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
  ],
  validate,
  getFormSubmissionsByType
);

router.get('/form-validation-status',
  dateRangeValidation,
  validate,
  getFormValidationStatus
);

// 1.2 Case Analytics APIs
router.get('/case-analytics',
  caseAnalyticsValidation,
  validate,
  getCaseAnalytics
);

router.get('/case-timeline/:caseId',
  [
    query('caseId').isString().trim().notEmpty().withMessage('Case ID is required'),
  ],
  validate,
  getCaseTimeline
);

// 1.3 Agent Performance APIs
router.get('/agent-performance',
  agentPerformanceValidation,
  validate,
  getAgentPerformance
);

router.get('/agent-productivity/:agentId',
  [
    ...dateRangeValidation,
    query('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  ],
  validate,
  getAgentProductivity
);

// TODO: Implement remaining report functions
// router.get('/financial',
//   financialReportValidation,
//   validate,
//   getFinancialReport
// );

// router.get('/productivity',
//   productivityReportValidation,
//   validate,
//   getProductivityReport
// );

// router.post('/custom',
//   customReportValidation,
//   validate,
//   getCustomReport
// );

// router.get('/templates', getReportTemplates);

// router.post('/schedule',
//   scheduleReportValidation,
//   validate,
//   scheduleReport
// );

export default router;
