import express from 'express';
import { param, body } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  getUserTerritoryAssignments,
  bulkSaveTerritoryAssignments,
} from '../controllers/userTerritoryController';
import { EnterpriseCache, CacheInvalidationPatterns } from '../middleware/enterpriseCache';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// GET /api/users/:userId/territory-assignments
// Fetch user's territory assignments (pincodes and areas)
router.get(
  '/:userId/territory-assignments',
  [param('userId').isUUID().withMessage('Valid user ID is required')],
  validate,
  getUserTerritoryAssignments
);

// POST /api/users/:userId/territory-assignments/bulk
// Bulk save territory assignments
router.post(
  '/:userId/territory-assignments/bulk',
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('assignments').isArray({ min: 1 }).withMessage('assignments array is required'),
    body('assignments.*.pincodeId')
      .isInt({ min: 1 })
      .withMessage('Each assignment must have a valid pincodeId'),
    body('assignments.*.areaIds')
      .isArray()
      .withMessage('Each assignment must have an areaIds array'),
    body('assignments.*.areaIds.*')
      .isInt({ min: 1 })
      .withMessage('Each areaId must be a valid integer'),
  ],
  validate,
  bulkSaveTerritoryAssignments
);

export default router;
