/**
 * Case Data Transfer Objects
 * Shared types for case management
 */

export interface CaseMetadata {
  deduplicationDecision?: string;
  deduplicationRationale?: string;
  backendContactNumber?: string;
  customFields?: Record<string, string | number | boolean>;
}

export interface CompleteCaseData {
  outcome: string;
  notes?: string;
  attachments?: string[];
}

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
