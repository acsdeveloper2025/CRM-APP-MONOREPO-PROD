// Disabled require-await rule for enhanced analytics routes as some async middleware don't directly await
import express from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth';
import { authorize } from '@/middleware/authorize';
import {
  getEnhancedFormSubmissions,
  getEnhancedAgentPerformance,
  getEnhancedCaseAnalytics,
  getFormValidationAnalytics,
} from '../controllers/enhancedAnalyticsController';

const router = express.Router();

/**
 * Enhanced Analytics Routes
 * Phase 2: Leveraging new database schema for advanced analytics
 */

// Apply authentication to all routes
router.use(authenticateToken);

// Enhanced Form Submissions Analytics
// GET /api/enhanced-analytics/form-submissions
router.get('/form-submissions', authorize('dashboard.view'), getEnhancedFormSubmissions);

// Enhanced Agent Performance Analytics
// GET /api/enhanced-analytics/agent-performance
router.get('/agent-performance', authorize('dashboard.view'), getEnhancedAgentPerformance);

// Enhanced Case Analytics with Timeline
// GET /api/enhanced-analytics/case-analytics
router.get('/case-analytics', authorize('dashboard.view'), getEnhancedCaseAnalytics);

// Form Validation Analytics
// GET /api/enhanced-analytics/form-validation
router.get('/form-validation', authorize('dashboard.view'), getFormValidationAnalytics);

// Agent-specific performance (for field agents to view their own data)
// GET /api/enhanced-analytics/my-performance
router.get(
  '/my-performance',
  authorize('dashboard.view'),
  (req: AuthenticatedRequest, res, next) => {
    // For mobile/field workflows, agent can still be pinned by client request.
    // This route now relies on downstream filtering and RBAC permission.
    next();
  },
  getEnhancedAgentPerformance
);

export default router;
