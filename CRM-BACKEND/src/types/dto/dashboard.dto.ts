/**
 * Dashboard Data Transfer Objects
 * Shared types for dashboard endpoints between frontend and backend
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
  averageCompletionTime: number; // in hours
}

export interface MonthlyTrend {
  month: string; // e.g., "2024-01"
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
  deadline: string; // ISO 8601 date string
  daysRemaining: number;
  priority: string;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  createdAt: string; // ISO 8601 date string
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface DashboardQuery {
  dateFrom?: string;
  dateTo?: string;
  clientId?: number;
  productId?: number;
  userId?: string;
}
