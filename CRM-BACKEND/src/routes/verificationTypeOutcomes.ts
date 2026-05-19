/**
 * F2.7.1 — exposes verification_type_outcomes for client hydration.
 * Authenticated; no special permission needed (reference data, every
 * authenticated user can read).
 *
 * T1-5 (audit 2026-05-17): single GET with no inputs to validate.
 * Adding the validate() middleware is no-op today but the explicit
 * empty chain documents the audit pass and future-proofs against
 * silently accepting unexpected params if a query filter is added.
 */
import { Router } from 'express';
import { query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { listVerificationTypeOutcomes } from '../controllers/verificationTypeOutcomesController';

const router = Router();
router.use(authenticateToken);

router.get(
  '/',
  validate([
    // Reserve room for future per-type filters without an unsafe handler default.
    query('verificationTypeId').optional().isInt({ min: 1 }),
  ]),
  listVerificationTypeOutcomes
);

export default router;
