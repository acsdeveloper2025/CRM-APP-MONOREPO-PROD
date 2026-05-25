/**
 * A2.2 (audit 2026-05-25): revoke_reasons master CRUD routes.
 *
 * `/active` lives at the same mount as the canonical list — it MUST be
 * declared BEFORE `/:id` (Express matches in declaration order).
 */
import express from 'express';
import { body, param, query as queryValidator } from 'express-validator';
import { auth } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { handleValidationErrors } from '../middleware/validation';
import {
  getRevokeReasons,
  getActiveRevokeReasons,
  getRevokeReasonById,
  createRevokeReason,
  updateRevokeReason,
} from '../controllers/revokeReasonsController';

const router = express.Router();

router.use(auth);

const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('Revoke reason ID must be a positive integer'),
];

const listQueryValidation = [
  queryValidator('isActive').optional().isIn(['true', 'false', 'all']),
  queryValidator('sortBy')
    .optional()
    .isIn(['sortOrder', 'label', 'code', 'createdAt', 'updatedAt']),
  queryValidator('sortOrder').optional().isIn(['asc', 'desc']),
];

const createValidation = [
  body('code').trim().isLength({ min: 1, max: 40 }).withMessage('Code must be 1-40 characters'),
  body('label').trim().isLength({ min: 1, max: 100 }).withMessage('Label must be 1-100 characters'),
  body('sortOrder').optional().isInt({ min: 0 }).toInt(),
  body('isActive').optional().isBoolean(),
];

const updateValidation = [
  ...idParamValidation,
  body('label')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Label must be 1-100 characters'),
  body('sortOrder').optional().isInt({ min: 0 }).toInt(),
  body('isActive').optional().isBoolean(),
];

// GET /api/revoke-reasons/active — for FE/mobile dropdown consumption.
// MUST be declared BEFORE /:id.
router.get('/active', getActiveRevokeReasons as express.RequestHandler);

// GET /api/revoke-reasons — admin list
router.get(
  '/',
  authorize('user.view'),
  listQueryValidation,
  handleValidationErrors,
  getRevokeReasons as express.RequestHandler
);

// GET /api/revoke-reasons/:id — admin detail
router.get(
  '/:id',
  authorize('user.view'),
  idParamValidation,
  handleValidationErrors,
  getRevokeReasonById as express.RequestHandler
);

// POST /api/revoke-reasons — admin create
router.post(
  '/',
  authorize('settings.manage'),
  createValidation,
  handleValidationErrors,
  createRevokeReason as express.RequestHandler
);

// PUT /api/revoke-reasons/:id — admin update (code is immutable)
router.put(
  '/:id',
  authorize('settings.manage'),
  updateValidation,
  handleValidationErrors,
  updateRevokeReason as express.RequestHandler
);

export default router;
