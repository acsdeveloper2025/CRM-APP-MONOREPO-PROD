import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import { validateCaseAccess } from '@/middleware/clientAccess';
import { validateCaseProductAccess } from '@/middleware/productAccess';
import { chainMiddleware } from '@/middleware/scopeAccess';
import {
  getEntry,
  createInstance,
  saveInstance,
  deleteInstance,
  completeCase,
} from '@/controllers/caseDataEntriesController';
import { getDataEntryDashboard } from '@/controllers/dataEntryDashboardController';
import { getMISData, exportMISData } from '@/controllers/dataEntryMISController';

const router = express.Router();

router.use(authenticateToken);

// Static routes MUST be before :caseId param routes.
router.get('/dashboard', authorize('case.view'), getDataEntryDashboard);
router.get('/mis', authorize('case.view'), getMISData);
router.get('/mis/export', authorize('case.view'), exportMISData);

// ---------------------------------------------------------------------------
// Composed case access: validates that the authenticated user has both
// CLIENT and PRODUCT access to the case referenced by :caseId. This
// replaces the inline checkCaseAccess helper previously duplicated in
// every controller and reuses the same scope machinery as the rest of
// the cases module (see validateCaseCreationAccess in clientAccess.ts).
// ---------------------------------------------------------------------------
const requireCaseAccess = chainMiddleware(validateCaseAccess, validateCaseProductAccess);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

// Accepts either the UUID primary key or the numeric auto-increment
// `case_id` — matches what resolveCaseByIdentifier understands and what
// the client/product scope middleware already accepts, so a case that
// passes one check will always pass the others.
const caseIdValidation = [
  param('caseId')
    .custom(v => typeof v === 'string' && (/^\d+$/.test(v) || /^[0-9a-fA-F-]{36}$/.test(v)))
    .withMessage('Case ID must be a UUID or a positive integer'),
];

const instanceIndexValidation = [
  param('instanceIndex')
    .isInt({ min: 0 })
    .withMessage('Instance index must be a non-negative integer'),
];

const saveValidation = [
  body('data').isObject().withMessage('Data must be an object'),
  body('templateVersion')
    .optional()
    .isInt({ min: 1 })
    .withMessage('templateVersion must be a positive integer'),
];

const createInstanceValidation = [
  body('instanceLabel')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('instanceLabel must be 1-100 characters'),
  body('verificationTaskId')
    .optional()
    .isUUID()
    .withMessage('verificationTaskId must be a valid UUID'),
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get(
  '/:caseId',
  authorize('case.view'),
  caseIdValidation,
  handleValidationErrors,
  requireCaseAccess,
  getEntry
);

router.post(
  '/:caseId/instances',
  authorize('case.create'),
  caseIdValidation,
  createInstanceValidation,
  handleValidationErrors,
  requireCaseAccess,
  createInstance
);

router.put(
  '/:caseId/instances/:instanceIndex',
  authorize('case.update'),
  caseIdValidation,
  instanceIndexValidation,
  saveValidation,
  handleValidationErrors,
  requireCaseAccess,
  saveInstance
);

router.delete(
  '/:caseId/instances/:instanceIndex',
  authorize('case.update'),
  caseIdValidation,
  instanceIndexValidation,
  handleValidationErrors,
  requireCaseAccess,
  deleteInstance
);

router.post(
  '/:caseId/complete',
  authorize('case.update'),
  caseIdValidation,
  handleValidationErrors,
  requireCaseAccess,
  completeCase
);

export default router;
