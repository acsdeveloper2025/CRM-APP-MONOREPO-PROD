import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { CaseStatusChart } from '@/components/dashboard/CaseStatusChart';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { useDashboardKPI } from '@/hooks/useDashboardKPI';
import { usePermission } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { dashboardService } from '@/services/dashboard';
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
  // KYC dashboard cards: any user who can touch cases (creators, viewers, KYC reviewers).
  // Backend kycQuery is RBAC-scoped (creator/client/product/hierarchy), so case-creators see
  // only KYC stats for cases they're authorized on — no cross-tenant leak.
  // Defense-in-depth: also fall back to role check so a perms-array race (login response
  // missing perms before /auth/me populated state) never hides the section for case-touching roles.
  const { user } = useAuth();
  const hasKYCPagePermission = usePermission('page.kyc');
  const hasCaseViewPermission = usePermission('case.view');
  const hasCaseCreatePermission = usePermission('case.create');
  const role = (user?.role || '').toString().toUpperCase();
  const isCaseTouchingRole = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'TEAM_LEAD',
    'BACKEND_USER',
  ].includes(role);
  const hasKYCAccess =
    hasKYCPagePermission || hasCaseViewPermission || hasCaseCreatePermission || isCaseTouchingRole;
  const hasCasesAccess = usePermission('page.cases');
  const hasTasksAccess = usePermission('page.tasks');

  // Fetch dashboard data via Unified KPI Engine
  const {
    stats: kpiStats,
    tatStats: tatStatsRaw,
    kycStats: kycStatsRaw,
    caseDistributionData: distData,
    activitiesData: actData,
    activitiesLoading,
    isLoading,
  } = useDashboardKPI();

  const [isExporting, setIsExporting] = React.useState(false);

  // Adapters for legacy JSX compatibility
  const statsData = { data: kpiStats };
  const tatStatsData = { data: tatStatsRaw };
  const caseDistributionData = { data: distData };
  const activitiesData = { data: actData };

  const distributionLoading = isLoading;

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

  // Fallback for charts when API data is not available
  const mockCaseDistribution = [
    { status: 'PENDING', count: 0, percentage: 0 },
    { status: 'IN_PROGRESS', count: 0, percentage: 0 },
    { status: 'COMPLETED', count: 0, percentage: 0 },
    { status: 'REVOKED', count: 0, percentage: 0 },
  ];

  const quickActions = [
    ...(hasCasesAccess
      ? [
          {
            title: 'Create New Case',
            description: 'Assign new case to field user',
            href: '/case-management/create-new-case',
            icon: Plus,
            count: null as number | null,
            color: 'bg-green-500',
          },
          {
            title: 'All Cases',
            description: 'View all case statuses',
            href: '/case-management/all-cases',
            icon: FileText,
            count: stats.totalCases,
            color: 'bg-green-500',
          },
        ]
      : []),
    ...(hasTasksAccess
      ? [
          {
            title: 'Completed Tasks',
            description: 'View finished verifications',
            href: '/task-management/completed-tasks',
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
            href: '/kyc-verification/all-kyc',
            icon: FileCheck,
            count: kycStats.total,
            color: 'bg-blue-500',
          },
          {
            title: 'Pending KYC',
            description: 'Documents awaiting verification',
            href: '/kyc-verification/all-kyc',
            icon: Clock,
            count: kycStats.pending,
            color: 'bg-amber-500',
          },
        ]
      : []),
  ];

  const handleExportDashboard = async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const blob = await dashboardService.exportDashboardReport();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Dashboard exported');
    } catch (error) {
      logger.error('Dashboard export failed', error);
      toast.error('Failed to export dashboard');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">Dashboard</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground">
            Welcome back! Here&apos;s what&apos;s happening with your cases today.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportDashboard}
          disabled={isExporting || isLoading}
          className="flex items-center space-x-2 hover:shadow-md transition-all duration-200 w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          <span>{isExporting ? 'Exporting…' : 'Export Report'}</span>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Pending Tasks"
          value={stats.pendingCases || 0}
          description="Pending & Assigned tasks"
          icon={FileText}
          color="text-blue-600"
          onClick={() => navigate('/task-management/pending-tasks')}
          className="cursor-pointer"
        />
        <StatsCard
          title="In Progress"
          value={stats.inProgressCases}
          description="Currently in progress"
          icon={CheckSquare}
          color="text-yellow-600"
          onClick={() => navigate('/task-management/in-progress-tasks')}
          className="cursor-pointer"
        />
        <StatsCard
          title="TAT Overdue"
          value={tatStats.criticalOverdue}
          description={`${tatStats.totalOverdue} total overdue`}
          icon={AlertTriangle}
          color="text-red-600"
          onClick={() => navigate('/task-management/tat-monitoring')}
          className="cursor-pointer"
        />
        <StatsCard
          title="Revoked Tasks"
          value={stats.revokedTasks || 0}
          description="Tasks revoked"
          icon={XCircle}
          color="text-red-600"
          onClick={() => navigate('/task-management/revoke-tasks')}
          className="cursor-pointer"
        />
        <StatsCard
          title="Completed"
          value={stats.completedCases}
          description="Completed tasks"
          icon={CheckSquare}
          color="text-green-600"
          onClick={() => navigate('/task-management/completed-tasks')}
          className="cursor-pointer"
        />
      </div>

      {/* KYC Verification Stats */}
      {hasKYCAccess && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">KYC Document Verification</h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <StatsCard
              title="Total KYC"
              value={kycStats.total}
              description="All documents"
              icon={FileCheck}
              color="text-blue-600"
              onClick={() => navigate('/kyc-verification/all-kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Pending"
              value={kycStats.pending}
              description="Awaiting verification"
              icon={Clock}
              color="text-amber-600"
              onClick={() => navigate('/kyc-verification/all-kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Passed"
              value={kycStats.passed}
              description="Verified successfully"
              icon={ShieldCheck}
              color="text-green-600"
              onClick={() => navigate('/kyc-verification/all-kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Failed"
              value={kycStats.failed}
              description="Verification failed"
              icon={ShieldX}
              color="text-red-600"
              onClick={() => navigate('/kyc-verification/all-kyc')}
              className="cursor-pointer"
            />
            <StatsCard
              title="Referred"
              value={kycStats.referred}
              description="Needs further review"
              icon={AlertCircle}
              color="text-purple-600"
              onClick={() => navigate('/kyc-verification/all-kyc')}
              className="cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Charts Section */}
      <CaseStatusChart
        data={caseDistributionData?.data || mockCaseDistribution}
        isLoading={distributionLoading}
      />

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
                      <h3 className="font-medium text-foreground group-hover:text-green-600">
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                      {action.count !== null && (
                        <p className="text-lg font-bold text-foreground mt-1">{action.count}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <RecentActivities activities={activitiesData?.data || []} isLoading={activitiesLoading} />
    </div>
  );
};
