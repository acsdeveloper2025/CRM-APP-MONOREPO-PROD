export interface DashboardStats {
  totalCases: number;
  inProgressCases: number;
  completedCases: number;
  pendingReviewCases: number;
  activeClients: number;
  totalInvoices: number;
  pendingCommissions: number;
  monthlyRevenue: number;
}

export interface CaseStatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface ClientCaseStats {
  clientId: string;
  clientName: string;
  totalCases: number;
  completedCases: number;
  inProgressCases: number;
}

export interface MonthlyTrend {
  month: string;
  cases: number;
  revenue: number;
  completionRate: number;
}

export interface RecentActivity {
  id: string;
  type: 'caseAssigned' | 'caseCompleted' | 'caseApproved' | 'invoiceGenerated';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  caseId?: string;
  clientId?: string;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  count?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  caseStatusDistribution: CaseStatusDistribution[];
  clientStats: ClientCaseStats[];
  monthlyTrends: MonthlyTrend[];
  recentActivities: RecentActivity[];
  quickActions: QuickAction[];
}
