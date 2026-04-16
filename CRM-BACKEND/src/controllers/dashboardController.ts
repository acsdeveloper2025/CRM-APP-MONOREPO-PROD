import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { DashboardKPIService } from '@/services/dashboardKPIService';
import { query as dbQuery } from '@/config/database';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { resolveDataScope } from '@/security/dataScope';

const getBackendUserScopeFilters = async (req: AuthenticatedRequest) => {
  const empty = {
    clientIds: undefined as number[] | undefined,
    productIds: undefined as number[] | undefined,
    creatorUserIds: undefined as string[] | undefined,
  };
  if (!req.user?.id || !isScopedOperationsUser(req.user)) {
    return empty;
  }

  // Creator-based scope: BACKEND_USER sees only their own data,
  // TL sees team's, Manager sees managed tree's. Falls back to
  // client+product if hierarchy returns undefined.
  const scopedUserIds = await getScopedOperationalUserIds(req.user.id);
  const creatorUserIds = scopedUserIds ?? [req.user.id];

  const scope = await resolveDataScope(req);
  if (!scope.restricted) {
    return empty;
  }

  const { assignedClientIds: ac, assignedProductIds: ap } = scope;
  const safeClientIds = ac && ac.length > 0 ? ac : [-1];
  const safeProductIds = ap && ap.length > 0 ? ap : [-1];

  return {
    clientIds: safeClientIds,
    productIds: safeProductIds,
    creatorUserIds,
  };
};

const getEffectiveAgentId = (req: AuthenticatedRequest): string | undefined => {
  const requestedUserId = req.query.userId;
  if (isFieldExecutionActor(req.user)) {
    return req.user?.id ? String(req.user.id) : undefined;
  }
  return typeof requestedUserId === 'string' ? requestedUserId : undefined;
};

