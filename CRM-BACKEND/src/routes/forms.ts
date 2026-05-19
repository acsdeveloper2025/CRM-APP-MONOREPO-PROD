// Disabled unbound-method rule for this file as it uses method references in routes
import { Router } from 'express';
import { param } from 'express-validator';
import { authenticateToken, type AuthenticatedRequest } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { MobileFormController } from '@/controllers/mobileFormController';

const router = Router();

// Apply authentication
router.use(authenticateToken);
router.use(authorize('case.view'));

// Placeholder routes - will be implemented
router.post('/residence-verification', (req, res) => {
  res.json({
    success: true,
    message: 'Submit residence verification form - to be implemented',
  });
});

router.post('/office-verification', (req, res) => {
  res.json({
    success: true,
    message: 'Submit office verification form - to be implemented',
  });
});

router.post('/auto-save', (req, res) => {
  res.json({
    success: true,
    message: 'Auto-save form - to be implemented',
  });
});

// T1-5 (audit 2026-05-17, revised 2026-05-19): :caseId accepts BOTH the
// UUID primary key AND the integer business case_id (handler resolves
// both — see mobileFormController.getCaseFormSubmissions:1979 comment
// "handle both UUID and business caseId").
const caseIdParamValidator = param('caseId')
  .matches(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[1-9]\d*)$/i)
  .withMessage('caseId must be a UUID or positive integer');

router.get('/auto-save/:caseId', validate([caseIdParamValidator]), (req, res) => {
  res.json({
    success: true,
    message: 'Retrieve saved forms - to be implemented',
    data: [],
  });
});

// Get form submissions for a case (for web frontend).
// Wrapped in an arrow handler so the AuthenticatedRequest narrowing
// (the handler reads req.user) doesn't violate Express router's
// contravariant Request signature under strictFunctionTypes.
router.get('/cases/:caseId/submissions', validate([caseIdParamValidator]), (req, res) =>
  MobileFormController.getCaseFormSubmissions(req as AuthenticatedRequest, res)
);

export default router;
