import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
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
 * All routes are protected with authentication middleware
 */

// Generate template-based report for a specific form submission
router.post(
  '/cases/:caseId/submissions/:submissionId/generate',
  authenticateToken,
  authorize('report.generate'),
  ...validateCaseRecordAccess,
  generateTemplateReport
);

// Get existing template report for a specific form submission
router.get(
  '/cases/:caseId/submissions/:submissionId',
  authenticateToken,
  authorize('report.download'),
  ...validateCaseRecordAccess,
  getTemplateReport
);

// Get all template reports for a case
router.get(
  '/cases/:caseId',
  authenticateToken,
  authorize('report.download'),
  ...validateCaseRecordAccess,
  getCaseTemplateReports
);

// Delete a specific template report
router.delete(
  '/reports/:reportId',
  authenticateToken,
  authorize('report.generate'),
  deleteTemplateReport
);

export default router;
