import express from 'express';
import multer from 'multer';
import { body, query as queryValidator, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import { extendedTimeout } from '@/middleware/requestTimeout';
import {
  getTemplates,
  getTemplateById,
  getTemplateByConfig,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  validateTemplate,
  generateReport,
  getContextPreview,
  convertFromPdf,
  getContextSchema,
  previewHtml,
} from '@/controllers/reportTemplatesController';

// Multer config for the PDF → Handlebars converter. Memory storage because
// we pass the bytes straight to the local extractor — no need to land on
// disk. 10 MB cap comfortably covers real RCU report samples while
// rejecting accidental giant uploads.
const pdfConverterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported'));
    }
  },
});

// Multer config for logo/stamp uploads at report-generation time. Both
// fields are optional; if present they replace the defaults the template
// would otherwise use. Memory storage + 2 MB cap per file — these are
// branding assets, not documents.
const reportBrandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are supported for logo/stamp'));
    }
  },
});

const router = express.Router();

router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ALLOWED_PAGE_SIZES = ['A4', 'LETTER', 'LEGAL'] as const;
const ALLOWED_PAGE_ORIENTATIONS = ['portrait', 'landscape'] as const;

const createTemplateValidation = [
  body('clientId').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  body('productId').isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name must be 1-255 characters'),
  body('htmlContent')
    .isString()
    .withMessage('htmlContent must be a string')
    .isLength({ min: 1 })
    .withMessage('htmlContent is required'),
  body('pageSize')
    .optional()
    .isIn(ALLOWED_PAGE_SIZES)
    .withMessage(`pageSize must be one of ${ALLOWED_PAGE_SIZES.join(', ')}`),
  body('pageOrientation')
    .optional()
    .isIn(ALLOWED_PAGE_ORIENTATIONS)
    .withMessage(`pageOrientation must be one of ${ALLOWED_PAGE_ORIENTATIONS.join(', ')}`),
];

const updateTemplateValidation = [
  param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters'),
  body('htmlContent')
    .optional()
    .isString()
    .withMessage('htmlContent must be a string')
    .isLength({ min: 1 })
    .withMessage('htmlContent cannot be empty when provided'),
  body('pageSize')
    .optional()
    .isIn(ALLOWED_PAGE_SIZES)
    .withMessage(`pageSize must be one of ${ALLOWED_PAGE_SIZES.join(', ')}`),
  body('pageOrientation')
    .optional()
    .isIn(ALLOWED_PAGE_ORIENTATIONS)
    .withMessage(`pageOrientation must be one of ${ALLOWED_PAGE_ORIENTATIONS.join(', ')}`),
];

const validateTemplateValidation = [
  body('htmlContent')
    .isString()
    .withMessage('htmlContent must be a string')
    .isLength({ min: 1 })
    .withMessage('htmlContent is required'),
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

// Read endpoints: require report_template.manage so only admins see the
// template library. End users triggering PDF generation never hit these -
// their flow goes through the generation endpoint (Phase 4).
router.get(
  '/',
  authorize('report_template.manage'),
  listTemplatesValidation,
  handleValidationErrors,
  getTemplates
);

router.get(
  '/by-config',
  authorize('report_template.manage'),
  byConfigValidation,
  handleValidationErrors,
  getTemplateByConfig
);

// Static catalog of every placeholder the render context exposes.
// Must be declared BEFORE `GET /:id` so "context-schema" doesn't hit the
// numeric-id validator.
router.get('/context-schema', authorize('report_template.manage'), getContextSchema);

// Render a template with sample (or real) case context, return raw HTML.
// Editor opens the response in a new tab so admins can see the filled-in
// output before saving. Fast — no Puppeteer; Handlebars only.
router.post('/preview-html', extendedTimeout, authorize('report_template.manage'), previewHtml);

router.post(
  '/validate',
  authorize('report_template.manage'),
  validateTemplateValidation,
  handleValidationErrors,
  validateTemplate
);

router.get(
  '/:id',
  authorize('report_template.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer')],
  handleValidationErrors,
  getTemplateById
);

router.post(
  '/',
  authorize('report_template.manage'),
  createTemplateValidation,
  handleValidationErrors,
  createTemplate
);

router.put(
  '/:id',
  authorize('report_template.manage'),
  updateTemplateValidation,
  handleValidationErrors,
  updateTemplate
);

router.delete(
  '/:id',
  authorize('report_template.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer')],
  handleValidationErrors,
  deleteTemplate
);

// ---------------------------------------------------------------------------
// Generation endpoints
// ---------------------------------------------------------------------------

// Reusable caseId validator accepting either a UUID or a numeric public case_id.
const caseIdParamValidation = [
  param('caseId').custom(value => {
    if (typeof value !== 'string') {
      throw new Error('caseId must be a string');
    }
    const trimmed = value.trim();
    const uuidOk =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed);
    const numOk = /^\d+$/.test(trimmed);
    if (!uuidOk && !numOk) {
      throw new Error('caseId must be a UUID or numeric case_id');
    }
    return true;
  }),
];

// Generate the PDF for a case. Permission is the same one used by other
// report-emission endpoints so existing roles with `report.generate` don't
// need a new permission wired up to download.
router.post(
  '/generate/:caseId',
  authorize('report.generate'),
  caseIdParamValidation,
  handleValidationErrors,
  reportBrandingUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'stamp', maxCount: 1 },
  ]),
  generateReport
);

// Admin-only: preview the Handlebars context for a given case as JSON.
// Useful while authoring a new template. Photo data URIs are stripped
// from the response to keep the payload small.
router.get(
  '/context/:caseId',
  authorize('report_template.manage'),
  caseIdParamValidation,
  handleValidationErrors,
  getContextPreview
);

// Convert a PDF layout into a Handlebars template via Claude / Gemini.
// Returns a draft HTML string the admin can review + save via the normal
// create endpoint. Gated on the same manage permission as other write ops.
//
// extendedTimeout(120s) — PDF analysis takes 20-60s typical, 90s p99; the
// default 30s timeout kills the request before the model can respond.
router.post(
  '/convert-from-pdf',
  extendedTimeout,
  authorize('report_template.manage'),
  pdfConverterUpload.single('file'),
  convertFromPdf
);

export default router;
