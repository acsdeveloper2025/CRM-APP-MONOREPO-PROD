/**
 * Report-related Data Transfer Objects (Frontend)
 */

export interface ScheduledReportData {
  name: string;
  reportType: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  filters: Record<string, string | number | boolean>;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
}

export interface ScheduledReport extends ScheduledReportData {
  id: string;
  createdBy: string;
  createdAt: string;
  lastRun?: string;
  nextRun: string;
  isActive: boolean;
}
