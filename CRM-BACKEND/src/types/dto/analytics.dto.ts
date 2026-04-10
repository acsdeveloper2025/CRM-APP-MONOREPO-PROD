/**
 * Analytics Data Transfer Objects
 * Shared types for analytics endpoints
 */

export interface FormSubmissionData {
  formType: string;
  submittedAt: string;
  submittedBy: string;
  fields: Record<string, FormFieldValue>;
}

export type FormFieldValue = string | number | boolean | string[] | null;

export interface AnalyticsMetadata {
  source: string;
  version: string;
  timestamp: string;
  additionalInfo?: Record<string, string | number | boolean>;
}

export interface FormSubmission {
  id: string;
  caseId: string;
  verificationTaskId?: string;
  formType: string;
  submissionData: FormSubmissionData;
  submittedAt: string;
  submittedBy: string;
  status: string;
}
