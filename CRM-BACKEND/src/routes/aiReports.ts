import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validateCaseRecordAccess } from '../middleware/recordAccess';
import {
  generateFormSubmissionReport,
  getFormSubmissionReport,
  testAIConnection,
  getReportStatistics,
} from '../controllers/aiReportsController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(authorize('report.generate'));

/**
 * @route POST /api/ai-reports/cases/:caseId/submissions/:submissionId/generate
 * @desc Generate AI-powered verification report for a form submission
 * @access Private
 */
router.post(
  '/cases/:caseId/submissions/:submissionId/generate',
  ...validateCaseRecordAccess,
  generateFormSubmissionReport
);

/**
 * @route GET /api/ai-reports/cases/:caseId/submissions/:submissionId
 * @desc Get existing AI report for a form submission
 * @access Private
 */
router.get(
  '/cases/:caseId/submissions/:submissionId',
  ...validateCaseRecordAccess,
  getFormSubmissionReport
);

/**
 * @route GET /api/ai-reports/test-connection
 * @desc Test Gemini AI connection
 * @access Private
 */
router.get('/test-connection', testAIConnection);

/**
 * @route GET /api/ai-reports/statistics
 * @desc Get AI report statistics
 * @access Private
 */
router.get('/statistics', getReportStatistics);

export default router;
