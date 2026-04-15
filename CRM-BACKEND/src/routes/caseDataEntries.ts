import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getEntry,
  saveEntry,
  updateEntry,
  completeCase,
} from '@/controllers/caseDataEntriesController';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const caseIdValidation = [param('caseId').isUUID().withMessage('Case ID must be a valid UUID')];

const saveEntryValidation = [
  ...caseIdValidation,
  body('data').isObject().withMessage('Data must be an object'),
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Get data entry for a case (entry + template + fields)
router.get('/:caseId', authorize('case.view'), caseIdValidation, handleValidationErrors, getEntry);

// Create/save data entry for a case
router.post(
  '/:caseId',
  authorize('case.create'),
  saveEntryValidation,
  handleValidationErrors,
  saveEntry
);

// Update data entry
router.put(
  '/:caseId',
  authorize('case.update'),
  saveEntryValidation,
  handleValidationErrors,
  updateEntry
);

// Complete case
router.post(
  '/:caseId/complete',
  authorize('case.update'),
  caseIdValidation,
  handleValidationErrors,
  completeCase
);

export default router;
