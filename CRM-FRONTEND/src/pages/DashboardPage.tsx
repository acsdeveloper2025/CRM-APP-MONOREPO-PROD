import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { CaseStatusChart } from '@/components/dashboard/CaseStatusChart';
import { MonthlyTrendsChart } from '@/components/dashboard/MonthlyTrendsChart';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { useDashboardKPI } from '@/hooks/useDashboardKPI';
import { usePermission } from '@/hooks/usePermissions';
import {
  XCircle,
  CheckSquare,
  Plus,
  CheckCircle,
  FileText,
  Download,
  AlertTriangle,
  FileCheck,
  Clock,
  ShieldCheck,
  ShieldX,
  AlertCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const hasKYCAccess = usePermission('page.kyc');
  const hasCasesAccess = usePermission('page.cases');
  const hasTasksAccess = usePermission('page.tasks');
  const hasBillingAccess = usePermission('page.billing');

  // Fetch dashboard data via Unified KPI Engine
  const {
    stats: kpiStats,
    tatStats: tatStatsRaw,
    kycStats: kycStatsRaw,
    caseDistributionData: distData,
    trendsData: trData,
    activitiesData: actData,
    cardTrends,
    isLoading,
  } = useDashboardKPI();

  // Adapters for legacy JSX compatibility
  const statsData = { data: kpiStats };
  const tatStatsData = { data: tatStatsRaw };
  const caseDistributionData = { data: distData };
  const trendsData = { data: trData };
  const activitiesData = { data: actData };

  const activitiesLoading = isLoading;
  const distributionLoading = isLoading;
  const trendsLoading = isLoading;

  // Mock data fallback for development

  const stats = statsData?.data || {
    totalCases: 0,
    pendingCases: 0,
    inProgressCases: 0,
    completedCases: 0,
    revokedTasks: 0,
    rejectedCases: 0,
    activeUsers: 0,
    totalClients: 0,
    pendingReviewCases: 0,
    monthlyRevenue: 0,
    totalInvoices: 0,
    pendingCommissions: 0,
    completionRate: 0,
    avgTurnaroundDays: 0,
  };

  const tatStats = tatStatsData?.data || {
    criticalOverdue: 0,
    totalOverdue: 0,
    totalActiveTasks: 0,
    overduePercentage: 0,
  };

  const kycStats = kycStatsRaw || {
    total: 0,
    pending: 0,
    passed: 0,
    failed: 0,
    referred: 0,
    verifiedToday: 0,
  };

  // Mock data removed - using real API data only

  // Fallback data for charts when API data is not available
  const mockCaseDistribution = [
    { status: 'PENDING', count: 0, percentage: 0 },
    { status: 'IN_PROGRESS', count: 0, percentage: 0 },
    { status: 'COMPLETED', count: 0, percentage: 0 },
    { status: 'PENDING_REVIEW', count: 0, percentage: 0 },
  ];

  const mockTrends = [
    { month: 'Jan', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Feb', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Mar', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Apr', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'May', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Jun', totalCases: 0, revenue: 0, completionRate: 0 },
  ];

  // Activities handled by kpiStats or actData

  const quickActions = [
    ...(hasCasesAccess
      ? [
          {
            title: 'Create New Case',
            description: 'Assign new case to field user',
            href: '/cases/new',
            icon: Plus,
            count: null as number | null,
            color: 'bg-green-500',
          },
          {
            title: 'All Cases',
            description: 'View all case statuses',
            href: '/cases',
            icon: FileText,
            count: stats.totalCases,
            color: 'bg-green-500',
          },
        ]
      : []),
    ...(hasTasksAccess
      ? [
          {
            title: 'Pending Reviews',
            description: 'Cases waiting for approval',
            href: '/tasks/pending',
            icon: CheckSquare,
            count: stats.pendingReviewCases,
            color: 'bg-yellow-500',
          },
          {
            title: 'Completed Tasks',
            description: 'View finished verifications',
            href: '/tasks/completed',
            icon: CheckCircle,
            count: stats.completedCases,
            color: 'bg-green-500',
          },
        ]
      : []),
    ...(hasKYCAccess
      ? [
          {
            title: 'KYC Dashboard',
            description: 'View all KYC verifications',
            href: '/kyc',
            icon: FileCheck,
            count: kycStats.total,
            color: 'bg-blue-500',
          },
          {
            title: 'Pending KYC',
            description: 'Documents awaiting verification',
            href: '/kyc',
            icon: Clock,
            count: kycStats.pending,
            color: 'bg-amber-500',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Dashboard</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Welcome back! Here&apos;s what&apos;s happening with your cases today.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 hover:shadow-md transition-all duration-200 w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          <span>Export Report</span>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Pending Tasks"
          value={stats.pendingCases || 0}
          description="Pending & Assigned tasks"
          icon={FileText}
          trend={cardTrends?.totalCases}
          color="text-blue-600"
          onClick={() => navigate('/tasks/pending')}
          className="cursor-pointer"
        />
        <StatsCard
          title="In Progress"
          value={stats.inProgressCases}
          description="from last month"
          icon={CheckSquare}
          trend={cardTrends?.inProgress}
          color="text-yellow-600"
          onClick={() => navigate('/tasks/in-progress')}
          className="cursor-pointer"
        />
        <StatsCard
          title="TAT Overdue"
          value={tatStats.criticalOverdue}
          description={`${tatStats.totalOverdue} total overdue`}
          icon={AlertTriangle}
          color="text-red-600"
          onClick={() => navigate('/tasks/tat-monitoring')}
          className="cursor-pointer"
        />
        <StatsCard
          title="Revoked Tasks"
          value={stats.revokedTasks || 0}
          description="Tasks revoked"
          icon={XCircle}
          trend={cardTrends?.revokedTasks}
          color="text-red-600"
          onClick={() => navigate('/tasks/revoked')}
          className="cursor-pointer"
        />
        <StatsCard
          title="Completed"
          value={stats.completedCases}
          description="from last month"
          icon={CheckSquare}
          trend={cardTrends?.completed}
          color="text-green-600"
          onClick={() => navigate('/tasks/completed')}
          className="cursor-pointer"
        />
      </div>

      {/* KYC Verification Stats */}
      {hasKYCAccess && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">KYC Document Verification</h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <StatsCard
              title="Total KYC"
              value={kycStats.total}
              description="All documents"
              icon={FileCheck}
              color="text-blue-600"
              onClick={() => navigate('/kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Pending"
              value={kycStats.pending}
              description="Awaiting verification"
              icon={Clock}
              color="text-amber-600"
              onClick={() => navigate('/kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Passed"
              value={kycStats.passed}
              description="Verified successfully"
              icon={ShieldCheck}
              color="text-green-600"
              onClick={() => navigate('/kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Failed"
              value={kycStats.failed}
              description="Verification failed"
              icon={ShieldX}
              color="text-red-600"
              onClick={() => navigate('/kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Referred"
              value={kycStats.referred}
              description="Needs further review"
              icon={AlertCircle}
              color="text-purple-600"
              onClick={() => navigate('/kyc')}
              className="cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CaseStatusChart
          data={caseDistributionData?.data || mockCaseDistribution}
          isLoading={distributionLoading}
        />
        <MonthlyTrendsChart data={trendsData?.data || mockTrends} isLoading={trendsLoading} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => (
              <Link key={index} to={action.href}>
                <div className="group relative overflow-hidden rounded-lg border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${action.color} text-white`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 group-hover:text-green-600">
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-600">{action.description}</p>
                      {action.count !== null && (
                        <p className="text-lg font-bold text-gray-900 mt-1">{action.count}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities and Additional Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivities activities={activitiesData?.data || []} isLoading={activitiesLoading} />
        </div>

        <div className="space-y-6">
          {/* Additional KPIs */}
          {hasBillingAccess && (
            <Card>
              <CardHeader>
                <CardTitle>Financial Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Monthly Revenue</span>
                  <span className="font-bold text-green-600">
                    ${stats.monthlyRevenue?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Invoices</span>
                  <span className="font-bold text-gray-900">{stats.totalInvoices || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending Commissions</span>
                  <span className="font-bold text-yellow-600">{stats.pendingCommissions || 0}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg. Completion Time</span>
                <span className="font-bold text-gray-900">
                  {stats.avgTurnaroundDays ? `${stats.avgTurnaroundDays.toFixed(1)} days` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="font-bold text-green-600">
                  {stats.completionRate ? `${stats.completionRate.toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between" title="Based on completed tasks">
                <span className="text-sm text-gray-600">Operations Health</span>
                <span className="font-bold text-green-600">Stable</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
