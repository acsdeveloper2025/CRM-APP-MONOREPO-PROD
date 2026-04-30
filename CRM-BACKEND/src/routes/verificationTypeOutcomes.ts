/**
 * F2.7.1 — exposes verification_type_outcomes for client hydration.
 * Authenticated; no special permission needed (reference data, every
 * authenticated user can read).
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { listVerificationTypeOutcomes } from '../controllers/verificationTypeOutcomesController';

const router = Router();
router.use(authenticateToken);

router.get('/', listVerificationTypeOutcomes);

export default router;
