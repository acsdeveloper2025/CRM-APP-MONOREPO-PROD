import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import { validateCaseAccess, validateClientAccess } from '@/middleware/clientAccess';
import { validateCaseProductAccess, validateProductAccess } from '@/middleware/productAccess';
import { chainMiddleware } from '@/middleware/scopeAccess';
import {
  getEntry,
  createInstance,
  saveInstance,
  deleteInstance,
  completeCase,
} from '@/controllers/caseDataEntriesController';
import { getDataEntryDashboard } from '@/controllers/dataEntryDashboardController';
import { getMISData, getMISStats, exportMISData } from '@/controllers/dataEntryMISController';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '@/middleware/enterpriseCache';

const router = express.Router();

router.use(authenticateToken);

// Static routes MUST be before :caseId param routes.
// clientId/productId query-param scope validation (closes R-1 query-param
// bypass per project_scope_control_audit_2026_05_14.md): scoped-ops users
// must have the requested clientId and productId in their assignments.
// Validators are no-ops for system-bypass users and when the params are
// absent.
router.get(
  '/dashboard',
  authorize('case.view'),
  validateClientAccess('query'),
  validateProductAccess('query'),
  getDataEntryDashboard
);
// /mis/stats MUST come before /mis (Express routes match by declaration
// order — /mis would also match /mis/stats otherwise). Cached via
// EnterpriseCacheConfigs.analytics (baseUrl+path keyGen, collision-safe).
router.get(
  '/mis/stats',
  authorize('case.view'),
  validateClientAccess('query'),
  validateProductAccess('query'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getMISStats
);
router.get(
  '/mis/export',
  authorize('case.view'),
  validateClientAccess('query'),
  validateProductAccess('query'),
  exportMISData
);
router.get(
  '/mis',
  authorize('case.view'),
  validateClientAccess('query'),
  validateProductAccess('query'),
  getMISData
);

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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
  caseIdValidation,
  createInstanceValidation,
  handleValidationErrors,
  requireCaseAccess,
  createInstance
);

router.put(
  '/:caseId/instances/:instanceIndex',
  authorize('case.update'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
  caseIdValidation,
  instanceIndexValidation,
  handleValidationErrors,
  requireCaseAccess,
  deleteInstance
);

router.post(
  '/:caseId/complete',
  authorize('case.update'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
  caseIdValidation,
  handleValidationErrors,
  requireCaseAccess,
  completeCase
);

export default router;
