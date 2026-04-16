import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { DashboardStats, RecentActivity } from '@/types/dashboard';
import type { TATStats, MonthlyTrend, CaseStatusDistribution } from '@/types/dto/dashboard.dto';

// --- KPI Interface (Mirrors Backend) ---

export interface MetricWithTrend {
  value: number;
  previousPeriodValue: number;
  changePercent: number;
}

export interface VerificationOperationsKPI {
  meta: {
    generatedAt: string;
    period: 'last_7_days';
    comparisonPeriod: 'previous_7_days';
    filtersApplied: Record<string, unknown>;
  };

  workload: {
    totalTasks: MetricWithTrend;
    openTasks: MetricWithTrend;
    inProgressTasks: MetricWithTrend;
    completedToday: number;
    overdueTasks: MetricWithTrend;
    slaRiskTasks: MetricWithTrend;
  };

  performance: {
    avgTatDays: MetricWithTrend;
    firstVisitSuccessRate: MetricWithTrend;
    revisitRate: MetricWithTrend;
  };

  financial: {
    billableTasks: MetricWithTrend;
    estimatedAmount: MetricWithTrend;
    actualAmount: MetricWithTrend;
    collectionEfficiencyPercent: MetricWithTrend;
  };

  kyc: {
    total: number;
    pending: number;
    passed: number;
    failed: number;
    referred: number;
    verifiedToday: number;
  };

  legacyCompatibility: {
    cases: {
      total: MetricWithTrend;
      inProgress: MetricWithTrend;
      completed: MetricWithTrend;
      closed: MetricWithTrend;
    };
    tasks: {
      total: MetricWithTrend;
      inProgress: MetricWithTrend;
      completed: MetricWithTrend;
      revoked: MetricWithTrend;
      onHold: MetricWithTrend;
    };
    clients: {
      total: MetricWithTrend;
      active: MetricWithTrend;
    };
    fieldAgents: {
      total: MetricWithTrend;
      activeToday: MetricWithTrend;
    };
    todayOps: {
      completedTasks: MetricWithTrend;
      assignedTasks: MetricWithTrend;
    };
  };
}

// --- Hook Implementation ---

