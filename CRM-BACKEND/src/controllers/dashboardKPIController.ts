import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { DashboardKPIService } from '../services/dashboardKPIService';
import { logger } from '../utils/logger';
import { getAssignedClientIds } from '../middleware/clientAccess';
import { getAssignedProductIds } from '../middleware/productAccess';
import { isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';

export class DashboardKPIController {
  /**
   * GET /api/dashboard/kpi
   * Returns the new Unified Verification Operations KPI response.
   * Replaces legacy dashboard endpoints.
   */
  static async getKPIs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId, agentId, dateFrom, dateTo } = req.query;
      let clientIds: number[] | undefined;
      let productIds: number[] | undefined;
      const hierarchyAgentIds = req.user?.id
        ? await getScopedOperationalUserIds(req.user.id)
        : undefined;

      if (req.user?.id && isScopedOperationsUser(req.user)) {
        const [assignedClientIds, assignedProductIds] = await Promise.all([
          getAssignedClientIds(req.user.id),
          getAssignedProductIds(req.user.id),
        ]);
        clientIds = assignedClientIds && assignedClientIds.length > 0 ? assignedClientIds : [-1];
        productIds =
          assignedProductIds && assignedProductIds.length > 0 ? assignedProductIds : [-1];
      }

      // Convert query params to expected types
      const filters = {
        clientId: clientId ? Number(clientId) : undefined,
        agentId: typeof agentId === 'string' ? agentId : undefined,
        agentIds: typeof agentId === 'string' ? undefined : hierarchyAgentIds,
        clientIds,
        productIds,
        dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
        dateTo: typeof dateTo === 'string' ? dateTo : undefined,
      };

      const kpis = await DashboardKPIService.getKPIs(filters);

      res.json({
        success: true,
        data: kpis,
      });
    } catch (error) {
      logger.error('Error fetching Dashboard KPIs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard KPIs',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
}
