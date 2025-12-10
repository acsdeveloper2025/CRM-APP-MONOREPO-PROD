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
  year: number;
  totalCases: number;
  completedCases: number;
  revenue: number;
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
