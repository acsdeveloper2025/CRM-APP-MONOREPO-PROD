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
  previous_period_value: number;
  change_percent: number;
}

export interface VerificationOperationsKPI {
  meta: {
    generated_at: string;
    period: 'last_7_days'; 
    comparison_period: 'previous_7_days';
    filters_applied: Record<string, unknown>;
  };

  workload: {
    total_tasks: MetricWithTrend;
    open_tasks: MetricWithTrend;
    in_progress_tasks: MetricWithTrend;
    completed_today: number;
    overdue_tasks: MetricWithTrend;
    sla_risk_tasks: MetricWithTrend;
  };

  performance: {
    avg_tat_days: MetricWithTrend;
    first_visit_success_rate: MetricWithTrend;
    revisit_rate: MetricWithTrend;
  };

  financial: {
    billable_tasks: MetricWithTrend;
    estimated_amount: MetricWithTrend;
    actual_amount: MetricWithTrend;
    collection_efficiency_percent: MetricWithTrend;
  };

  legacy_compatibility: {
    cases: {
      total: MetricWithTrend;
      in_progress: MetricWithTrend;
      completed: MetricWithTrend;
      closed: MetricWithTrend;
    };
    tasks: {
      total: MetricWithTrend;
      in_progress: MetricWithTrend;
      completed: MetricWithTrend;
      revoked: MetricWithTrend;
      on_hold: MetricWithTrend;
    };
    clients: {
      total: MetricWithTrend;
      active: MetricWithTrend;
    };
    field_agents: {
      total: MetricWithTrend;
      active_today: MetricWithTrend;
    };
    today_ops: {
      completed_tasks: MetricWithTrend;
      assigned_tasks: MetricWithTrend;
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
    totalCases: kpi.legacy_compatibility.cases.total.value,
    revokedTasks: kpi.legacy_compatibility.tasks.revoked.value,
    inProgressCases: kpi.legacy_compatibility.tasks.in_progress.value,
    completedCases: kpi.legacy_compatibility.tasks.completed.value,
    totalClients: kpi.legacy_compatibility.clients.total.value,
    activeUsers: kpi.legacy_compatibility.field_agents.active_today.value, // Using active agents as proxy
    pendingCases: kpi.workload.open_tasks.value, // Using open tasks as proxy
    
    // Financials
    monthlyRevenue: kpi.financial.actual_amount.value,
    totalInvoices: 0, // Not in KPI yet
    pendingCommissions: 0, // Not in KPI yet
    
    // Performance
    completionRate: kpi.performance.first_visit_success_rate.value, // Proxy
    avgTurnaroundDays: kpi.performance.avg_tat_days.value,
    
    pendingReviewCases: 0, 
    rejectedCases: 0 
  } : undefined;

  // 2. Map to TATStats
  const tatStats: TATStats | undefined = kpi ? {
    criticalOverdue: kpi.workload.sla_risk_tasks.value,
    totalOverdue: kpi.workload.overdue_tasks.value,
    totalActiveTasks: kpi.workload.open_tasks.value,
    overduePercentage: kpi.workload.total_tasks.value > 0 
      ? (kpi.workload.overdue_tasks.value / kpi.workload.total_tasks.value) * 100 
      : 0
  } : undefined;

  // 3. Map to CaseStatusDistribution[]
  const caseDistributionData: CaseStatusDistribution[] | undefined = kpi ? [
    { status: 'PENDING', count: kpi.workload.open_tasks.value - kpi.workload.in_progress_tasks.value, percentage: 0 }, // Rough calc
    { status: 'IN_PROGRESS', count: kpi.legacy_compatibility.tasks.in_progress.value, percentage: 0 },
    { status: 'COMPLETED', count: kpi.legacy_compatibility.tasks.completed.value, percentage: 0 },
    { status: 'REVOKED', count: kpi.legacy_compatibility.tasks.revoked.value, percentage: 0 },
    { status: 'ON_HOLD', count: kpi.legacy_compatibility.tasks.on_hold.value, percentage: 0 }
  ].map(item => {
    // Calculate percentages
    const total = kpi.legacy_compatibility.tasks.total.value || 1;
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
    { month: 'Nov', monthName: 'Nov', totalCases: kpi.legacy_compatibility.tasks.total.previous_period_value || 55, completedCases: kpi.legacy_compatibility.tasks.completed.previous_period_value || 50, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: kpi.financial.actual_amount.previous_period_value || 16000, completionRate: 91, avgTurnaroundDays: 2.1 },
    { month: 'Dec', monthName: 'Dec', totalCases: kpi.legacy_compatibility.tasks.total.value, completedCases: kpi.legacy_compatibility.tasks.completed.value, pendingCases: 5, inProgressCases: 0, rejectedCases: 0, revenue: kpi.financial.actual_amount.value, completionRate: kpi.financial.collection_efficiency_percent.value || 93, avgTurnaroundDays: kpi.performance.avg_tat_days.value }
  ] : undefined;

  // 5. Activities (Empty for now per specs)
  const activitiesData: RecentActivity[] = [];

  // 6. Map to Card Trends
  const cardTrends = kpi ? {
    totalCases: {
      value: Math.abs(kpi.legacy_compatibility.cases.total.change_percent),
      isPositive: kpi.legacy_compatibility.cases.total.change_percent >= 0
    },
    revokedTasks: {
      value: Math.abs(kpi.legacy_compatibility.tasks.revoked.change_percent),
      isPositive: kpi.legacy_compatibility.tasks.revoked.change_percent >= 0
    },
    inProgress: {
      value: Math.abs(kpi.legacy_compatibility.tasks.in_progress.change_percent),
      isPositive: kpi.legacy_compatibility.tasks.in_progress.change_percent >= 0
    },
    completed: {
      value: Math.abs(kpi.legacy_compatibility.tasks.completed.change_percent),
      isPositive: kpi.legacy_compatibility.tasks.completed.change_percent >= 0
    },
    totalClients: {
      value: Math.abs(kpi.legacy_compatibility.clients.total.change_percent),
      isPositive: kpi.legacy_compatibility.clients.total.change_percent >= 0
    }
  } : undefined;

  return {
    isLoading: query.isLoading,
    error: query.error,
    stats,
    tatStats,
    caseDistributionData,
    trendsData,
    activitiesData,
    cardTrends,
    refetch: query.refetch
  };
};
