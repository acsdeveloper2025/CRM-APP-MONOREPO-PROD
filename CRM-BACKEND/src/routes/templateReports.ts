import express from 'express';
import { param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validation';
import { validateCaseRecordAccess } from '../middleware/recordAccess';
import { EnterpriseCache, CacheInvalidationPatterns } from '../middleware/enterpriseCache';
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

// 2026-05-19 revision: :caseId accepts UUID OR integer business case_id.
// :submissionId and :reportId remain UUID-only (form_submissions.id +
// template_reports.id are both gen_random_uuid).
const UUID_OR_INT_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[1-9]\d*)$/i;
const caseIdParam = param('caseId')
  .matches(UUID_OR_INT_RE)
  .withMessage('caseId must be a UUID or positive integer');

const caseAndSubmissionValidation = [
  caseIdParam,
  param('submissionId').isUUID().withMessage('submissionId must be a UUID'),
];

const caseOnlyValidation = [caseIdParam];

const reportIdValidation = [param('reportId').isUUID().withMessage('reportId must be a UUID')];

// Generate template-based report for a specific form submission
router.post(
  '/cases/:caseId/submissions/:submissionId/generate',
  authenticateToken,
  authorize('report.generate'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.reportTemplateUpdate),
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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.reportTemplateUpdate),
  validate(reportIdValidation),
  deleteTemplateReport
);

export default router;
