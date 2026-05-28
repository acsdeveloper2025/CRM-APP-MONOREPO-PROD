import express from 'express';
import { param, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { EnterpriseCache, EnterpriseCacheConfigs } from '@/middleware/enterpriseCache';
import { exportRateLimit } from '@/middleware/rateLimiter';
import {
  getFieldMonitoringStats,
  getFieldMonitoringUsers,
  getFieldMonitoringUserDetail,
  requestUserLocation,
  exportFieldMonitoring,
} from '@/controllers/fieldMonitoringController';

const router = express.Router();

const rosterListValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be 1-500'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('pincode').optional().isString().withMessage('pincode must be a string'),
  query('areaId').optional().isInt({ min: 1 }).withMessage('areaId must be a positive integer'),
  query('status')
    .optional()
    .isIn(['Offline', 'Submitted', 'At Location', 'Travelling', 'Idle'])
    .withMessage('status is invalid'),
  query('sortBy').optional().isIn(['name', 'createdAt']).withMessage('sortBy is invalid'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
  query('createdFrom')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('createdFrom must be ISO 8601'),
  query('createdTo')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('createdTo must be ISO 8601'),
];

router.get(
  '/stats',
  authenticateToken,
  authorize('page.field_monitoring'),
  EnterpriseCache.create(EnterpriseCacheConfigs.fieldMonitoringStats),
  getFieldMonitoringStats
);

// /export MUST be declared BEFORE /users/:id (Express matches in order).
router.get(
  '/export',
  authenticateToken,
  authorize('page.field_monitoring'),
  exportRateLimit,
  rosterListValidation,
  validate,
  exportFieldMonitoring
);

router.get(
  '/users',
  authenticateToken,
  authorize('page.field_monitoring'),
  rosterListValidation,
  validate,
  EnterpriseCache.create(EnterpriseCacheConfigs.fieldMonitoringRoster),
  getFieldMonitoringUsers
);

router.get(
  '/users/:id',
  authenticateToken,
  authorize('page.field_monitoring'),
  [param('id').isUUID().withMessage('id must be a valid user ID')],
  validate,
  EnterpriseCache.create(EnterpriseCacheConfigs.fieldMonitoringDetails),
  getFieldMonitoringUserDetail
);

// 2026-05-13: on-demand location ping. Admin → silent FCM → mobile
// captures GPS → POSTs to /api/mobile/location/capture (existing).
// Returns 202 immediately; actual location row arrives async via the
// capture flow + WebSocket event in subsequent commit.
router.post(
  '/users/:id/request-location',
  authenticateToken,
  authorize('page.field_monitoring'),
  [param('id').isUUID().withMessage('id must be a valid user ID')],
  validate,
  requestUserLocation
);

export default router;
