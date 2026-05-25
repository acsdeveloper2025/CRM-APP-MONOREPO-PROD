import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { DashboardStats, RecentActivity } from '@/types/dashboard';
import type { TATStats, CaseStatusDistribution } from '@/types/dto/dashboard.dto';

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
    refetchOnWindowFocus: true, // KPIs change with case/task activity — refresh on tab return
  });

  const activitiesQuery = useQuery({
    queryKey: ['dashboard', 'recent-activities'],
    queryFn: async () => {
      const response = await apiService.get<RecentActivity[]>('/dashboard/recent-activities', {
        limit: 20,
      });
      return response.data ?? [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
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
          // `openTasks` from the KPI Engine = COUNT(status IN ('PENDING','ASSIGNED','IN_PROGRESS')).
          // The "Pending Tasks" card on the dashboard is labeled "Pending & Assigned tasks", so we
          // must exclude IN_PROGRESS — otherwise an IN_PROGRESS task counts on both the Pending and
          // the In Progress cards. Mirrors the same derivation in the backend's /dashboard endpoint
          // (dashboardController.ts: `derivedPending = Math.max(0, openTasksVal - inProgressVal)`).
          pendingCases: Math.max(
            0,
            (kpi.workload?.openTasks?.value ?? 0) - (kpi.workload?.inProgressTasks?.value ?? 0)
          ),

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
          onTrack: 0,
          avgOverdueDays: 0,
          completedToday: 0,
          overduePercentage:
            (wl.totalTasks?.value ?? 0) > 0
              ? ((wl.overdueTasks?.value ?? 0) / (wl.totalTasks?.value ?? 1)) * 100
              : 0,
        }
      : undefined;

  // 3. Map to CaseStatusDistribution[] — denominator is the sum of slice counts
  // so percentages always total 100 (prevents the prior 500% PENDING bug where
  // the denominator came from a different scope than the numerator).
  const caseDistributionData: CaseStatusDistribution[] | undefined =
    kpi && lc && wl
      ? (() => {
          const slices = [
            {
              status: 'PENDING',
              count: Math.max(0, (wl.openTasks?.value ?? 0) - (wl.inProgressTasks?.value ?? 0)),
            },
            { status: 'IN_PROGRESS', count: lc.tasks?.inProgress?.value ?? 0 },
            { status: 'COMPLETED', count: lc.tasks?.completed?.value ?? 0 },
            { status: 'REVOKED', count: lc.tasks?.revoked?.value ?? 0 },
          ];
          const total = slices.reduce((acc, s) => acc + s.count, 0) || 1;
          return slices.map((s) => ({
            ...s,
            percentage: Math.round((s.count / total) * 100),
          }));
        })()
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
    activitiesData: activitiesQuery.data ?? [],
    activitiesLoading: activitiesQuery.isLoading,
    refetch: query.refetch,
  };
};
