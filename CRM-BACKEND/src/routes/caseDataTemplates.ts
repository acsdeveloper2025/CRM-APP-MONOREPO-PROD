import express from 'express';
import { body, query as queryValidator, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getTemplates,
  getTemplateById,
  getTemplateByConfig,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '@/controllers/caseDataTemplatesController';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const fieldValidation = [
  body('fields').isArray({ min: 1 }).withMessage('At least one field is required'),
  body('fields.*.fieldKey')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Field key must be 1-100 characters')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage(
      'Field key must start with a letter and contain only letters, digits, and underscores'
    ),
  body('fields.*.fieldLabel')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Field label must be 1-255 characters'),
  body('fields.*.fieldType')
    .isIn(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'TEXTAREA'])
    .withMessage('Invalid field type'),
  body('fields.*.isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
  body('fields.*.displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('displayOrder must be a non-negative integer'),
  body('fields.*.section')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Section must be ≤ 100 characters'),
  body('fields.*.placeholder')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Placeholder must be ≤ 255 characters'),
  body('fields.*.defaultValue').optional().isString().withMessage('Default value must be a string'),
  body('fields.*.validationRules')
    .optional()
    .isObject()
    .withMessage('Validation rules must be an object'),
  body('fields.*.options').optional().isArray().withMessage('Options must be an array'),
];

const createTemplateValidation = [
  body('clientId').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  body('productId').isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name must be 1-255 characters'),
  ...fieldValidation,
];

const updateTemplateValidation = [
  param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters'),
  body('fields').optional().isArray({ min: 1 }).withMessage('Fields must be a non-empty array'),
  // Conditionally validate field items only when fields array is present
  body('fields.*.fieldKey')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage(
      'Field key must start with a letter and contain only letters, digits, and underscores'
    ),
  body('fields.*.fieldLabel').optional().trim().isLength({ min: 1, max: 255 }),
  body('fields.*.fieldType')
    .optional()
    .isIn(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'TEXTAREA']),
];

const listTemplatesValidation = [
  queryValidator('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  queryValidator('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be 1-500'),
  queryValidator('clientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
  queryValidator('productId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  queryValidator('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  queryValidator('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be ≤ 100 characters'),
  queryValidator('sortBy')
    .optional()
    .isIn(['name', 'clientName', 'productName', 'version', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  queryValidator('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const byConfigValidation = [
  queryValidator('clientId').isInt({ min: 1 }).withMessage('Client ID is required'),
  queryValidator('productId').isInt({ min: 1 }).withMessage('Product ID is required'),
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// List templates (any authenticated user with case.view)
router.get(
  '/',
  authorize('case.view'),
  listTemplatesValidation,
  handleValidationErrors,
  getTemplates
);

// Get active template by client+product config
router.get(
  '/by-config',
  authorize('case.view'),
  byConfigValidation,
  handleValidationErrors,
  getTemplateByConfig
);

// Get template by ID
router.get(
  '/:id',
  authorize('case.view'),
  [param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer')],
  handleValidationErrors,
  getTemplateById
);

// Create template (requires dedicated permission)
router.post(
  '/',
  authorize('case_data_template.manage'),
  createTemplateValidation,
  handleValidationErrors,
  createTemplate
);

// Update template
router.put(
  '/:id',
  authorize('case_data_template.manage'),
  updateTemplateValidation,
  handleValidationErrors,
  updateTemplate
);

// Delete (deactivate) template
router.delete(
  '/:id',
  authorize('case_data_template.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer')],
  handleValidationErrors,
  deleteTemplate
);

export default router;
