import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import {
  activateServiceZoneRule,
  createServiceZoneRule,
  deactivateServiceZoneRule,
  listServiceZoneRules,
  listServiceZones,
  updateServiceZoneRule,
} from '@/controllers/serviceZoneRulesController';

const router = express.Router();

router.use(authenticateToken);

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('clientId').optional().isInt({ min: 1 }).withMessage('Client ID must be a valid integer'),
  query('productId').optional().isInt({ min: 1 }).withMessage('Product ID must be a valid integer'),
  query('pincodeId').optional().isInt({ min: 1 }).withMessage('Pincode ID must be a valid integer'),
  query('areaId').optional().isInt({ min: 1 }).withMessage('Area ID must be a valid integer'),
  query('serviceZoneId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Service zone ID must be a valid integer'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('search').optional().isString().withMessage('Search must be a string'),
];

const ruleValidation = [
  body('clientId').isInt({ min: 1 }).withMessage('Client ID must be a valid integer'),
  body('productId').isInt({ min: 1 }).withMessage('Product ID must be a valid integer'),
  body('pincodeId').isInt({ min: 1 }).withMessage('Pincode ID must be a valid integer'),
  body('areaId').isInt({ min: 1 }).withMessage('Area ID must be a valid integer'),
  body('serviceZoneId').isInt({ min: 1 }).withMessage('Service zone ID must be a valid integer'),
];

router.get('/', listValidation, handleValidationErrors, listServiceZoneRules);
router.get('/service-zones', handleValidationErrors, listServiceZones);

router.post(
  '/',
  authorize('settings.manage'),
  ruleValidation,
  handleValidationErrors,
  createServiceZoneRule
);

router.put(
  '/:id',
  authorize('settings.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Rule ID must be a valid integer'), ...ruleValidation],
  handleValidationErrors,
  updateServiceZoneRule
);

router.post(
  '/:id/activate',
  authorize('settings.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Rule ID must be a valid integer')],
  handleValidationErrors,
  activateServiceZoneRule
);

router.post(
  '/:id/deactivate',
  authorize('settings.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Rule ID must be a valid integer')],
  handleValidationErrors,
  deactivateServiceZoneRule
);

export default router;
