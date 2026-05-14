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
      // P17.C-5: dateFrom/dateTo were accepted at the controller but
      // never threaded into DashboardKPIService.getKPIs — the service
      // hard-codes a 7-day rolling window via Postgres INTERVAL in
      // every CTE (date_ranges, perfQuery, kycQuery, casesQuery). Until
      // the FE gains a date filter and the SQL gets parameterized
      // ranges, accept-then-ignore was the silent failure shape audit
      // C-5 flagged. Drop them from the destructure so callers see a
      // clean contract — they were also missing from the service
      // signature, so the previous code threaded them only to be
      // stripped at the service call site (filters destructure).
      const { clientId, agentId } = req.query;
      let clientIds: number[] | undefined;
      let productIds: number[] | undefined;
      const hierarchyAgentIds = req.user?.id
        ? await getScopedOperationalUserIds(req.user.id)
        : undefined;

      const isScoped = !!(req.user?.id && isScopedOperationsUser(req.user));

      if (isScoped && req.user?.id) {
        const [assignedClientIds, assignedProductIds] = await Promise.all([
          getAssignedClientIds(req.user.id),
          getAssignedProductIds(req.user.id),
        ]);
        clientIds = assignedClientIds && assignedClientIds.length > 0 ? assignedClientIds : [-1];
        productIds =
          assignedProductIds && assignedProductIds.length > 0 ? assignedProductIds : [-1];
      }

      // P13.A — apply active-scope narrowing on top of the baseline
      // assigned-IDs filter (project_scope_control_audit_2026_05_14.md).
      // validateActiveScope (P1) has already verified the header value
      // against assignedClientIds, so any non-null req.activeScope value
      // here is authorized. Without this block, dashboard cards aggregate
      // across all assigned clients even when Demo Mode is locked to one.
      if (req.activeScope?.clientId != null && clientIds) {
        clientIds = clientIds.includes(req.activeScope.clientId)
          ? [req.activeScope.clientId]
          : [-1];
      }
      if (req.activeScope?.productId != null && productIds) {
        productIds = productIds.includes(req.activeScope.productId)
          ? [req.activeScope.productId]
          : [-1];
      }

      // For scoped-ops users (BACKEND_USER, TL, MANAGER), use creatorUserIds —
      // service's creator clause already covers (creator OR hierarchy-task-assignee)
      // via OR(c.created_by_backend_user, EXISTS task assigned in hierarchy).
      // Passing agentIds here would AND on top of that, filtering creators out.
      const filters = {
        clientId: clientId ? Number(clientId) : undefined,
        agentId: typeof agentId === 'string' ? agentId : undefined,
        agentIds: isScoped
          ? undefined
          : typeof agentId === 'string'
            ? undefined
            : hierarchyAgentIds,
        creatorUserIds: isScoped ? hierarchyAgentIds : undefined,
        clientIds,
        productIds,
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
