export interface BaseReportData {
  generatedAt: string;
  dateRange: { from?: string; to?: string };
}

export interface FormSubmissionRow {
  id: string;
  formType: string;
  agentName?: string;
  caseNumber: string;
  customerName: string;
  validationStatus: string;
  submissionScore?: number;
  photosCount?: number;
  submittedAt: Date | string;
  overallQualityScore?: number;
  networkQuality?: string;
  employeeId?: string;
  caseStatus?: string;
  senderName?: string;
  timeSpentMinutes?: number;
  attachmentsCount?: number;
  completenessScore?: number;
  accuracyScore?: number;
  photoQualityScore?: number;
}

export interface FormSubmissionsReportData extends BaseReportData {
  reportType: 'Form Submissions Report';
  submissions: FormSubmissionRow[];
  summary: {
    totalSubmissions: string | number;
    validSubmissions: string | number;
    pendingSubmissions: string | number;
    invalidSubmissions?: string | number;
    residenceForms?: string | number;
    officeForms?: string | number;
    businessForms?: string | number;
    avgSubmissionScore: string | number;
    avgPhotosPerForm: string | number;
    avgTimeSpent?: string | number;
  };
  formTypeBreakdown?: FormTypeBreakdownRow[];
}

export interface FormTypeBreakdownRow {
  formType: string;
  validationStatus: string;
  count: string | number;
  avgScore: string | number;
}

export interface AgentPerformanceRow {
  id: string;
  name: string;
  employeeId?: string;
  email: string;
  departmentName?: string;
  totalCasesAssigned: number;
  casesCompleted: number;
  totalFormsSubmitted: number;
  avgQualityScore?: string | number;
  avgValidationSuccessRate?: string | number;
  performanceRating?: string;
  activeDays?: number;
  residenceForms?: number;
  officeForms?: number;
  businessForms?: number;
  totalDistance?: string | number;
  avgActiveHours?: string | number;
  avgValidationRate?: string | number;
}

export interface DailyPerformanceRow {
  date: Date | string;
  agentName: string;
  employeeId?: string;
  casesAssigned: number;
  casesCompleted: number;
  formsSubmitted: number;
  qualityScore?: string | number;
  validationSuccessRate?: string | number;
  activeHours?: string | number;
  totalDistanceKm?: string | number;
}

export interface AgentPerformanceReportData extends BaseReportData {
  reportType: 'Agent Performance Report';
  agents: AgentPerformanceRow[];
  dailyPerformance?: DailyPerformanceRow[];
}

export interface CaseAnalyticsRow {
  caseId: string;
  customerName: string;
  agentName?: string;
  clientName?: string;
  status: string;
  priority?: string;
  completionDays?: number;
  qualityScore?: number;
  actualFormsSubmitted?: number;
  validForms?: number;
  attachmentCount?: number;
  formCompletionPercentage?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CaseAnalyticsReportData extends BaseReportData {
  reportType: 'Case Analytics Report';
  cases: CaseAnalyticsRow[];
  summary: {
    totalCases: string | number;
    completedCases: string | number;
    inProgressCases?: string | number;
    pendingCases?: string | number;
    avgCompletionDays: string | number;
    avgQualityScore: string | number;
    avgFormCompletion?: string | number;
  };
}

export interface ValidationStatusRow {
  formType: string;
  validationStatus: string;
  formCount: string | number;
  avgSubmissionScore?: string | number;
  avgQualityScore?: string | number;
  avgCompleteness?: string | number;
  avgAccuracy?: string | number;
}

export interface ValidationStatusReportData extends BaseReportData {
  reportType: 'Form Validation Status Report';
  validationData: ValidationStatusRow[];
}

export type ReportData =
  | FormSubmissionsReportData
  | AgentPerformanceReportData
  | CaseAnalyticsReportData
  | ValidationStatusReportData;
