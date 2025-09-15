import { Router } from 'express';
import { authenticateToken, requireFieldOrHigher } from '@/middleware/auth';
import { MobileFormController } from '@/controllers/mobileFormController';

const router = Router();

// Apply authentication
router.use(authenticateToken);
router.use(requireFieldOrHigher);

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

// Get form submissions for a case (for web frontend)
router.get('/cases/:caseId/submissions', MobileFormController.getCaseFormSubmissions);

export default router;
