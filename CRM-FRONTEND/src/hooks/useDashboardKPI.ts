import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { 
  DashboardStats, 
  RecentActivity 
} from '@/types/dashboard';
import type { 
  TATStats,
  MonthlyTrend,
  CaseStatusDistribution
} from '@/types/dto/dashboard.dto';

// --- KPI Interface (Mirrors Backend) ---

export interface MetricWithTrend {
  value: number;
  previousPeriodValue: number;
  changePercent: number;
}

export interface VerificationOperationsKPI {
  meta: {
    generated_at: string;
    period: 'last_7_days'; 
    comparison_period: 'previous_7_days';
    filters_applied: Record<string, unknown>;
  };

  workload: {
    totalTasks: MetricWithTrend;
    openTasks: MetricWithTrend;
    inProgressTasks: MetricWithTrend;
    completed_today: number;
    overdueTasks: MetricWithTrend;
    slaRiskTasks: MetricWithTrend;
  };

  performance: {
    avgTatDays: MetricWithTrend;
    firstVisitSuccessRate: MetricWithTrend;
    revisit_rate: MetricWithTrend;
  };

  financial: {
    billable_tasks: MetricWithTrend;
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
    verified_today: number;
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
    today_ops: {
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
  const stats: DashboardStats | undefined = kpi ? {
    totalCases: kpi.legacyCompatibility.cases.total.value,
    revokedTasks: kpi.legacyCompatibility.tasks.revoked.value,
    inProgressCases: kpi.legacyCompatibility.tasks.inProgress.value,
    completedCases: kpi.legacyCompatibility.tasks.completed.value,
    totalClients: kpi.legacyCompatibility.clients.total.value,
    activeUsers: kpi.legacyCompatibility.fieldAgents.activeToday.value, // Using active agents as proxy
    pendingCases: kpi.workload.openTasks.value, // Using open tasks as proxy
    
    // Financials
    monthlyRevenue: kpi.financial.actualAmount.value,
    totalInvoices: 0, // Not in KPI yet
    pendingCommissions: 0, // Not in KPI yet
    
    // Performance
    completionRate: kpi.performance.firstVisitSuccessRate.value, // Proxy
    avgTurnaroundDays: kpi.performance.avgTatDays.value,
    
    pendingReviewCases: 0, 
    rejectedCases: 0 
  } : undefined;

  // 2. Map to TATStats
  const tatStats: TATStats | undefined = kpi ? {
    criticalOverdue: kpi.workload.slaRiskTasks.value,
    totalOverdue: kpi.workload.overdueTasks.value,
    totalActiveTasks: kpi.workload.openTasks.value,
    overduePercentage: kpi.workload.totalTasks.value > 0 
      ? (kpi.workload.overdueTasks.value / kpi.workload.totalTasks.value) * 100 
      : 0
  } : undefined;

  // 3. Map to CaseStatusDistribution[]
  const caseDistributionData: CaseStatusDistribution[] | undefined = kpi ? [
    { status: 'PENDING', count: kpi.workload.openTasks.value - kpi.workload.inProgressTasks.value, percentage: 0 }, // Rough calc
    { status: 'IN_PROGRESS', count: kpi.legacyCompatibility.tasks.inProgress.value, percentage: 0 },
    { status: 'COMPLETED', count: kpi.legacyCompatibility.tasks.completed.value, percentage: 0 },
    { status: 'REVOKED', count: kpi.legacyCompatibility.tasks.revoked.value, percentage: 0 },
    { status: 'ON_HOLD', count: kpi.legacyCompatibility.tasks.onHold.value, percentage: 0 }
  ].map(item => {
    // Calculate percentages
    const total = kpi.legacyCompatibility.tasks.total.value || 1;
    return {
      ...item,
      percentage: Math.round((item.count / total) * 100)
    };
  }) : undefined;

  // 4. Map to MonthlyTrend[] (Mock History for now, per specs)
  // KPI provides current and previous period. We can show 2 points or mock 6.
  // Instruction says: "Return 6 months mock history if KPI does not provide historical yet"
  const trendsData: MonthlyTrend[] | undefined = kpi ? [
    { month: 'Jul', monthName: 'Jul', totalCases: 45, completedCases: 40, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: 12000, completionRate: 88, avgTurnaroundDays: 2.5 },
    { month: 'Aug', monthName: 'Aug', totalCases: 52, completedCases: 47, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: 15000, completionRate: 90, avgTurnaroundDays: 2.4 },
    { month: 'Sep', monthName: 'Sep', totalCases: 48, completedCases: 43, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: 13500, completionRate: 89, avgTurnaroundDays: 2.3 },
    { month: 'Oct', monthName: 'Oct', totalCases: 60, completedCases: 55, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: 18000, completionRate: 92, avgTurnaroundDays: 2.2 },
    { month: 'Nov', monthName: 'Nov', totalCases: kpi.legacyCompatibility.tasks.total.previousPeriodValue || 55, completedCases: kpi.legacyCompatibility.tasks.completed.previousPeriodValue || 50, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: kpi.financial.actualAmount.previousPeriodValue || 16000, completionRate: 91, avgTurnaroundDays: 2.1 },
    { month: 'Dec', monthName: 'Dec', totalCases: kpi.legacyCompatibility.tasks.total.value, completedCases: kpi.legacyCompatibility.tasks.completed.value, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: kpi.financial.actualAmount.value, completionRate: kpi.financial.collectionEfficiencyPercent.value || 93, avgTurnaroundDays: kpi.performance.avgTatDays.value }
  ] : undefined;

  // 5. Activities (Empty for now per specs)
  const activitiesData: RecentActivity[] = [];

  // 6. Map to Card Trends
  const cardTrends = kpi ? {
    totalCases: {
      value: Math.abs(kpi.legacyCompatibility.cases.total.changePercent),
      isPositive: kpi.legacyCompatibility.cases.total.changePercent >= 0
    },
    revokedTasks: {
      value: Math.abs(kpi.legacyCompatibility.tasks.revoked.changePercent),
      isPositive: kpi.legacyCompatibility.tasks.revoked.changePercent >= 0
    },
    inProgress: {
      value: Math.abs(kpi.legacyCompatibility.tasks.inProgress.changePercent),
      isPositive: kpi.legacyCompatibility.tasks.inProgress.changePercent >= 0
    },
    completed: {
      value: Math.abs(kpi.legacyCompatibility.tasks.completed.changePercent),
      isPositive: kpi.legacyCompatibility.tasks.completed.changePercent >= 0
    },
    totalClients: {
      value: Math.abs(kpi.legacyCompatibility.clients.total.changePercent),
      isPositive: kpi.legacyCompatibility.clients.total.changePercent >= 0
    }
  } : undefined;

  // 7. KYC stats
  const kycStats = kpi?.kyc || { total: 0, pending: 0, passed: 0, failed: 0, referred: 0, verified_today: 0 };

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
    refetch: query.refetch
  };
};
