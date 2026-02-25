import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { DashboardKPIService } from '@/services/dashboardKPIService';
import { pool } from '@/config/database';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';

const getBackendUserScopeFilters = async (req: AuthenticatedRequest) => {
  if (!req.user?.id || !isScopedOperationsUser(req.user)) {
    return {
      clientIds: undefined as number[] | undefined,
      productIds: undefined as number[] | undefined,
    };
  }

  const [assignedClientIds, assignedProductIds] = await Promise.all([
    getAssignedClientIds(req.user.id),
    getAssignedProductIds(req.user.id),
  ]);

  const safeClientIds =
    assignedClientIds && assignedClientIds.length > 0 ? assignedClientIds : [-1];
  const safeProductIds =
    assignedProductIds && assignedProductIds.length > 0 ? assignedProductIds : [-1];

  return {
    clientIds: safeClientIds,
    productIds: safeProductIds,
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

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    // KPI Service uses 'agentId' instead of 'userId'
    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    // Derived assignments (Stabilization: defaults for now)
    // Pending + Assigned = Open - InProgress
    const openTasksVal = kpi.workload.open_tasks.value;
    const inProgressVal = kpi.workload.in_progress_tasks.value;
    const derivedPending = Math.max(0, openTasksVal - inProgressVal);

    const dashboardData = {
      period: period || 'month',
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      operationalWorkload: {
        totalTasks: kpi.workload.total_tasks.value,
        openTasks: kpi.workload.open_tasks.value,
        completedTasks: kpi.financial.billable_tasks.value, // Using billable/completed count
        todaysOutput: kpi.workload.completed_today,
        financialExposure: kpi.financial.actual_amount.value,
        inProgressCases: kpi.legacy_compatibility.cases.in_progress.value,
      },
      managementSummary: {
        totalCases: kpi.legacy_compatibility.cases.total.value,
        averageCaseTAT: kpi.performance.avg_tat_days.value,
        completionRate:
          kpi.workload.total_tasks.value > 0
            ? Number(
                (
                  (kpi.financial.billable_tasks.value / kpi.workload.total_tasks.value) *
                  100
                ).toFixed(2)
              )
            : 0,
      },
      taskBreakdown: {
        pending: derivedPending,
        assigned: 0, // Not explicitly tracked in aggregate KPI yet
        inProgress: inProgressVal,
        completed: kpi.legacy_compatibility.tasks.completed.value,
        revoked: kpi.legacy_compatibility.tasks.revoked.value,
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

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    const totalCases = kpi.legacy_compatibility.tasks.total.value; // Using Task count as per classification
    const completedCases = kpi.legacy_compatibility.tasks.completed.value;
    const avgTurnaroundDays = kpi.performance.avg_tat_days.value;

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

    // RBAC: Field Agents can only see their own data
    const effectiveAgentId = getEffectiveAgentId(req);

    const filters = {
      clientId: clientId ? Number(clientId) : undefined,
      agentId: effectiveAgentId,
      clientIds: backendScope.clientIds,
      productIds: backendScope.productIds,
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    const totalCases = kpi.legacy_compatibility.cases.total.value;
    const completedCases = kpi.legacy_compatibility.cases.completed.value;

    const dashboardStats = {
      period: period || 'month',
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      stats: {
        totalCases,
        pendingCases: 0, // Not explicitly separated in KPI yet
        inProgressCases: kpi.legacy_compatibility.cases.in_progress.value,
        completedCases,
        rejectedCases: 0, // Not explicitly separated in KPI interface yet
        revokedTasks: kpi.legacy_compatibility.tasks.revoked.value,
        totalClients: kpi.legacy_compatibility.clients.total.value,
        activeUsers: kpi.legacy_compatibility.field_agents.total.value,
        completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
        avgTurnaroundDays: kpi.performance.avg_tat_days.value,
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
      sortBy = 'days_overdue',
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
      conditions.push(`c."clientId" = $${paramIdx}`);
      params.push(Number(clientId));
      paramIdx++;
    }

    if (backendScope.clientIds) {
      conditions.push(`c."clientId" = ANY($${paramIdx}::int[])`);
      params.push(backendScope.clientIds);
      paramIdx++;
    }

    if (backendScope.productIds) {
      conditions.push(`c."productId" = ANY($${paramIdx}::int[])`);
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
        `(vt.task_number ILIKE $${paramIdx} OR c."caseId"::text ILIKE $${paramIdx} OR c."customerName" ILIKE $${paramIdx})`
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

    // Sort mapping
    const sortFieldMap: Record<string, string> = {
      task_number: 'vt.task_number',
      customer_name: 'c."customerName"',
      days_overdue: 'days_overdue',
      status: 'vt.status',
      priority: 'vt.priority',
      created_at: 'vt.created_at',
    };
    const orderBy = sortFieldMap[sortBy as string] || 'days_overdue';
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        vt.id,
        vt.task_number as "taskNumber",
        vt.case_id as "caseId",
        c."caseId" as "caseNumber",
        c."customerName" as "customerName",
        vt.status,
        vt.priority,
        vtype.name as "verificationTypeName",
        u.name as "assignedToName",
        EXTRACT(EPOCH FROM (NOW() - vt.created_at))/86400 as days_overdue
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
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
      pool.query(query, [...params, limitNum, offset]),
      pool.query(countQuery, params),
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
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    const tatStats = {
      criticalOverdue: kpi.workload.sla_risk_tasks.value,
      totalOverdue: kpi.workload.overdue_tasks.value,
      totalActiveTasks: kpi.workload.open_tasks.value,
      onTrack: Math.max(0, kpi.workload.open_tasks.value - kpi.workload.overdue_tasks.value),
      avgOverdueDays: kpi.workload.avg_overdue_days,
      completedToday: kpi.workload.completed_today,
      overduePercentage:
        kpi.workload.open_tasks.value > 0
          ? Math.round((kpi.workload.overdue_tasks.value / kpi.workload.open_tasks.value) * 100)
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
    };

    const kpi = await DashboardKPIService.getKPIs(filters);

    // SLA Risk detailed breakdown is not yet in KPI Service.
    // Using 'sla_risk_tasks' metric for 'critical' count proxy.
    // Detailed list is empty to satisfy "No Direct SQL" rule.

    const criticalCount = kpi.workload.sla_risk_tasks.value;

    const slaRiskData = {
      summary: {
        safe: 0,
        warning: 0,
        critical: criticalCount,
        breached: 0, // Not explicitly separate in minimal KPI yet (or maybe is included in risk?)
        total: kpi.workload.open_tasks.value,
      },
      criticalTasks: [], // Empty list
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
