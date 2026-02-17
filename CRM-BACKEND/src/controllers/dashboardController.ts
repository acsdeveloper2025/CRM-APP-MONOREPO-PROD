import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { pool } from '@/config/database';
import { Role } from '@/types/auth';
import type { QueryParams } from '@/types/database';

// Mock data removed - using database operations only

// GET /api/dashboard - Get dashboard overview (TASK-CENTRIC)
export const getDashboardData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = 'month', clientId, userId } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // month
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Build filter conditions for tasks
    let taskFilterConditions = 'WHERE 1=1';
    const taskParams: (string | number)[] = [];
    let paramIndex = 1;

    if (clientId) {
      taskFilterConditions += ` AND c."clientId" = $${paramIndex}`;
      taskParams.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (userId) {
      taskFilterConditions += ` AND vt.assigned_to = $${paramIndex}`;
      taskParams.push(userId as string);
      paramIndex++;
    }

    // OPERATIONAL WORKLOAD (Task-Centric Metrics)

    // 1. Total Tasks (Operational Workload)
    const totalTasksQuery = `
      SELECT COUNT(*) as total_tasks
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      ${taskFilterConditions}
    `;
    const totalTasksResult = await pool.query(totalTasksQuery, taskParams);
    const totalTasks = parseInt(totalTasksResult.rows[0].total_tasks) || 0;

    // 2. Open Tasks
    const openTasksQuery = `
      SELECT COUNT(*) as open_tasks
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      ${taskFilterConditions}
        AND vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
    `;
    const openTasksResult = await pool.query(openTasksQuery, taskParams);
    const openTasks = parseInt(openTasksResult.rows[0].open_tasks) || 0;

    // 3. Completed Tasks (Billable Work) - MUST MATCH MIS REPORT
    const completedTasksQuery = `
      SELECT COUNT(*) as completed_tasks
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      ${taskFilterConditions}
        AND vt.status = 'COMPLETED'
    `;
    const completedTasksResult = await pool.query(completedTasksQuery, taskParams);
    const completedTasks = parseInt(completedTasksResult.rows[0].completed_tasks) || 0;

    // 4. Today's Output
    const todaysOutputQuery = `
      SELECT COUNT(*) as todays_output
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      ${taskFilterConditions}
        AND vt.status = 'COMPLETED'
        AND DATE(vt.completed_at) = CURRENT_DATE
    `;
    const todaysOutputResult = await pool.query(todaysOutputQuery, taskParams);
    const todaysOutput = parseInt(todaysOutputResult.rows[0].todays_output) || 0;

    // 5. Financial Exposure
    const financialExposureQuery = `
      SELECT COALESCE(SUM(vt.actual_amount), 0) as financial_exposure
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      ${taskFilterConditions}
        AND vt.status = 'COMPLETED'
    `;
    const financialExposureResult = await pool.query(financialExposureQuery, taskParams);
    const financialExposure = parseFloat(financialExposureResult.rows[0].financial_exposure) || 0;

    // 6. In-Progress Cases (Cases with at least one active task)
    const inProgressCasesQuery = `
      SELECT COUNT(DISTINCT c.id) as in_progress_cases
      FROM cases c
      WHERE EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
          AND vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
      )
      ${clientId ? `AND c."clientId" = $1` : ''}
    `;
    const inProgressCasesParams = clientId ? [parseInt(clientId as string)] : [];
    const inProgressCasesResult = await pool.query(inProgressCasesQuery, inProgressCasesParams);
    const inProgressCases = parseInt(inProgressCasesResult.rows[0].in_progress_cases) || 0;

    // MANAGEMENT SUMMARY (Case-Based Metrics)

    // Total Cases
    const totalCasesQuery = `
      SELECT COUNT(*) as total_cases
      FROM cases
      ${clientId ? `WHERE "clientId" = $1` : ''}
    `;
    const totalCasesResult = await pool.query(
      totalCasesQuery,
      clientId ? [parseInt(clientId as string)] : []
    );
    const totalCases = parseInt(totalCasesResult.rows[0].total_cases) || 0;

    // Average Case TAT (in days)
    const avgCaseTATQuery = `
      SELECT AVG(
        EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400
      ) as avg_case_tat_days
      FROM cases
      WHERE completed_at IS NOT NULL
      ${clientId ? `AND "clientId" = $1` : ''}
    `;
    const avgCaseTATResult = await pool.query(
      avgCaseTATQuery,
      clientId ? [parseInt(clientId as string)] : []
    );
    const avgCaseTAT = parseFloat(avgCaseTATResult.rows[0].avg_case_tat_days) || 0;

    // Task Breakdown
    const taskBreakdownQuery = `
      SELECT
        COUNT(*) FILTER (WHERE vt.status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE vt.status = 'ASSIGNED') as assigned,
        COUNT(*) FILTER (WHERE vt.status = 'IN_PROGRESS') as in_progress,
        COUNT(*) FILTER (WHERE vt.status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE vt.status = 'REVOKED') as revoked
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      ${taskFilterConditions}
    `;
    const taskBreakdownResult = await pool.query(taskBreakdownQuery, taskParams);
    const taskBreakdown = taskBreakdownResult.rows[0];

    const dashboardData = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      operationalWorkload: {
        totalTasks,
        openTasks,
        completedTasks,
        todaysOutput,
        financialExposure: parseFloat(financialExposure.toFixed(2)),
        inProgressCases,
      },
      managementSummary: {
        totalCases,
        averageCaseTAT: parseFloat(avgCaseTAT.toFixed(2)),
        completionRate:
          totalCases > 0 ? parseFloat(((completedTasks / totalTasks) * 100).toFixed(2)) : 0,
      },
      taskBreakdown: {
        pending: parseInt(taskBreakdown.pending) || 0,
        assigned: parseInt(taskBreakdown.assigned) || 0,
        inProgress: parseInt(taskBreakdown.in_progress) || 0,
        completed: parseInt(taskBreakdown.completed) || 0,
        revoked: parseInt(taskBreakdown.revoked) || 0,
      },
    };

    logger.info('Dashboard data retrieved (task-centric)', {
      userId: req.user?.id,
      period,
      totalTasks,
      completedTasks,
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
export const getChartData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get case status distribution from database
    const statusQuery = `
      SELECT status, COUNT(*) as count
      FROM cases
      GROUP BY status
    `;
    const statusResult = await pool.query(statusQuery);
    const statusDistribution = statusResult.rows.reduce((acc: Record<string, number>, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    // Get case priority distribution from database
    const priorityQuery = `
      SELECT priority, COUNT(*) as count
      FROM cases
      GROUP BY priority
    `;
    const priorityResult = await pool.query(priorityQuery);
    const priorityDistribution = priorityResult.rows.reduce((acc: Record<string, number>, row) => {
      acc[row.priority] = parseInt(row.count);
      return acc;
    }, {});

    // Get user performance from database (based on verification tasks)
    const userPerformanceQuery = `
      SELECT
        u.name,
        u.id,
        COUNT(DISTINCT vt.case_id) as "totalCases",
        COUNT(DISTINCT CASE WHEN vt.status = 'COMPLETED' THEN vt.case_id END) as "completedCases",
        COUNT(DISTINCT CASE WHEN vt.verification_outcome = 'APPROVED' THEN vt.case_id END) as "approvedCases"
      FROM users u
      LEFT JOIN verification_tasks vt ON u.id = vt.assigned_to
      WHERE u."isActive" = true
      GROUP BY u.id, u.name
      ORDER BY "totalCases" DESC
      LIMIT 10
    `;
    const userPerformanceResult = await pool.query<{
      id: string;
      name: string;
      totalCases: string;
      completedCases: string;
      approvedCases: string;
    }>(userPerformanceQuery);
    const userPerformance = userPerformanceResult.rows.map(user => {
      const totalCases = parseInt(user.totalCases) || 0;
      const completedCases = parseInt(user.completedCases) || 0;
      const approvedCases = parseInt(user.approvedCases) || 0;

      return {
        id: user.id,
        name: user.name,
        totalCases,
        completedCases,
        approvedCases,
        completionRate:
          totalCases > 0 ? Math.round(((completedCases + approvedCases) / totalCases) * 100) : 0,
      };
    });

    // Get client distribution from database
    const clientQuery = `
      SELECT
        cl.name,
        cl.id,
        COUNT(c."caseId") as "caseCount"
      FROM clients cl
      LEFT JOIN cases c ON cl.id = c."clientId"
      WHERE cl."isActive" = true
      GROUP BY cl.id, cl.name
      ORDER BY "caseCount" DESC
      LIMIT 10
    `;
    const clientResult = await pool.query(clientQuery);
    const clientDistribution = clientResult.rows.map(client => ({
      id: client.id,
      name: client.name,
      caseCount: parseInt(client.caseCount) || 0,
    }));

    logger.info('Chart data retrieved', {
      userId: req.user?.id,
      statusTypes: Object.keys(statusDistribution).length,
      userCount: userPerformance.length,
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
  } catch (error) {
    logger.error('Error retrieving chart data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chart data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/recent-activities - Get recent activities
export const getRecentActivities = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get recent verification tasks as activities from database
    const recentActivitiesQuery = `
      SELECT
        vt.id,
        'TASK_UPDATED' as type,
        CONCAT('Task ', vt.task_number, ' - ', vt.task_title) as description,
        vt.assigned_to as "userId",
        vt.updated_at as timestamp,
        u.name as "userName"
      FROM verification_tasks vt
      LEFT JOIN users u ON vt.assigned_to = u.id
      ORDER BY vt.updated_at DESC
      LIMIT 10
    `;

    const result = await pool.query(recentActivitiesQuery);
    const activities = result.rows.map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      userId: activity.userId,
      timestamp: activity.timestamp,
      user: activity.userName ? { name: activity.userName } : null,
    }));

    logger.info('Recent activities retrieved', {
      userId: req.user?.id,
      activityCount: activities.length,
    });

    res.json({
      success: true,
      data: activities,
      message: 'Recent activities retrieved successfully',
    });
  } catch (error) {
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
    // Get overall performance metrics from database
    const metricsQuery = `
      SELECT
        COUNT(*) as "totalCases",
        COUNT(CASE WHEN status = 'COMPLETED' OR status = 'APPROVED' THEN 1 END) as "completedCases",
        AVG(CASE
          WHEN vt.completed_at IS NOT NULL AND vt.first_assigned_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.first_assigned_at)) / 86400
        END) as "avgTurnaroundDays"
      FROM verification_tasks vt
    `;

    const result = await pool.query<{
      totalCases: string;
      completedCases: string;
      avgTurnaroundDays: string;
    }>(metricsQuery);
    const metrics = result.rows[0];

    const totalCases = parseInt(metrics.totalCases) || 0;
    const completedCases = parseInt(metrics.completedCases) || 0;
    const avgTurnaroundDays = parseFloat(metrics.avgTurnaroundDays) || 0;

    // Get user-specific metrics (based on verification tasks)
    const userMetricsQuery = `
      SELECT
        u.name,
        u.id,
        COUNT(DISTINCT vt.case_id) as "assignedCases",
        COUNT(DISTINCT CASE WHEN vt.status = 'COMPLETED' THEN vt.case_id END) as "completedCases",
        AVG(CASE
          WHEN vt.completed_at IS NOT NULL AND vt.current_assigned_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.current_assigned_at)) / 86400
        END) as "avgTurnaroundDays"
      FROM users u
      LEFT JOIN verification_tasks vt ON u.id = vt.assigned_to
      WHERE u."isActive" = true
      GROUP BY u.id, u.name
      HAVING COUNT(DISTINCT vt.case_id) > 0
      ORDER BY "completedCases" DESC
      LIMIT 10
    `;

    const userResult = await pool.query(userMetricsQuery);
    const userMetrics = userResult.rows.map(user => ({
      id: user.id,
      name: user.name,
      assignedCases: parseInt(user.assignedCases) || 0,
      completedCases: parseInt(user.completedCases) || 0,
      completionRate:
        user.assignedCases > 0
          ? Math.round((parseInt(user.completedCases) / parseInt(user.assignedCases)) * 100)
          : 0,
      avgTurnaroundDays: parseFloat(user.avgTurnaroundDays) || 0,
    }));

    logger.info('Performance metrics retrieved', {
      userId: req.user?.id,
      totalCases,
      completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
    });

    res.json({
      success: true,
      data: {
        overall: {
          totalCases,
          completedCases,
          completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
          avgTurnaroundDays: Math.round(avgTurnaroundDays * 100) / 100,
        },
        userMetrics,
      },
      message: 'Performance metrics retrieved successfully',
    });
  } catch (error) {
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
    const { period = 'month', clientId: _clientId, userId } = req.query;

    // Role-based filtering - FIELD_AGENT users can only see their own stats
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;
    const effectiveUserId = userRole === Role.FIELD_AGENT ? currentUserId : userId;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // month
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Build role-based filtering condition for verification tasks
    const effectiveUserIdStr =
      typeof effectiveUserId === 'string' || typeof effectiveUserId === 'number'
        ? String(effectiveUserId)
        : '';
    const taskFilter = effectiveUserId
      ? ` AND EXISTS (SELECT 1 FROM verification_tasks vt WHERE vt.case_id = c.id AND vt.assigned_to = '${effectiveUserIdStr}')`
      : '';

    // Get comprehensive statistics from database
    const statsQuery = `
      SELECT
        (SELECT COUNT(DISTINCT c.id) FROM cases c WHERE c."createdAt" >= $1${taskFilter}) as "totalCases",
        (SELECT COUNT(DISTINCT c.id) FROM cases c WHERE c."createdAt" >= $1 AND c.status = 'PENDING'${taskFilter}) as "pendingCases",
        (SELECT COUNT(DISTINCT c.id) FROM cases c WHERE c."createdAt" >= $1 AND c.status = 'IN_PROGRESS'${taskFilter}) as "inProgressCases",
        (SELECT COUNT(DISTINCT c.id) FROM cases c WHERE c."createdAt" >= $1 AND (c.status = 'COMPLETED' OR c.status = 'APPROVED')${taskFilter}) as "completedCases",
        (SELECT COUNT(DISTINCT c.id) FROM cases c WHERE c."createdAt" >= $1 AND c.status = 'REJECTED'${taskFilter}) as "rejectedCases",
        (SELECT COUNT(*) FROM verification_tasks WHERE status = 'REVOKED') as "revokedTasks",
        (SELECT COUNT(*) FROM clients WHERE "isActive" = true) as "totalClients",
        (SELECT COUNT(*) FROM users WHERE "isActive" = true) as "activeUsers",
        (SELECT AVG(EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt")) / 86400)
         FROM cases c
         WHERE c.status IN ('COMPLETED', 'APPROVED') AND c."createdAt" >= $1${taskFilter}) as "avgTurnaroundDays"
    `;

    const result = await pool.query(statsQuery, [startDate]);
    const stats = result.rows[0];

    const totalCases = parseInt(stats.totalCases) || 0;
    const completedCases = parseInt(stats.completedCases) || 0;

    const dashboardStats = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      stats: {
        totalCases,
        pendingCases: parseInt(stats.pendingCases) || 0,
        inProgressCases: parseInt(stats.inProgressCases) || 0,
        completedCases,
        rejectedCases: parseInt(stats.rejectedCases) || 0,
        revokedTasks: parseInt(stats.revokedTasks) || 0,
        totalClients: parseInt(stats.totalClients) || 0,
        activeUsers: parseInt(stats.activeUsers) || 0,
        completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
        avgTurnaroundDays: Math.round((parseFloat(stats.avgTurnaroundDays) || 0) * 100) / 100,
      },
    };

    logger.info('Dashboard stats retrieved', {
      userId: req.user?.id,
      period,
      totalCases,
    });

    res.json({
      success: true,
      data: dashboardStats,
      message: 'Dashboard statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/case-status-distribution - Get case status distribution
export const getCaseStatusDistribution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = 'month', clientId, userId } = req.query;

    // Role-based filtering - FIELD_AGENT users can only see their own stats
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;
    const effectiveUserId = userRole === Role.FIELD_AGENT ? currentUserId : userId;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // month
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Build query with filters
    let statusQuery = `
      SELECT
        c.status,
        COUNT(DISTINCT c.id) as count,
        ROUND((COUNT(DISTINCT c.id) * 100.0 / SUM(COUNT(DISTINCT c.id)) OVER()), 2) as percentage
      FROM cases c
    `;
    const queryParams: QueryParams = [startDate];
    let paramIndex = 2;

    // Join with verification_tasks if filtering by userId
    if (effectiveUserId) {
      statusQuery += ` INNER JOIN verification_tasks vt ON c.id = vt.case_id`;
    }

    statusQuery += ` WHERE c."createdAt" >= $1`;

    if (clientId) {
      statusQuery += ` AND c."clientId" = $${paramIndex}`;
      queryParams.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (effectiveUserId) {
      statusQuery += ` AND vt.assigned_to = $${paramIndex}`;
      queryParams.push(effectiveUserId as string);
      paramIndex++;
    }

    statusQuery += ` GROUP BY c.status ORDER BY count DESC`;

    const result = await pool.query(statusQuery, queryParams);

    const distribution = result.rows.map(row => ({
      status: row.status,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage),
    }));

    // Calculate totals
    const totalCases = distribution.reduce((sum, item) => sum + item.count, 0);

    logger.info('Case status distribution retrieved', {
      userId: req.user?.id,
      period,
      totalCases,
      statusTypes: distribution.length,
    });

    res.json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
        distribution,
        totalCases,
      },
      message: 'Case status distribution retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving case status distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve case status distribution',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/dashboard/monthly-trends - Get monthly trends data
export const getMonthlyTrends = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { months = 6, clientId, userId } = req.query;

    // Role-based filtering - FIELD_AGENT users can only see their own stats
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;
    const effectiveUserId = userRole === Role.FIELD_AGENT ? currentUserId : userId;
    const monthsCount = parseInt(months as string);

    // Calculate start date based on months parameter
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);

    // Build query with filters
    let trendsQuery = `
      SELECT
        DATE_TRUNC('month', c."createdAt") as month,
        COUNT(DISTINCT c.id) as "totalCases",
        COUNT(DISTINCT CASE WHEN c.status = 'COMPLETED' OR c.status = 'APPROVED' THEN c.id END) as "completedCases",
        COUNT(DISTINCT CASE WHEN c.status = 'PENDING' THEN c.id END) as "pendingCases",
        COUNT(DISTINCT CASE WHEN c.status = 'IN_PROGRESS' THEN c.id END) as "inProgressCases",
        COUNT(DISTINCT CASE WHEN c.status = 'REJECTED' THEN c.id END) as "rejectedCases",
        AVG(CASE
          WHEN c.status IN ('COMPLETED', 'APPROVED')
          THEN EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt")) / 86400
        END) as "avgTurnaroundDays"
      FROM cases c
    `;
    const queryParams: QueryParams = [startDate];
    let paramIndex = 2;

    // Join with verification_tasks if filtering by userId
    if (effectiveUserId) {
      trendsQuery += ` INNER JOIN verification_tasks vt ON c.id = vt.case_id`;
    }

    trendsQuery += ` WHERE c."createdAt" >= $1`;

    if (clientId) {
      trendsQuery += ` AND c."clientId" = $${paramIndex}`;
      queryParams.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (effectiveUserId) {
      trendsQuery += ` AND vt.assigned_to = $${paramIndex}`;
      queryParams.push(effectiveUserId as string);
      paramIndex++;
    }

    trendsQuery += `
      GROUP BY DATE_TRUNC('month', c."createdAt")
      ORDER BY month ASC
    `;

    const result = await pool.query(trendsQuery, queryParams);

    const trends = result.rows.map(row => {
      const totalCases = parseInt(row.totalCases);
      const completedCases = parseInt(row.completedCases);

      return {
        month: row.month,
        monthName: new Date(row.month).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        }),
        totalCases,
        completedCases: parseInt(row.completedCases),
        pendingCases: parseInt(row.pendingCases),
        inProgressCases: parseInt(row.inProgressCases),
        rejectedCases: parseInt(row.rejectedCases),
        completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
        avgTurnaroundDays: Math.round((parseFloat(row.avgTurnaroundDays) || 0) * 100) / 100,
      };
    });

    // Fill in missing months with zero data
    const completeMonths = [];
    for (let i = 0; i < monthsCount; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const existingData = trends.find(
        t =>
          new Date(t.month).getMonth() === monthDate.getMonth() &&
          new Date(t.month).getFullYear() === monthDate.getFullYear()
      );

      if (existingData) {
        completeMonths.unshift(existingData);
      } else {
        completeMonths.unshift({
          month: monthDate.toISOString(),
          monthName: monthDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          }),
          totalCases: 0,
          completedCases: 0,
          pendingCases: 0,
          inProgressCases: 0,
          rejectedCases: 0,
          completionRate: 0,
          avgTurnaroundDays: 0,
        });
      }
    }

    logger.info('Monthly trends retrieved', {
      userId: req.user?.id,
      months: monthsCount,
      dataPoints: completeMonths.length,
    });

    res.json({
      success: true,
      data: {
        months: monthsCount,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString(),
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
      limit = 50,
      sortBy = 'days_overdue',
      sortOrder = 'desc',
    } = req.query;

    // Role-based filtering - FIELD_AGENT users can only see their own tasks
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;
    const effectiveUserId = userRole === Role.FIELD_AGENT ? currentUserId : null;

    const thresholdDays = parseInt(threshold as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build query to get overdue tasks
    let overdueQuery = `
      SELECT
        vt.id,
        vt.task_number,
        vt.task_title,
        vt.status,
        vt.priority,
        vt.assigned_at,
        vt.first_assigned_at,
        vt.current_assigned_at,
        vt.created_at,
        vt.estimated_completion_date,
        c.id as case_id,
        c."caseId" as case_number,
        c."customerName" as customer_name,
        vtype.name as verification_type_name,
        u.name as assigned_to_name,
        u."employeeId" as assigned_to_employee_id,
        CASE
          WHEN vt.current_assigned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - vt.current_assigned_at)) / 86400
          ELSE
            EXTRACT(EPOCH FROM (NOW() - vt.created_at)) / 86400
        END as days_overdue
      FROM verification_tasks vt
      INNER JOIN cases c ON vt.case_id = c.id
      LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      WHERE vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
    `;

    const queryParams: QueryParams = [];
    let paramIndex = 1;

    // Add user filter for field agents
    if (effectiveUserId) {
      overdueQuery += ` AND vt.assigned_to = $${paramIndex}`;
      queryParams.push(effectiveUserId);
      paramIndex++;
    }

    // Add threshold filter
    overdueQuery += `
      AND (
        CASE
          WHEN vt.current_assigned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - vt.current_assigned_at)) / 86400
          ELSE
            EXTRACT(EPOCH FROM (NOW() - vt.created_at)) / 86400
        END
      ) >= $${paramIndex}
    `;
    queryParams.push(thresholdDays);
    paramIndex++;

    // Add search filter
    if (typeof req.query.search === 'string') {
      const search = req.query.search;
      overdueQuery += `
        AND (
          COALESCE(c."customerName", '') ILIKE $${paramIndex} OR
          COALESCE(vt.task_title, '') ILIKE $${paramIndex} OR
          COALESCE(vt.address, '') ILIKE $${paramIndex} OR
          COALESCE(vt.task_number, '') ILIKE $${paramIndex} OR
          COALESCE(c."caseId"::text, '') ILIKE $${paramIndex}
        )
      `;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add priority filter
    if (typeof req.query.priority === 'string') {
      overdueQuery += ` AND vt.priority = $${paramIndex}`;
      queryParams.push(req.query.priority);
      paramIndex++;
    }

    // Add status filter
    if (typeof req.query.status === 'string') {
      // split by comma if needed, but for now simple single status
      overdueQuery += ` AND vt.status = $${paramIndex}`;
      queryParams.push(req.query.status);
      paramIndex++;
    }

    // Add sorting
    const validSortColumns = [
      'days_overdue',
      'task_number',
      'customer_name',
      'status',
      'priority',
      'created_at',
    ];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'days_overdue';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumnStr =
      typeof sortColumn === 'string' || typeof sortColumn === 'number'
        ? String(sortColumn)
        : 'days_overdue';
    overdueQuery += ` ORDER BY ${sortColumnStr} ${sortDirection}`;

    // Add pagination
    overdueQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limitNum, offset);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM verification_tasks vt
      INNER JOIN cases c ON vt.case_id = c.id
      WHERE vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
    `;

    const countParams: QueryParams = [];
    let countParamIndex = 1;

    if (effectiveUserId) {
      countQuery += ` AND vt.assigned_to = $${countParamIndex}`;
      countParams.push(effectiveUserId);
      countParamIndex++;
    }

    // Add search filter to count query
    if (typeof req.query.search === 'string') {
      const search = req.query.search;
      countQuery += `
        AND (
          COALESCE(c."customerName", '') ILIKE $${countParamIndex} OR
          COALESCE(vt.task_title, '') ILIKE $${countParamIndex} OR
          COALESCE(vt.address, '') ILIKE $${countParamIndex} OR
          COALESCE(vt.task_number, '') ILIKE $${countParamIndex} OR
          COALESCE(c."caseId"::text, '') ILIKE $${countParamIndex}
        )
      `;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    // Add priority filter to count query
    if (typeof req.query.priority === 'string') {
      countQuery += ` AND vt.priority = $${countParamIndex}`;
      countParams.push(req.query.priority);
      countParamIndex++;
    }

    // Add status filter to count query
    if (typeof req.query.status === 'string') {
      countQuery += ` AND vt.status = $${countParamIndex}`;
      countParams.push(req.query.status);
      countParamIndex++;
    }

    countQuery += `
      AND (
        CASE
          WHEN vt.assigned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - vt.assigned_at)) / 86400
          ELSE
            EXTRACT(EPOCH FROM (NOW() - vt.created_at)) / 86400
        END
      ) >= $${countParamIndex}
    `;
    countParams.push(thresholdDays);

    const [tasksResult, countResult] = await Promise.all([
      pool.query(overdueQuery, queryParams),
      pool.query(countQuery, countParams),
    ]);

    const tasks = tasksResult.rows.map(task => ({
      id: task.id,
      taskNumber: task.task_number,
      taskTitle: task.task_title,
      status: task.status,
      priority: task.priority,
      assignedAt: task.assigned_at,
      createdAt: task.created_at,
      estimatedCompletionDate: task.estimated_completion_date,
      caseId: task.case_id,
      caseNumber: task.case_number,
      customerName: task.customer_name,
      verificationTypeName: task.verification_type_name,
      assignedToName: task.assigned_to_name,
      assignedToEmployeeId: task.assigned_to_employee_id,
      daysOverdue: Math.floor(parseFloat(task.days_overdue)),
    }));

    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / limitNum);

    logger.info('Overdue tasks retrieved', {
      userId: req.user?.id,
      threshold: thresholdDays,
      totalCount,
      page: pageNum,
    });

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: pageNum,
          limit: limitNum,
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
    // Role-based filtering - FIELD_AGENT users can only see their own stats
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;
    const effectiveUserId = userRole === Role.FIELD_AGENT ? currentUserId : null;

    let statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE
          vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
          AND (
            CASE
              WHEN vt.current_assigned_at IS NOT NULL THEN
                EXTRACT(EPOCH FROM (NOW() - vt.current_assigned_at)) / 86400
              ELSE
                EXTRACT(EPOCH FROM (NOW() - vt.created_at)) / 86400
            END
          ) > 1
        ) as critical_overdue,
        COUNT(*) FILTER (WHERE
          vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
          AND (
            CASE
              WHEN vt.current_assigned_at IS NOT NULL THEN
                EXTRACT(EPOCH FROM (NOW() - vt.current_assigned_at)) / 86400
              ELSE
                EXTRACT(EPOCH FROM (NOW() - vt.created_at)) / 86400
            END
          ) > 0
        ) as total_overdue,
        COUNT(*) FILTER (WHERE vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')) as total_active_tasks
      FROM verification_tasks vt
    `;

    const queryParams: QueryParams = [];
    if (effectiveUserId) {
      statsQuery += ` WHERE vt.assigned_to = $1`;
      queryParams.push(effectiveUserId);
    }

    const result = await pool.query(statsQuery, queryParams);
    const stats = result.rows[0];

    const tatStats = {
      criticalOverdue: parseInt(stats.critical_overdue) || 0,
      totalOverdue: parseInt(stats.total_overdue) || 0,
      totalActiveTasks: parseInt(stats.total_active_tasks) || 0,
      overduePercentage:
        stats.total_active_tasks > 0
          ? Math.round((parseInt(stats.total_overdue) / parseInt(stats.total_active_tasks)) * 100)
          : 0,
    };

    logger.info('TAT stats retrieved', {
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

// GET /api/dashboard/sla-risk - Get SLA risk monitoring data
export const getSLARiskMonitoring = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, userId } = req.query;

    // Build filter conditions
    let filterConditions = '';
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (clientId) {
      filterConditions += ` AND c."clientId" = $${paramIndex}`;
      params.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (userId) {
      filterConditions += ` AND vt.assigned_to = $${paramIndex}`;
      params.push(userId as string);
      paramIndex++;
    }

    // SLA Status Counts Query
    const slaCountsQuery = `
      WITH sla_calculations AS (
        SELECT
          vt.id,
          vt.task_number,
          vt.first_assigned_at,
          sz.sla_hours,
          vt.first_assigned_at + (sz.sla_hours || ' hours')::INTERVAL as deadline,
          EXTRACT(EPOCH FROM (NOW() - vt.first_assigned_at)) / 
          EXTRACT(EPOCH FROM (sz.sla_hours || ' hours')::INTERVAL) as percent_elapsed,
          CASE
            WHEN NOW() > vt.first_assigned_at + (sz.sla_hours || ' hours')::INTERVAL THEN 'BREACHED'
            WHEN EXTRACT(EPOCH FROM (NOW() - vt.first_assigned_at)) / 
                 EXTRACT(EPOCH FROM (sz.sla_hours || ' hours')::INTERVAL) >= 0.75 THEN 'CRITICAL'
            WHEN EXTRACT(EPOCH FROM (NOW() - vt.first_assigned_at)) / 
                 EXTRACT(EPOCH FROM (sz.sla_hours || ' hours')::INTERVAL) >= 0.50 THEN 'WARNING'
            ELSE 'SAFE'
          END as sla_status
        FROM verification_tasks vt
        INNER JOIN service_zones sz ON vt.service_zone_id = sz.id
        LEFT JOIN cases c ON vt.case_id = c.id
        WHERE vt.status IN ('ASSIGNED', 'IN_PROGRESS')
          AND vt.first_assigned_at IS NOT NULL
          AND vt.service_zone_id IS NOT NULL
          ${filterConditions}
      )
      SELECT
        COUNT(*) FILTER (WHERE sla_status = 'SAFE') as safe,
        COUNT(*) FILTER (WHERE sla_status = 'WARNING') as warning,
        COUNT(*) FILTER (WHERE sla_status = 'CRITICAL') as critical,
        COUNT(*) FILTER (WHERE sla_status = 'BREACHED') as breached,
        COUNT(*) as total
      FROM sla_calculations
    `;

    const countsResult = await pool.query(slaCountsQuery, params);
    const counts = countsResult.rows[0];

    // Top 20 Critical Tasks Query
    const criticalTasksQuery = `
      SELECT
        vt.id,
        vt.task_number,
        vt.case_id,
        c."caseId" as case_number,
        c."customerName" as customer_name,
        vt.assigned_to,
        u."firstName" || ' ' || u."lastName" as assigned_user_name,
        vt.service_zone_id,
        sz.name as service_zone_name,
        sz.sla_hours,
        vt.first_assigned_at,
        vt.first_assigned_at + (sz.sla_hours || ' hours')::INTERVAL as deadline,
        EXTRACT(EPOCH FROM (
          (vt.first_assigned_at + (sz.sla_hours || ' hours')::INTERVAL) - NOW()
        )) / 3600 as time_remaining_hours,
        EXTRACT(EPOCH FROM (NOW() - vt.first_assigned_at)) / 
        EXTRACT(EPOCH FROM (sz.sla_hours || ' hours')::INTERVAL) * 100 as percent_elapsed,
        CASE
          WHEN NOW() > vt.first_assigned_at + (sz.sla_hours || ' hours')::INTERVAL THEN 'BREACHED'
          WHEN EXTRACT(EPOCH FROM (NOW() - vt.first_assigned_at)) / 
               EXTRACT(EPOCH FROM (sz.sla_hours || ' hours')::INTERVAL) >= 0.75 THEN 'CRITICAL'
          WHEN EXTRACT(EPOCH FROM (NOW() - vt.first_assigned_at)) / 
               EXTRACT(EPOCH FROM (sz.sla_hours || ' hours')::INTERVAL) >= 0.50 THEN 'WARNING'
          ELSE 'SAFE'
        END as sla_status,
        cl.name as client_name,
        p.name as product_name
      FROM verification_tasks vt
      INNER JOIN service_zones sz ON vt.service_zone_id = sz.id
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
      WHERE vt.status IN ('ASSIGNED', 'IN_PROGRESS')
        AND vt.first_assigned_at IS NOT NULL
        AND vt.service_zone_id IS NOT NULL
        AND EXTRACT(EPOCH FROM (NOW() - vt.first_assigned_at)) / 
            EXTRACT(EPOCH FROM (sz.sla_hours || ' hours')::INTERVAL) >= 0.75
        ${filterConditions}
      ORDER BY 
        vt.first_assigned_at + (sz.sla_hours || ' hours')::INTERVAL ASC
      LIMIT 20
    `;

    const criticalTasksResult = await pool.query(criticalTasksQuery, params);
    const criticalTasks = criticalTasksResult.rows.map(task => ({
      id: task.id,
      taskNumber: task.task_number,
      caseId: task.case_id,
      caseNumber: task.case_number,
      customerName: task.customer_name,
      assignedTo: task.assigned_to,
      assignedUserName: task.assigned_user_name,
      serviceZoneId: task.service_zone_id,
      serviceZoneName: task.service_zone_name,
      slaHours: parseInt(task.sla_hours),
      firstAssignedAt: task.first_assigned_at,
      deadline: task.deadline,
      timeRemaining: parseFloat(task.time_remaining_hours?.toFixed(2)) || 0,
      slaStatus: task.sla_status,
      percentElapsed: parseFloat(task.percent_elapsed?.toFixed(2)) || 0,
      clientName: task.client_name,
      productName: task.product_name,
    }));

    const slaRiskData = {
      summary: {
        safe: parseInt(counts.safe) || 0,
        warning: parseInt(counts.warning) || 0,
        critical: parseInt(counts.critical) || 0,
        breached: parseInt(counts.breached) || 0,
        total: parseInt(counts.total) || 0,
      },
      criticalTasks,
    };

    logger.info('SLA risk monitoring data retrieved', {
      userId: req.user?.id,
      totalTasks: slaRiskData.summary.total,
      criticalCount: slaRiskData.summary.critical,
      breachedCount: slaRiskData.summary.breached,
    });

    res.json({
      success: true,
      data: slaRiskData,
      message: 'SLA risk monitoring data retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving SLA risk monitoring data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve SLA risk monitoring data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
