/**
 * Dashboard Data Transfer Objects (Frontend)
 * Mirrored from backend DTOs with camelCase naming
 */

export interface CaseStatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface ClientStats {
  clientId: number;
  clientName: string;
  totalCases: number;
  completedCases: number;
  pendingCases: number;
  averageCompletionTime: number;
}

export interface MonthlyTrend {
  month: string;
  monthName: string;
  totalCases: number;
  completedCases: number;
  pendingCases: number;
  inProgressCases: number;
  rejectedCases: number;
  revenue: number; // Keep this as it's in component, though backend might not populate it yet
  completionRate: number;
  avgTurnaroundDays: number;
}

export interface TATStats {
  criticalOverdue: number;
  totalOverdue: number;
  totalActiveTasks: number;
  overduePercentage: number;
}

export interface TopPerformer {
  userId: string;
  userName: string;
  completedTasks: number;
  averageRating: number;
  totalEarnings: number;
}

export interface UpcomingDeadline {
  caseId: string;
  caseNumber: string;
  customerName: string;
  deadline: string;
  daysRemaining: number;
  priority: string;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface OverdueTask {
  id: string;
  taskNumber: string;
  caseId: string;
  caseNumber: string;
  customerName: string;
  verificationTypeName: string;
  assignedToName: string;
  daysOverdue: number;
  status: string;
  priority: string;
  completed_at?: string;
}

export interface OverdueTasksResponse {
  tasks: OverdueTask[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    totalCount: number;
  };
}
