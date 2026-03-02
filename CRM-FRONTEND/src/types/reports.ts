export interface MISReport {
  id: string;
  reportType: 'TURNAROUND_TIME' | 'COMPLETION_RATE' | 'PRODUCTIVITY' | 'QUALITY' | 'FINANCIAL';
  title: string;
  description: string;
  period: string;
  generatedAt: string;
  generatedBy: string;
  data: unknown;
  filters: ReportFilters;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  userId?: string;
  status?: string;
  verificationTypeId?: string;
  productId?: string;
}

export interface TurnaroundTimeReport {
  averageTurnaroundTime: number; // in hours
  targetTurnaroundTime: number; // in hours
  performancePercentage: number;
  casesByTurnaroundTime: {
    range: string;
    count: number;
    percentage: number;
  }[];
  clientWisePerformance: {
    clientId: string;
    clientName: string;
    averageTurnaroundTime: number;
    caseCount: number;
    performancePercentage: number;
  }[];
  userWisePerformance: {
    userId: string;
    userName: string;
    averageTurnaroundTime: number;
    caseCount: number;
    performancePercentage: number;
  }[];
}

export interface CompletionRateReport {
  totalCases: number;
  completedCases: number;
  inProgressCases: number;
  pendingCases: number;
  completionRate: number;
  monthlyTrends: {
    month: string;
    totalCases: number;
    completedCases: number;
    completionRate: number;
  }[];
  clientWiseCompletion: {
    clientId: string;
    clientName: string;
    totalCases: number;
    completedCases: number;
    completionRate: number;
  }[];
  verificationTypeWiseCompletion: {
    verificationTypeId: string;
    verificationTypeName: string;
    totalCases: number;
    completedCases: number;
    completionRate: number;
  }[];
}

export interface ProductivityReport {
  totalCasesProcessed: number;
  averageCasesPerDay: number;
  averageCasesPerUser: number;
  topPerformers: {
    userId: string;
    userName: string;
    casesCompleted: number;
    averageRating: number;
    efficiency: number;
  }[];
  dailyProductivity: {
    date: string;
    casesCompleted: number;
    casesAssigned: number;
    productivity: number;
  }[];
  userProductivity: {
    userId: string;
    userName: string;
    casesAssigned: number;
    casesCompleted: number;
    averageCompletionTime: number;
    productivity: number;
  }[];
}

export interface QualityReport {
  totalReviews: number;
  approvedCases: number;
  rejectedCases: number;
  approvalRate: number;
  averageQualityScore: number;
  qualityTrends: {
    month: string;
    totalReviews: number;
    approvalRate: number;
    averageScore: number;
  }[];
  userQualityMetrics: {
    userId: string;
    userName: string;
    totalSubmissions: number;
    approvedSubmissions: number;
    approvalRate: number;
    averageScore: number;
  }[];
  commonRejectionReasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];
}

export interface FinancialReport {
  totalRevenue: number;
  totalCommissions: number;
  netProfit: number;
  profitMargin: number;
  monthlyRevenue: {
    month: string;
    revenue: number;
    commissions: number;
    netProfit: number;
  }[];
  clientWiseRevenue: {
    clientId: string;
    clientName: string;
    revenue: number;
    caseCount: number;
    averageRevenuePerCase: number;
  }[];
  verificationTypeWiseRevenue: {
    verificationTypeId: string;
    verificationTypeName: string;
    revenue: number;
    caseCount: number;
    averageRevenue: number;
  }[];
}

export interface ReportSummary {
  reportType: string;
  title: string;
  description: string;
  lastGenerated: string;
  keyMetrics: {
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'stable';
    trendPercentage?: number;
  }[];
}

export interface GenerateReportData {
  reportType: string;
  title: string;
  description?: string;
  filters: ReportFilters;
  format?: 'PDF' | 'EXCEL' | 'CSV';
}

export interface ReportQuery {
  page?: number;
  limit?: number;
  search?: string;
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
}
