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
  verification_type_name: string;
  assigned_to_name: string | null;
  estimated_amount: string;
  actual_amount: string;
}

export interface CaseData {
  id: string;
  status: string;
  priority: string;
  client_name: string;
  [key: string]: unknown;
}
