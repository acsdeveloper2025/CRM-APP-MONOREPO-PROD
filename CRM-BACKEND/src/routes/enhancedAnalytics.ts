import express from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Role } from '../types/auth';
import {
  getEnhancedFormSubmissions,
  getEnhancedAgentPerformance,
  getEnhancedCaseAnalytics,
  getFormValidationAnalytics
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
router.get('/form-submissions',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  getEnhancedFormSubmissions
);

// Enhanced Agent Performance Analytics
// GET /api/enhanced-analytics/agent-performance
router.get('/agent-performance',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  getEnhancedAgentPerformance
);

// Enhanced Case Analytics with Timeline
// GET /api/enhanced-analytics/case-analytics
router.get('/case-analytics',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  getEnhancedCaseAnalytics
);

// Form Validation Analytics
// GET /api/enhanced-analytics/form-validation
router.get('/form-validation',
  requireRole([Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  getFormValidationAnalytics
);

// Agent-specific performance (for field agents to view their own data)
// GET /api/enhanced-analytics/my-performance
router.get('/my-performance',
  requireRole([Role.FIELD_AGENT, Role.ADMIN, Role.BACKEND_USER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res, next) => {
    // For field agents, restrict to their own data
    if (req.user?.role === Role.FIELD_AGENT) {
      req.query.agentId = req.user.id;
    }
    next();
  },
  getEnhancedAgentPerformance
);

export default router;
