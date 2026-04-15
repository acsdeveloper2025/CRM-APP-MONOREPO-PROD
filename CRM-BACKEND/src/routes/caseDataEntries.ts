import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getEntry,
  createInstance,
  saveInstance,
  deleteInstance,
  completeCase,
} from '@/controllers/caseDataEntriesController';

const router = express.Router();

router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const caseIdValidation = [param('caseId').isUUID().withMessage('Case ID must be a valid UUID')];

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
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// List all instances + template for a case
router.get('/:caseId', authorize('case.view'), caseIdValidation, handleValidationErrors, getEntry);

// Create a new instance (auto-assigns next instance_index)
router.post(
  '/:caseId/instances',
  authorize('case.create'),
  caseIdValidation,
  createInstanceValidation,
  handleValidationErrors,
  createInstance
);

// Save (draft) data for a specific instance
router.put(
  '/:caseId/instances/:instanceIndex',
  authorize('case.update'),
  caseIdValidation,
  instanceIndexValidation,
  saveValidation,
  handleValidationErrors,
  saveInstance
);

// Delete a not-yet-completed instance
router.delete(
  '/:caseId/instances/:instanceIndex',
  authorize('case.update'),
  caseIdValidation,
  instanceIndexValidation,
  handleValidationErrors,
  deleteInstance
);

// Complete the case — validates every instance fully
router.post(
  '/:caseId/complete',
  authorize('case.update'),
  caseIdValidation,
  handleValidationErrors,
  completeCase
);

export default router;
