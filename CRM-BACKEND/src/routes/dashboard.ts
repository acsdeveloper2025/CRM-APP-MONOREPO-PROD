import express from 'express';
import { body, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getDashboardData,
  getChartData,
  getRecentActivities,
  getPerformanceMetrics,
  getDashboardStats,
  getCaseStatusDistribution,
  getMonthlyTrends
} from '@/controllers/dashboardController';

const router = express.Router();

// Validation schemas
const dashboardQueryValidation = [
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year'])
    .withMessage('Period must be one of: week, month, quarter, year'),
  query('clientId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Client ID must not be empty'),
  query('userId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('User ID must not be empty'),
];

const monthlyTrendsValidation = [
  query('months')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Months must be between 1 and 12'),
];

const recentActivitiesValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];

const topPerformersValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20'),
];

const exportValidation = [
  body('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year'])
    .withMessage('Period must be one of: week, month, quarter, year'),
  body('format')
    .optional()
    .isIn(['PDF', 'EXCEL', 'CSV'])
    .withMessage('Format must be one of: PDF, EXCEL, CSV'),
  body('clientId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Client ID must not be empty'),
  body('userId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('User ID must not be empty'),
];

// Dashboard routes
router.get('/', 
  authenticateToken, 
  dashboardQueryValidation, 
  validate, 
  getDashboardData
);

router.get('/charts',
  authenticateToken,
  dashboardQueryValidation,
  validate,
  getChartData
);

// Dashboard statistics
router.get('/stats',
  authenticateToken,
  dashboardQueryValidation,
  validate,
  getDashboardStats
);

// Case status distribution
router.get('/case-status-distribution',
  authenticateToken,
  dashboardQueryValidation,
  validate,
  getCaseStatusDistribution
);

// Monthly trends
router.get('/monthly-trends',
  authenticateToken,
  monthlyTrendsValidation,
  validate,
  getMonthlyTrends
);

// TODO: Implement client stats
// router.get('/client-stats',
//   authenticateToken,
//   dashboardQueryValidation,
//   validate,
//   getClientStats
// );

router.get('/recent-activities', 
  authenticateToken, 
  recentActivitiesValidation, 
  validate, 
  getRecentActivities
);

router.get('/performance-metrics', 
  authenticateToken, 
  dashboardQueryValidation, 
  validate, 
  getPerformanceMetrics
);

// TODO: Implement remaining dashboard functions
// router.get('/turnaround-times',
//   authenticateToken,
//   dashboardQueryValidation,
//   validate,
//   getTurnaroundTimes
// );

// router.get('/top-performers',
//   authenticateToken,
//   topPerformersValidation,
//   validate,
//   getTopPerformers
// );

// router.get('/upcoming-deadlines',
//   authenticateToken,
//   getUpcomingDeadlines
// );

// router.get('/alerts',
//   authenticateToken,
//   getAlerts
// );

// router.post('/export',
//   authenticateToken,
//   exportValidation,
//   validate,
//   exportDashboardReport
// );

export default router;
