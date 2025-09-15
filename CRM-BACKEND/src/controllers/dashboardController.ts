import { Request, Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { pool } from '@/config/database';

// Mock data removed - using database operations only

// GET /api/dashboard - Get dashboard overview
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

    // Get cases from database with filters
    let casesQuery = 'SELECT * FROM cases WHERE "createdAt" >= $1';
    const queryParams: any[] = [startDate];
    let paramIndex = 2;

    if (clientId) {
      casesQuery += ` AND "clientId" = $${paramIndex}`;
      queryParams.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (userId) {
      casesQuery += ` AND "assignedTo" = $${paramIndex}`;
      queryParams.push(parseInt(userId as string));
      paramIndex++;
    }

    const casesResult = await pool.query(casesQuery, queryParams);
    const filteredCases = casesResult.rows;

    // Calculate case statistics
    const totalCases = filteredCases.length;
    const pendingCases = filteredCases.filter(c => c.status === 'PENDING').length;
    const inProgressCases = filteredCases.filter(c => c.status === 'IN_PROGRESS').length;
    const completedCases = filteredCases.filter(c => c.status === 'COMPLETED' || c.status === 'APPROVED').length;
    const rejectedCases = filteredCases.filter(c => c.status === 'REJECTED').length;

    // Get additional statistics from database
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM clients WHERE "isActive" = true) as "totalClients",
        (SELECT COUNT(*) FROM users WHERE "isActive" = true) as "activeUsers",
        (SELECT COUNT(*) FROM users) as "totalUsers"
    `;

    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    const dashboardData = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      summary: {
        totalCases,
        pendingCases,
        inProgressCases,
        completedCases,
        rejectedCases,
        completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
        totalClients: parseInt(stats.totalClients) || 0,
        activeUsers: parseInt(stats.activeUsers) || 0,
        totalUsers: parseInt(stats.totalUsers) || 0,
      },
    };

    logger.info('Dashboard data retrieved', {
      userId: req.user?.id,
      period,
      totalCases,
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
    const statusDistribution = statusResult.rows.reduce((acc: any, row) => {
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
    const priorityDistribution = priorityResult.rows.reduce((acc: any, row) => {
      acc[row.priority] = parseInt(row.count);
      return acc;
    }, {});

    // Get user performance from database
    const userPerformanceQuery = `
      SELECT
        u.name,
        u.id,
        COUNT(c."caseId") as "totalCases",
        COUNT(CASE WHEN c.status = 'COMPLETED' THEN 1 END) as "completedCases",
        COUNT(CASE WHEN c.status = 'APPROVED' THEN 1 END) as "approvedCases"
      FROM users u
      LEFT JOIN cases c ON u.id = c."assignedTo"
      WHERE u."isActive" = true
      GROUP BY u.id, u.name
      ORDER BY "totalCases" DESC
      LIMIT 10
    `;
    const userPerformanceResult = await pool.query(userPerformanceQuery);
    const userPerformance = userPerformanceResult.rows.map(user => ({
      id: user.id,
      name: user.name,
      totalCases: parseInt(user.totalCases) || 0,
      completedCases: parseInt(user.completedCases) || 0,
      approvedCases: parseInt(user.approvedCases) || 0,
      completionRate: user.totalCases > 0 ?
        Math.round(((parseInt(user.completedCases) + parseInt(user.approvedCases)) / parseInt(user.totalCases)) * 100) : 0,
    }));

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
    // Get recent cases as activities from database
    const recentCasesQuery = `
      SELECT
        c."caseId" as id,
        'CASE_UPDATED' as type,
        CONCAT('Case ', c."caseId", ' - ', c."customerName") as description,
        c."assignedTo" as "userId",
        c."updatedAt" as timestamp,
        u.name as "userName"
      FROM cases c
      LEFT JOIN users u ON c."assignedTo" = u.id
      ORDER BY c."updatedAt" DESC
      LIMIT 10
    `;

    const result = await pool.query(recentCasesQuery);
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
          WHEN "completedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400
        END) as "avgTurnaroundDays"
      FROM cases
    `;

    const result = await pool.query(metricsQuery);
    const metrics = result.rows[0];

    const totalCases = parseInt(metrics.totalCases) || 0;
    const completedCases = parseInt(metrics.completedCases) || 0;
    const avgTurnaroundDays = parseFloat(metrics.avgTurnaroundDays) || 0;

    // Get user-specific metrics
    const userMetricsQuery = `
      SELECT
        u.name,
        u.id,
        COUNT(c."caseId") as "assignedCases",
        COUNT(CASE WHEN c.status = 'COMPLETED' OR c.status = 'APPROVED' THEN 1 END) as "completedCases",
        AVG(CASE
          WHEN c."completedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c."completedAt" - c."createdAt")) / 86400
        END) as "avgTurnaroundDays"
      FROM users u
      LEFT JOIN cases c ON u.id = c."assignedTo"
      WHERE u."isActive" = true
      GROUP BY u.id, u.name
      HAVING COUNT(c."caseId") > 0
      ORDER BY "completedCases" DESC
      LIMIT 10
    `;

    const userResult = await pool.query(userMetricsQuery);
    const userMetrics = userResult.rows.map(user => ({
      id: user.id,
      name: user.name,
      assignedCases: parseInt(user.assignedCases) || 0,
      completedCases: parseInt(user.completedCases) || 0,
      completionRate: user.assignedCases > 0 ?
        Math.round((parseInt(user.completedCases) / parseInt(user.assignedCases)) * 100) : 0,
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
    const { period = 'month', clientId, userId } = req.query;

    // Role-based filtering - FIELD_AGENT users can only see their own stats
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;
    const effectiveUserId = userRole === 'FIELD_AGENT' ? currentUserId : userId;

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

    // Build role-based filtering condition
    const roleFilter = effectiveUserId ? ` AND "assignedTo" = '${effectiveUserId}'` : '';

    // Get comprehensive statistics from database
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM cases WHERE "createdAt" >= $1${roleFilter}) as "totalCases",
        (SELECT COUNT(*) FROM cases WHERE "createdAt" >= $1 AND status = 'PENDING'${roleFilter}) as "pendingCases",
        (SELECT COUNT(*) FROM cases WHERE "createdAt" >= $1 AND status = 'IN_PROGRESS'${roleFilter}) as "inProgressCases",
        (SELECT COUNT(*) FROM cases WHERE "createdAt" >= $1 AND (status = 'COMPLETED' OR status = 'APPROVED')${roleFilter}) as "completedCases",
        (SELECT COUNT(*) FROM cases WHERE "createdAt" >= $1 AND status = 'REJECTED'${roleFilter}) as "rejectedCases",
        (SELECT COUNT(*) FROM clients WHERE "isActive" = true) as "totalClients",
        (SELECT COUNT(*) FROM users WHERE "isActive" = true) as "activeUsers",
        (SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400)
         FROM cases
         WHERE status IN ('COMPLETED', 'APPROVED') AND "createdAt" >= $1${roleFilter}) as "avgTurnaroundDays"
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
    const effectiveUserId = userRole === 'FIELD_AGENT' ? currentUserId : userId;

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
        status,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM cases
      WHERE "createdAt" >= $1
    `;
    const queryParams: any[] = [startDate];
    let paramIndex = 2;

    if (clientId) {
      statusQuery += ` AND "clientId" = $${paramIndex}`;
      queryParams.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (effectiveUserId) {
      statusQuery += ` AND "assignedTo" = $${paramIndex}`;
      queryParams.push(effectiveUserId);
      paramIndex++;
    }

    statusQuery += ` GROUP BY status ORDER BY count DESC`;

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
    const effectiveUserId = userRole === 'FIELD_AGENT' ? currentUserId : userId;
    const monthsCount = parseInt(months as string);

    // Calculate start date based on months parameter
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);

    // Build query with filters
    let trendsQuery = `
      SELECT
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as "totalCases",
        COUNT(CASE WHEN status = 'COMPLETED' OR status = 'APPROVED' THEN 1 END) as "completedCases",
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as "pendingCases",
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as "inProgressCases",
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as "rejectedCases",
        AVG(CASE
          WHEN status IN ('COMPLETED', 'APPROVED')
          THEN EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400
        END) as "avgTurnaroundDays"
      FROM cases
      WHERE "createdAt" >= $1
    `;
    const queryParams: any[] = [startDate];
    let paramIndex = 2;

    if (clientId) {
      trendsQuery += ` AND "clientId" = $${paramIndex}`;
      queryParams.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (effectiveUserId) {
      trendsQuery += ` AND "assignedTo" = $${paramIndex}`;
      queryParams.push(effectiveUserId);
      paramIndex++;
    }

    trendsQuery += `
      GROUP BY DATE_TRUNC('month', "createdAt")
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
          month: 'long'
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
      const existingData = trends.find(t =>
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
            month: 'long'
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