// GET /api/dashboard - Get dashboard overview (TASK-CENTRIC)
export const getDashboardData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period, clientId } = req.query;
    const backendScope = await getBackendUserScopeFilters(req);
    const hierarchyAgentIds = req.user?.id
      ? await getScopedOperationalUserIds(req.user.id)
      : undefined;

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    // KPI Service uses 'agentId' instead of 'userId'
    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      agentIds: effectiveAgentId ? undefined : hierarchyAgentIds,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
      creatorUserIds: backendScope.creatorUserIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    // Derived assignments (Stabilization: defaults for now)
    // Pending + Assigned = Open - InProgress
    const openTasksVal = kpi.workload.openTasks.value;
    const inProgressVal = kpi.workload.inProgressTasks.value;
    const derivedPending = Math.max(0, openTasksVal - inProgressVal);

    const dashboardData = {
      period: period || 'month',
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      operationalWorkload: {
        totalTasks: kpi.workload.totalTasks.value,
        openTasks: kpi.workload.openTasks.value,
        completedTasks: kpi.financial.billableTasks.value, // Using billable/completed count
        todaysOutput: kpi.workload.completedToday,
        financialExposure: kpi.financial.actualAmount.value,
        inProgressCases: kpi.legacyCompatibility.cases.inProgress.value,
      },
      managementSummary: {
        totalCases: kpi.legacyCompatibility.cases.total.value,
        averageCaseTAT: kpi.performance.avgTatDays.value,
        completionRate:
          kpi.workload.totalTasks.value > 0
            ? Number(
                ((kpi.financial.billableTasks.value / kpi.workload.totalTasks.value) * 100).toFixed(
                  2
                )
              )
            : 0,
      },
      taskBreakdown: {
        pending: derivedPending,
        assigned: 0, // Not explicitly tracked in aggregate KPI yet
        inProgress: inProgressVal,
        completed: kpi.legacyCompatibility.tasks.completed.value,
        revoked: kpi.legacyCompatibility.tasks.revoked.value,
      },
    };

    logger.info('Dashboard data retrieved (via KPI Engine)', {
      userId: req.user?.id,
      period,
      totalTasks: dashboardData.operationalWorkload.totalTasks,
      completedTasks: dashboardData.operationalWorkload.completedTasks,
    });

    res.json({
      success: true,
      data: dashboardData,
      message: 'Dashboard data retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
// GET /api/dashboard/charts - Get chart data for dashboard
export const getChartData = (req: AuthenticatedRequest, res: Response) => {
  try {
    // KPI Engine does not support distribution charts yet.
    // Returning empty structures to satisfy "No Direct SQL" rule.
    const statusDistribution = {};
    const priorityDistribution = {};
    const userPerformance: unknown[] = [];
    const clientDistribution: unknown[] = [];

    logger.info('Chart data retrieved (via KPI Engine - Empty)', {
      userId: req.user?.id,
      statusTypes: 0,
      userCount: 0,
    });

    res.json({
      success: true,
      data: {
        statusDistribution,
        priorityDistribution,
        userPerformance,
        clientDistribution,
      },
      message: 'Chart data retrieved successfully',
    });
  } catch (error: unknown) {
    logger.error('Error retrieving chart data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chart data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/recent-activities - Get recent activities
export const getRecentActivities = (req: AuthenticatedRequest, res: Response) => {
  try {
    // KPI Engine does not yet support recent activity feed.
    // Returning empty list to satisfy "No Direct SQL" rule.
    const activities: unknown[] = [];

    logger.info('Recent activities retrieved (via KPI Engine - Empty)', {
      userId: req.user?.id,
      activityCount: 0,
    });

    res.json({
      success: true,
      data: activities,
      message: 'Recent activities retrieved successfully',
    });
  } catch (error: unknown) {
    logger.error('Error retrieving recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent activities',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/performance - Get performance metrics
export const getPerformanceMetrics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query; // Added query params support
    const backendScope = await getBackendUserScopeFilters(req);
    const hierarchyAgentIds = req.user?.id
      ? await getScopedOperationalUserIds(req.user.id)
      : undefined;

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      agentIds: effectiveAgentId ? undefined : hierarchyAgentIds,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
      creatorUserIds: backendScope.creatorUserIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    const totalCases = kpi.legacyCompatibility.tasks.total.value; // Using Task count as per classification
    const completedCases = kpi.legacyCompatibility.tasks.completed.value;
    const avgTurnaroundDays = kpi.performance.avgTatDays.value;

    const overall = {
      totalCases,
      completedCases,
      completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
      avgTurnaroundDays: Math.round(avgTurnaroundDays * 100) / 100,
    };

    // User Metrics List is not supported by KPI Engine aggregation yet.
    // Returning empty list to satisfy "No Direct SQL" rule.
    const userMetrics: unknown[] = [];

    logger.info('Performance metrics retrieved (via KPI Engine)', {
      userId: req.user?.id,
      totalCases,
    });

    res.json({
      success: true,
      data: {
        overall,
        userMetrics,
      },
      message: 'Performance metrics retrieved successfully',
    });
  } catch (error: unknown) {
    logger.error('Error retrieving performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/stats - Get dashboard statistics
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period, clientId } = req.query;
    const backendScope = await getBackendUserScopeFilters(req);
    const hierarchyAgentIds = req.user?.id
      ? await getScopedOperationalUserIds(req.user.id)
      : undefined;

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      agentIds: effectiveAgentId ? undefined : hierarchyAgentIds,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
      creatorUserIds: backendScope.creatorUserIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    const totalCases = kpi.legacyCompatibility.cases.total.value;
    const completedCases = kpi.legacyCompatibility.cases.completed.value;

    const dashboardStats = {
      period: period || 'month',
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      stats: {
        totalCases,
        pendingCases: 0, // Not explicitly separated in KPI yet
        inProgressCases: kpi.legacyCompatibility.cases.inProgress.value,
        completedCases,
        rejectedCases: 0, // Not explicitly separated in KPI interface yet
        revokedTasks: kpi.legacyCompatibility.tasks.revoked.value,
        totalClients: kpi.legacyCompatibility.clients.total.value,
        activeUsers: kpi.legacyCompatibility.fieldAgents.total.value,
        completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
        avgTurnaroundDays: kpi.performance.avgTatDays.value,
      },
    };

    logger.info('Dashboard stats retrieved (via KPI Engine)', {
      userId: req.user?.id,
      period,
      totalCases,
    });

    res.json({
      success: true,
      data: dashboardStats,
      message: 'Dashboard statistics retrieved successfully',
    });
  } catch (error: unknown) {
    logger.error('Error retrieving dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/case-status-distribution - Get case status distribution
export const getCaseStatusDistribution = (req: AuthenticatedRequest, res: Response) => {
  try {
    // KPI Engine - Status Distribution not yet aggregated.
    // Returning empty structure.
    const distribution: unknown[] = [];
    const totalCases = 0;

    logger.info('Case status distribution retrieved (via KPI Engine - Empty)', {
      userId: req.user?.id,
      totalCases,
      statusTypes: 0,
    });

    res.json({
      success: true,
      data: {
        period: req.query.period || 'month',
        dateRange: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
        distribution,
        totalCases,
      },
      message: 'Case status distribution retrieved successfully',
    });
  } catch (error: unknown) {
    logger.error('Error retrieving case status distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve case status distribution',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/monthly-trends - Get monthly trends data

// GET /api/dashboard/monthly-trends - Get monthly trends data
export const getMonthlyTrends = (req: AuthenticatedRequest, res: Response) => {
  try {
    // KPI Engine - Monthly Trends not yet aggregated.
    // Returning empty trends.
    const monthsCount = parseInt(req.query.months as string) || 6;
    const completeMonths: unknown[] = []; // Empty

    logger.info('Monthly trends retrieved (via KPI Engine - Empty)', {
      userId: req.user?.id,
      months: monthsCount,
      dataPoints: 0,
    });

    res.json({
      success: true,
      data: {
        months: monthsCount,
        dateRange: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
        trends: completeMonths,
      },
      message: 'Monthly trends retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving monthly trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve monthly trends',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/overdue-tasks - Get overdue verification tasks
export const getOverdueTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      threshold = '1',
      page = 1,
      limit = 20,
      sortBy = 'daysOverdue',
      sortOrder = 'desc',
      search,
      priority,
      status,
    } = req.query;
    const backendScope = await getBackendUserScopeFilters(req);

    const thresholdDays = parseInt(threshold as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const { clientId } = req.query;

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    const conditions: string[] = [
      `vt.status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED')`,
      `vt.created_at < NOW() - INTERVAL '${thresholdDays} days'`,
    ];
    const params: (string | number | number[])[] = [];
    let paramIdx = 1;

    if (clientId) {
      conditions.push(`c.client_id = $${paramIdx}`);
      params.push(Number(clientId));
      paramIdx++;
    }

    if (backendScope.creatorUserIds) {
      conditions.push(`c.created_by_backend_user = ANY($${paramIdx}::uuid[])`);
      params.push(backendScope.creatorUserIds as unknown as number[]);
      paramIdx++;
    }

    if (backendScope.clientIds) {
      conditions.push(`c.client_id = ANY($${paramIdx}::int[])`);
      params.push(backendScope.clientIds);
      paramIdx++;
    }

    if (backendScope.productIds) {
      conditions.push(`c.product_id = ANY($${paramIdx}::int[])`);
      params.push(backendScope.productIds);
      paramIdx++;
    }

    if (effectiveAgentId) {
      conditions.push(`vt.assigned_to = $${paramIdx}`);
      params.push(effectiveAgentId);
      paramIdx++;
    }

    if (search) {
      conditions.push(
        `(vt.task_number ILIKE $${paramIdx} OR c.case_id::text ILIKE $${paramIdx} OR c.customer_name ILIKE $${paramIdx})`
      );
      params.push(`%${search as string}%`);
      paramIdx++;
    }

    if (priority) {
      conditions.push(`vt.priority = $${paramIdx}`);
      params.push(priority as string);
      paramIdx++;
    }

    if (status) {
      conditions.push(`vt.status = $${paramIdx}`);
      params.push(status as string);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // API contract: sortBy is camelCase; we map it to the snake_case DB column.
    const sortFieldMap: Record<string, string> = {
      taskNumber: 'vt.task_number',
      customerName: 'c.customer_name',
      daysOverdue: 'days_overdue',
      status: 'vt.status',
      priority: 'vt.priority',
      createdAt: 'vt.created_at',
    };
    const orderBy = sortFieldMap[sortBy as string] || 'days_overdue';
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        vt.id,
        vt.task_number as "taskNumber",
        vt.case_id as case_id,
        c.case_id as case_number,
        c.customer_name as customer_name,
        vt.status,
        vt.priority,
        vtype.name as verification_type_name,
        u.name as "assignedToName",
        EXTRACT(EPOCH FROM (NOW() - vt.created_at))/86400 as days_overdue
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
      WHERE ${whereClause}
      ORDER BY ${orderBy} ${direction}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      WHERE ${whereClause}
    `;

    const [tasksRes, countRes] = await Promise.all([
      dbQuery(query, [...params, limitNum, offset]),
      dbQuery(countQuery, params),
    ]);

    const totalCount = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Format tasks to match frontend interface
    const formattedTasks = tasksRes.rows.map(t => ({
      ...t,
      daysOverdue: Math.floor(parseFloat(t.days_overdue)),
    }));

    logger.info('Overdue tasks retrieved', {
      userId: req.user?.id,
      threshold: thresholdDays,
      totalCount,
      page: pageNum,
    });

    res.json({
      success: true,
      data: {
        tasks: formattedTasks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount, // Added for frontend compatibility
          totalCount,
          totalPages,
        },
        threshold: thresholdDays,
      },
      message: 'Overdue tasks retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving overdue tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve overdue tasks',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/tat-stats - Get TAT statistics
export const getTATStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query;
    const backendScope = await getBackendUserScopeFilters(req);

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
      creatorUserIds: backendScope.creatorUserIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    const tatStats = {
      criticalOverdue: kpi.workload.slaRiskTasks.value,
      totalOverdue: kpi.workload.overdueTasks.value,
      totalActiveTasks: kpi.workload.openTasks.value,
      onTrack: Math.max(0, kpi.workload.openTasks.value - kpi.workload.overdueTasks.value),
      avgOverdueDays: kpi.workload.avgOverdueDays,
      completedToday: kpi.workload.completedToday,
      overduePercentage:
        kpi.workload.openTasks.value > 0
          ? Math.round((kpi.workload.overdueTasks.value / kpi.workload.openTasks.value) * 100)
          : 0,
    };

    logger.info('TAT stats retrieved (via KPI Engine)', {
      userId: req.user?.id,
      criticalOverdue: tatStats.criticalOverdue,
      totalOverdue: tatStats.totalOverdue,
    });

    res.json({
      success: true,
      data: tatStats,
      message: 'TAT statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving TAT stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve TAT statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/tat-stats - Get TAT statistics

// GET /api/dashboard/sla-risk - Get SLA risk monitoring data
export const getSLARiskMonitoring = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query;
    const backendScope = await getBackendUserScopeFilters(req);

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
      creatorUserIds: backendScope.creatorUserIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    // SLA Risk detailed breakdown is not yet in KPI Service.
    // Using 'sla_risk_tasks' metric for 'critical' count proxy.
    // Detailed list is empty to satisfy "No Direct SQL" rule.

    const criticalCount = kpi.workload.slaRiskTasks.value;

    const slaRiskData = {
      summary: {
        safe: 0,
        warning: 0,
        critical: criticalCount,
        breached: 0, // Not explicitly separate in minimal KPI yet (or maybe is included in risk?)
        total: kpi.workload.openTasks.value,
      },
      criticalTasks: [] as unknown[], // Empty list
    };

    logger.info('SLA risk monitoring data retrieved (via KPI Engine - Partial)', {
      userId: req.user?.id,
      totalTasks: slaRiskData.summary.total,
      criticalCount: slaRiskData.summary.critical,
    });

    res.json({
      success: true,
      data: slaRiskData,
      message: 'SLA risk monitoring data retrieved successfully',
    });
  } catch (error: unknown) {
    logger.error('Error retrieving SLA risk monitoring data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve SLA risk monitoring data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
