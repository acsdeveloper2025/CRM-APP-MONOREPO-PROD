import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { DashboardKPIService } from '../services/dashboardKPIService';
import { logger } from '../utils/logger';

export class DashboardKPIController {
  /**
   * GET /api/dashboard/kpi
   * Returns the new Unified Verification Operations KPI response.
   * Replaces legacy dashboard endpoints.
   */
  static async getKPIs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId, agentId, dateFrom, dateTo } = req.query;

      // Convert query params to expected types
      const filters = {
        clientId: clientId ? Number(clientId) : undefined,
        agentId: typeof agentId === 'string' ? agentId : undefined,
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
