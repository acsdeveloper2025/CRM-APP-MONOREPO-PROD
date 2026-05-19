import express from 'express';
import { param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validation';
import { validateCaseRecordAccess } from '../middleware/recordAccess';
import {
  generateTemplateReport,
  getTemplateReport,
  getCaseTemplateReports,
  deleteTemplateReport,
} from '../controllers/templateReportsController';

const router = express.Router();

/**
 * Template Reports Routes
 * All routes are protected with authentication middleware.
 *
 * T1-5 (audit 2026-05-17): caseId / submissionId / reportId are UUIDs;
 * reject non-UUIDs at the edge.
 */

const caseAndSubmissionValidation = [
  param('caseId').isUUID().withMessage('caseId must be a UUID'),
  param('submissionId').isUUID().withMessage('submissionId must be a UUID'),
];

const caseOnlyValidation = [param('caseId').isUUID().withMessage('caseId must be a UUID')];

const reportIdValidation = [param('reportId').isUUID().withMessage('reportId must be a UUID')];

// Generate template-based report for a specific form submission
router.post(
  '/cases/:caseId/submissions/:submissionId/generate',
  authenticateToken,
  authorize('report.generate'),
  validate(caseAndSubmissionValidation),
  ...validateCaseRecordAccess,
  generateTemplateReport
);

// Get existing template report for a specific form submission
router.get(
  '/cases/:caseId/submissions/:submissionId',
  authenticateToken,
  authorize('report.download'),
  validate(caseAndSubmissionValidation),
  ...validateCaseRecordAccess,
  getTemplateReport
);

// Get all template reports for a case
router.get(
  '/cases/:caseId',
  authenticateToken,
  authorize('report.download'),
  validate(caseOnlyValidation),
  ...validateCaseRecordAccess,
  getCaseTemplateReports
);

// Delete a specific template report
router.delete(
  '/reports/:reportId',
  authenticateToken,
  authorize('report.generate'),
  validate(reportIdValidation),
  deleteTemplateReport
);

export default router;
