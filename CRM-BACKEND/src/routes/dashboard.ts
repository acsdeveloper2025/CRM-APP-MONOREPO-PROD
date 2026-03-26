// Dashboard routes - TAT Monitoring feature added
import express from 'express';
import { body, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  getDashboardData,
  getChartData,
  getRecentActivities,
  getPerformanceMetrics,
  getDashboardStats,
  getCaseStatusDistribution,
  getMonthlyTrends,
  getOverdueTasks,
  getTATStats,
} from '@/controllers/dashboardController';

import { DashboardKPIController } from '../controllers/dashboardKPIController';
import { EnterpriseCache, EnterpriseCacheConfigs } from '../middleware/enterpriseCache';

const router = express.Router();

// New KPI Engine Endpoint
router.get(
  '/kpi',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  (req, res, next) => DashboardKPIController.getKPIs(req, res).catch(next)
);

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
  query('userId').optional().trim().isLength({ min: 1 }).withMessage('User ID must not be empty'),
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

const _topPerformersValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20'),
];

const _exportValidation = [
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
  body('userId').optional().trim().isLength({ min: 1 }).withMessage('User ID must not be empty'),
];

// Dashboard routes
router.get(
  '/',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  dashboardQueryValidation,
  validate,
  getDashboardData
);

router.get(
  '/charts',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  dashboardQueryValidation,
  validate,
  getChartData
);

// Dashboard statistics
router.get(
  '/stats',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  dashboardQueryValidation,
  validate,
  getDashboardStats
);

// Case status distribution
router.get(
  '/case-status-distribution',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  dashboardQueryValidation,
  validate,
  getCaseStatusDistribution
);

// Monthly trends
router.get(
  '/monthly-trends',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
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

router.get(
  '/recent-activities',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  recentActivitiesValidation,
  validate,
  getRecentActivities
);

router.get(
  '/performance-metrics',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  dashboardQueryValidation,
  validate,
  getPerformanceMetrics
);

// TAT Monitoring routes
router.get(
  '/overdue-tasks',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  [
    query('threshold')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Threshold must be a positive integer'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500'),
    query('sortBy')
      .optional()
      .isIn(['days_overdue', 'task_number', 'customer_name', 'status', 'priority', 'created_at'])
      .withMessage('Invalid sort column'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
  ],
  validate,
  getOverdueTasks
);

router.get(
  '/tat-stats',
  authenticateToken,
  authorize('dashboard.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.dashboard),
  getTATStats
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
