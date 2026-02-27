import express from 'express';
import { param, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { EnterpriseCache, EnterpriseCacheConfigs } from '@/middleware/enterpriseCache';
import {
  getFieldMonitoringStats,
  getFieldMonitoringUsers,
  getFieldMonitoringUserDetail,
} from '@/controllers/fieldMonitoringController';

const router = express.Router();

router.get(
  '/stats',
  authenticateToken,
  authorize('page.field_monitoring'),
  EnterpriseCache.create(EnterpriseCacheConfigs.fieldMonitoringStats),
  getFieldMonitoringStats
);

router.get(
  '/users',
  authenticateToken,
  authorize('page.field_monitoring'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be 1-200'),
    query('search').optional().isString().withMessage('search must be a string'),
    query('pincode').optional().isString().withMessage('pincode must be a string'),
    query('areaId').optional().isInt({ min: 1 }).withMessage('areaId must be a positive integer'),
    query('status')
      .optional()
      .isIn(['Offline', 'Submitted', 'At Location', 'Travelling', 'Idle'])
      .withMessage('status is invalid'),
  ],
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

export default router;
