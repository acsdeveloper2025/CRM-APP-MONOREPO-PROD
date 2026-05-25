import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import { EnterpriseCache, CacheInvalidationPatterns } from '@/middleware/enterpriseCache';
import {
  activateServiceZoneRule,
  createServiceZoneRule,
  deactivateServiceZoneRule,
  listServiceZoneRules,
  listServiceZones,
  updateServiceZoneRule,
  getServiceZoneRuleStats,
  exportServiceZoneRules,
} from '@/controllers/serviceZoneRulesController';

const router = express.Router();

router.use(authenticateToken);

// Reusable query-param validators for list + export (kept in lockstep with
// buildServiceZoneRulesWhereClause in serviceZoneRulesController.ts).
const szrQueryValidation = [
  query('clientId').optional().isInt({ min: 1 }).withMessage('Client ID must be a valid integer'),
  query('productId').optional().isInt({ min: 1 }).withMessage('Product ID must be a valid integer'),
  query('pincodeId').optional().isInt({ min: 1 }).withMessage('Pincode ID must be a valid integer'),
  query('areaId').optional().isInt({ min: 1 }).withMessage('Area ID must be a valid integer'),
  query('rateTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Rate type ID must be a valid integer'),
  query('verificationTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Verification type ID must be a valid integer'),
  query('isActive')
    .optional()
    .isIn(['true', 'false', 'all'])
    .withMessage("isActive must be 'true', 'false', or 'all'"),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('sortBy')
    .optional()
    .isIn(['name', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  ...szrQueryValidation,
];

const ruleValidation = [
  body('clientId').isInt({ min: 1 }).withMessage('Client ID must be a valid integer'),
  body('productId').isInt({ min: 1 }).withMessage('Product ID must be a valid integer'),
  body('pincodeId').isInt({ min: 1 }).withMessage('Pincode ID must be a valid integer'),
  body('areaId').isInt({ min: 1 }).withMessage('Area ID must be a valid integer'),
  body('rateTypeId').isInt({ min: 1 }).withMessage('Rate type ID must be a valid integer'),
  // Phase 7 (refactor 2026-05-10): VT now REQUIRED — DB col is NOT NULL.
  body('verificationTypeId')
    .isInt({ min: 1 })
    .withMessage('Verification type ID must be a valid integer'),
];

router.get(
  '/',
  authorize('page.masterdata'),
  listValidation,
  handleValidationErrors,
  listServiceZoneRules
);
router.get(
  '/service-zones',
  authorize('page.masterdata'),
  handleValidationErrors,
  listServiceZones
);

// 5-card stats — no filter params (global counters).
router.get('/stats', authorize('page.masterdata'), getServiceZoneRuleStats);

// xlsx export — MUST stay declared BEFORE /:id (Express matches in order).
router.get(
  '/export',
  authorize('page.masterdata'),
  szrQueryValidation,
  handleValidationErrors,
  exportServiceZoneRules
);

router.post(
  '/',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.serviceZoneRuleUpdate),
  ruleValidation,
  handleValidationErrors,
  createServiceZoneRule
);

router.put(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.serviceZoneRuleUpdate),
  [param('id').isInt({ min: 1 }).withMessage('Rule ID must be a valid integer'), ...ruleValidation],
  handleValidationErrors,
  updateServiceZoneRule
);

router.post(
  '/:id/activate',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.serviceZoneRuleUpdate),
  [param('id').isInt({ min: 1 }).withMessage('Rule ID must be a valid integer')],
  handleValidationErrors,
  activateServiceZoneRule
);

router.post(
  '/:id/deactivate',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.serviceZoneRuleUpdate),
  [param('id').isInt({ min: 1 }).withMessage('Rule ID must be a valid integer')],
  handleValidationErrors,
  deactivateServiceZoneRule
);

export default router;
