import express from 'express';
import multer from 'multer';
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
  parseUpload,
} from '@/controllers/caseDataTemplatesController';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Dedicated uploader for the template-import endpoint. Memory storage is
// fine — the file is parsed once and discarded; 2 MB is generous for a
// column-header spreadsheet and deflects accidental uploads of huge
// data dumps. Rejects anything other than .xlsx / .csv at the multer
// layer before the controller ever sees it.
const templateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      name.endsWith('.xlsx') ||
      name.endsWith('.csv') ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv';
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .csv files are supported'));
    }
  },
});

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

// Maximum number of fields allowed per template. Hard cap to prevent
// pathological templates from bloating JSONB payloads and slowing the
// form render on the client. 200 is plenty for realistic use cases
// (the Excel-based workflow being replaced topped out around 40).
const MAX_FIELDS_PER_TEMPLATE = 200;

// Field keys that must never appear in a template, either because they
// are JavaScript prototype-pollution vectors or because they collide
// with common JSON tooling expectations.
const RESERVED_FIELD_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'hasOwnProperty',
]);

// Allowed keys inside each field's `validationRules` object. Anything
// else is rejected so a typo in the admin UI doesn't silently "work"
// on save and then never trigger during validation.
const ALLOWED_VALIDATION_RULE_KEYS = new Set(['min', 'max', 'minLength', 'maxLength', 'pattern']);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// validator.js-compatible custom validator: throws on bad input.
const assertValidValidationRules = (value: unknown): true => {
  if (value === undefined) {
    return true;
  }
  if (!isPlainObject(value)) {
    throw new Error('validationRules must be an object');
  }
  for (const [k, v] of Object.entries(value)) {
    if (!ALLOWED_VALIDATION_RULE_KEYS.has(k)) {
      throw new Error(`Unknown validation rule "${k}"`);
    }
    if (k === 'min' || k === 'max' || k === 'minLength' || k === 'maxLength') {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(`Validation rule "${k}" must be a finite number`);
      }
    }
    if (k === 'pattern') {
      if (typeof v !== 'string') {
        throw new Error('Validation rule "pattern" must be a string');
      }
      try {
        new RegExp(v);
      } catch {
        throw new Error('Validation rule "pattern" must be a valid regular expression');
      }
    }
  }
  return true;
};

const assertValidOptions = (value: unknown): true => {
  if (value === undefined) {
    return true;
  }
  if (!Array.isArray(value)) {
    throw new Error('options must be an array');
  }
  const seenValues = new Set<string>();
  for (const [i, opt] of value.entries()) {
    if (!isPlainObject(opt)) {
      throw new Error(`options[${i}] must be an object`);
    }
    const { label, value: optValue } = opt as { label?: unknown; value?: unknown };
    if (typeof label !== 'string' || label.trim().length === 0) {
      throw new Error(`options[${i}].label must be a non-empty string`);
    }
    if (typeof optValue !== 'string' || optValue.trim().length === 0) {
      throw new Error(`options[${i}].value must be a non-empty string`);
    }
    if (seenValues.has(optValue)) {
      throw new Error(`options contain duplicate value "${optValue}"`);
    }
    seenValues.add(optValue);
  }
  return true;
};

const fieldValidation = [
  body('fields')
    .isArray({ min: 1, max: MAX_FIELDS_PER_TEMPLATE })
    .withMessage(`fields must contain 1-${MAX_FIELDS_PER_TEMPLATE} items`),
  body('fields.*.fieldKey')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Field key must be 1-100 characters')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage(
      'Field key must start with a letter and contain only letters, digits, and underscores'
    )
    .custom(value => {
      if (RESERVED_FIELD_KEYS.has(value)) {
        throw new Error(`"${value}" is a reserved field key`);
      }
      return true;
    }),
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
  body('fields.*.validationRules').optional().custom(assertValidValidationRules),
  body('fields.*.options').optional().custom(assertValidOptions),
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
  body('fields')
    .optional()
    .isArray({ min: 1, max: MAX_FIELDS_PER_TEMPLATE })
    .withMessage(`fields must contain 1-${MAX_FIELDS_PER_TEMPLATE} items`),
  body('fields.*.fieldKey')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage(
      'Field key must start with a letter and contain only letters, digits, and underscores'
    )
    .custom(value => {
      if (RESERVED_FIELD_KEYS.has(value)) {
        throw new Error(`"${value}" is a reserved field key`);
      }
      return true;
    }),
  body('fields.*.fieldLabel').optional().trim().isLength({ min: 1, max: 255 }),
  body('fields.*.fieldType')
    .optional()
    .isIn(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'TEXTAREA']),
  body('fields.*.validationRules').optional().custom(assertValidValidationRules),
  body('fields.*.options').optional().custom(assertValidOptions),
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

// Parse an uploaded .xlsx / .csv into a draft field list for the
// import-preview UI. Does NOT persist; the admin reviews and then POSTs
// to the normal create endpoint above with the edited fields.
router.post(
  '/parse-upload',
  authorize('case_data_template.manage'),
  templateUpload.single('file'),
  parseUpload
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
