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

// T1-5 (audit 2026-05-17): caseId is a UUID; reject non-UUID inputs
// at the edge so the handler can rely on its shape.
router.get(
  '/auto-save/:caseId',
  validate([param('caseId').isUUID().withMessage('caseId must be a UUID')]),
  (req, res) => {
    res.json({
      success: true,
      message: 'Retrieve saved forms - to be implemented',
      data: [],
    });
  }
);

// Get form submissions for a case (for web frontend).
// Wrapped in an arrow handler so the AuthenticatedRequest narrowing
// (the handler reads req.user) doesn't violate Express router's
// contravariant Request signature under strictFunctionTypes.
router.get(
  '/cases/:caseId/submissions',
  validate([param('caseId').isUUID().withMessage('caseId must be a UUID')]),
  (req, res) => MobileFormController.getCaseFormSubmissions(req as AuthenticatedRequest, res)
);

export default router;
