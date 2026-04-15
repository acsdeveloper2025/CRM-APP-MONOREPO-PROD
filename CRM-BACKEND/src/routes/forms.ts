// Disabled unbound-method rule for this file as it uses method references in routes
import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
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

router.get('/auto-save/:caseId', (req, res) => {
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
router.get('/cases/:caseId/submissions', (req, res) =>
  MobileFormController.getCaseFormSubmissions(req as AuthenticatedRequest, res)
);

export default router;
