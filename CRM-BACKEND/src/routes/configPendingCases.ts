import { Router } from 'express';
import { ConfigPendingCasesController } from '@/controllers/configPendingCasesController';
import { authenticateToken, requireRole } from '@/middleware/auth';
import { Role } from '@/types/auth';

const router = Router();

// All routes require authentication and admin/manager role
router.use(authenticateToken);
router.use(requireRole([Role.ADMIN, Role.MANAGER]));

/**
 * @route   GET /api/admin/config-pending-cases
 * @desc    List all cases in CONFIG_PENDING state
 * @access  Admin, Manager
 */
router.get('/', (req, res) => ConfigPendingCasesController.listConfigPendingCases(req, res));

/**
 * @route   GET /api/admin/config-pending-cases/:caseId
 * @desc    Get details for a specific config pending case
 * @access  Admin, Manager
 */
router.get('/:caseId', (req, res) =>
  ConfigPendingCasesController.getConfigPendingCaseDetails(req, res)
);

/**
 * @route   POST /api/admin/config-pending-cases/:caseId/retry
 * @desc    Retry processing for a quarantined case
 * @access  Admin, Manager
 */
router.post('/:caseId/retry', (req, res) => ConfigPendingCasesController.retryProcessing(req, res));

export default router;
