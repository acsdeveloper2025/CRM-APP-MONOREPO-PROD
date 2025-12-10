export interface NotificationCaseData {
  id: string;
  caseId: string;
  caseNumber?: string;
  customerName: string;
  priority: number | string;
  verificationType?: string;
  assignedBy?: string;
  reason?: string;
  removedBy?: string;
  revocationReason?: string;
  completionStatus?: string;
  outcome?: string;
}

export interface FieldUserData {
  id: string;
  name: string;
}

export interface UpdateInfo {
  version: string;
  forceUpdate: boolean;
  releaseNotes?: string;
  url?: string;
}

export interface MaintenanceInfo {
  startTime: string;
  endTime: string;
  message: string;
  affectsOfflineMode: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  distance?: number;
  message?: string;
}

export interface SubmissionResult {
  success: boolean;
  submissionId?: string;
  error?: string;
}

export interface AttachmentProgress {
  id: string;
  progress: number;
  uploadedBytes?: number;
  totalBytes?: number;
}

export interface AlertData {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface AttachmentData {
  id: string;
  filename: string;
  url: string;
  size: number;
}