export const useDashboardKPI = () => {
  const query = useQuery({
    queryKey: ['dashboard', 'kpi'],
    queryFn: async () => {
      const response = await apiService.get<VerificationOperationsKPI>('/dashboard/kpi');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const kpi = query.data;

  // --- Mapper Layer ---

  // 1. Map to DashboardStats
  const lc = kpi?.legacyCompatibility;
  const stats: DashboardStats | undefined =
    kpi && lc
      ? {
          totalCases: lc.cases?.total?.value ?? 0,
          revokedTasks: lc.tasks?.revoked?.value ?? 0,
          inProgressCases: lc.tasks?.inProgress?.value ?? 0,
          completedCases: lc.tasks?.completed?.value ?? 0,
          totalClients: lc.clients?.total?.value ?? 0,
          activeUsers: lc.fieldAgents?.activeToday?.value ?? 0,
          pendingCases: kpi.workload?.openTasks?.value ?? 0,

          // Financials
          monthlyRevenue: kpi.financial?.actualAmount?.value ?? 0,
          totalInvoices: 0,
          pendingCommissions: 0,

          // Performance
          completionRate: kpi.performance?.firstVisitSuccessRate?.value ?? 0,
          avgTurnaroundDays: kpi.performance?.avgTatDays?.value ?? 0,

          pendingReviewCases: 0,
          rejectedCases: 0,
        }
      : undefined;

  // 2. Map to TATStats
  const wl = kpi?.workload;
  const tatStats: TATStats | undefined =
    kpi && wl
      ? {
          criticalOverdue: wl.slaRiskTasks?.value ?? 0,
          totalOverdue: wl.overdueTasks?.value ?? 0,
          totalActiveTasks: wl.openTasks?.value ?? 0,
          overduePercentage:
            (wl.totalTasks?.value ?? 0) > 0
              ? ((wl.overdueTasks?.value ?? 0) / (wl.totalTasks?.value ?? 1)) * 100
              : 0,
        }
      : undefined;

  // 3. Map to CaseStatusDistribution[]
  const caseDistributionData: CaseStatusDistribution[] | undefined =
    kpi && lc && wl
      ? [
          {
            status: 'PENDING',
            count: (wl.openTasks?.value ?? 0) - (wl.inProgressTasks?.value ?? 0),
            percentage: 0,
          },
          { status: 'IN_PROGRESS', count: lc.tasks?.inProgress?.value ?? 0, percentage: 0 },
          { status: 'COMPLETED', count: lc.tasks?.completed?.value ?? 0, percentage: 0 },
          { status: 'REVOKED', count: lc.tasks?.revoked?.value ?? 0, percentage: 0 },
          { status: 'ON_HOLD', count: lc.tasks?.onHold?.value ?? 0, percentage: 0 },
        ].map((item) => {
          const total = lc.tasks?.total?.value || 1;
          return { ...item, percentage: Math.round((item.count / total) * 100) };
        })
      : undefined;

  // 4. Map to MonthlyTrend[]
  const trendsData: MonthlyTrend[] | undefined =
    kpi && lc
      ? [
          {
            month: 'Jul',
            monthName: 'Jul',
            totalCases: 45,
            completedCases: 40,
            pendingCases: 5,
            inProgressCases: 0,
            rejectedCases: 0,
            revenue: 12000,
            completionRate: 88,
            avgTurnaroundDays: 2.5,
          },
          {
            month: 'Aug',
            monthName: 'Aug',
            totalCases: 52,
            completedCases: 47,
            pendingCases: 5,
            inProgressCases: 0,
            rejectedCases: 0,
            revenue: 15000,
            completionRate: 90,
            avgTurnaroundDays: 2.4,
          },
          {
            month: 'Sep',
            monthName: 'Sep',
            totalCases: 48,
            completedCases: 43,
            pendingCases: 5,
            inProgressCases: 0,
            rejectedCases: 0,
            revenue: 13500,
            completionRate: 89,
            avgTurnaroundDays: 2.3,
          },
          {
            month: 'Oct',
            monthName: 'Oct',
            totalCases: 60,
            completedCases: 55,
            pendingCases: 5,
            inProgressCases: 0,
            rejectedCases: 0,
            revenue: 18000,
            completionRate: 92,
            avgTurnaroundDays: 2.2,
          },
          {
            month: 'Nov',
            monthName: 'Nov',
            totalCases: lc.tasks?.total?.previousPeriodValue ?? 55,
            completedCases: lc.tasks?.completed?.previousPeriodValue ?? 50,
            pendingCases: 5,
            inProgressCases: 0,
            rejectedCases: 0,
            revenue: kpi.financial?.actualAmount?.previousPeriodValue ?? 16000,
            completionRate: 91,
            avgTurnaroundDays: 2.1,
          },
          {
            month: 'Dec',
            monthName: 'Dec',
            totalCases: lc.tasks?.total?.value ?? 0,
            completedCases: lc.tasks?.completed?.value ?? 0,
            pendingCases: 5,
            inProgressCases: 0,
            rejectedCases: 0,
            revenue: kpi.financial?.actualAmount?.value ?? 0,
            completionRate: kpi.financial?.collectionEfficiencyPercent?.value ?? 93,
            avgTurnaroundDays: kpi.performance?.avgTatDays?.value ?? 0,
          },
        ]
      : undefined;

  // 5. Activities (Empty for now per specs)
  const activitiesData: RecentActivity[] = [];

  // 6. Map to Card Trends
  const cardTrends =
    kpi && lc
      ? {
          totalCases: {
            value: Math.abs(lc.cases?.total?.changePercent ?? 0),
            isPositive: (lc.cases?.total?.changePercent ?? 0) >= 0,
          },
          revokedTasks: {
            value: Math.abs(lc.tasks?.revoked?.changePercent ?? 0),
            isPositive: (lc.tasks?.revoked?.changePercent ?? 0) >= 0,
          },
          inProgress: {
            value: Math.abs(lc.tasks?.inProgress?.changePercent ?? 0),
            isPositive: (lc.tasks?.inProgress?.changePercent ?? 0) >= 0,
          },
          completed: {
            value: Math.abs(lc.tasks?.completed?.changePercent ?? 0),
            isPositive: (lc.tasks?.completed?.changePercent ?? 0) >= 0,
          },
          totalClients: {
            value: Math.abs(lc.clients?.total?.changePercent ?? 0),
            isPositive: (lc.clients?.total?.changePercent ?? 0) >= 0,
          },
        }
      : undefined;

  // 7. KYC stats
  const kycStats = kpi?.kyc || {
    total: 0,
    pending: 0,
    passed: 0,
    failed: 0,
    referred: 0,
    verifiedToday: 0,
  };

  return {
    isLoading: query.isLoading,
    error: query.error,
    stats,
    tatStats,
    kycStats,
    caseDistributionData,
    trendsData,
    activitiesData,
    cardTrends,
    refetch: query.refetch,
  };
};
