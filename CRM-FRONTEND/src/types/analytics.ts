// Analytics-specific type definitions
export interface AgentPerformanceData {
  id: string;
  name: string;
  totalCasesAssigned: number;
  casesCompleted: number;
  formQualityScore: number;
  avgCompletionDays: number | null;
  residenceFormsSubmitted: number;
  officeFormsSubmitted: number;
  attachmentsUploaded: number;
}

export interface VerificationTask {
  id: string;
  status: string;
  verificationTypeName: string;
  assignedToName: string | null;
  estimatedAmount: string;
  actualAmount: string;
}

export interface CaseData {
  id: string;
  status: string;
  priority: string;
  clientName: string;
  [key: string]: unknown;
}
