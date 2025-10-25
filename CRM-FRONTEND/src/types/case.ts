import { CASE_STATUS, CASE_PRIORITY, type CaseStatusType, type CasePriorityType } from './constants';

export type CaseStatus = CaseStatusType;
export type CasePriority = CasePriorityType;

export interface Case {
  // Primary identifiers
  id: string; // UUID for internal use
  caseId?: number; // Numeric case ID for display
  caseNumber?: string; // Formatted case number

  // Basic case information
  title?: string;
  description?: string;
  status: CaseStatus;
  priority: CasePriority;
  notes?: string;
  trigger?: string;

  // Customer information
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCallingCode?: string;

  // Address information
  address?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPincode?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;

  // Verification information
  verificationType?: string;
  verificationOutcome?: string;

  // DEPRECATED: Case-level assignment fields removed
  // All assignments are now handled at the verification task level
  // assignedToId?: string;
  // assignedTo?: {
  //   id: string;
  //   name: string;
  //   username?: string;
  //   employeeId?: string;
  // };
  // assignedToName?: string;
  // assignedAt?: string;

  // Related entities (using consistent ID types)
  clientId: number; // Numeric ID for clients
  client?: {
    id: number;
    name: string;
    code?: string;
  };
  clientName?: string;
  clientCode?: string;

  productId?: number; // Numeric ID for products
  product?: {
    id: number;
    name: string;
    code?: string;
  };
  productName?: string;
  productCode?: string;

  verificationTypeId?: number; // Numeric ID for verification types
  verificationTypeName?: string;
  verificationTypeCode?: string;

  rateTypeId?: number; // Numeric ID for rate types
  rateType?: {
    id: number;
    name: string;
    description?: string;
    amount?: number;
    currency?: string;
  };

  // Rate management fields
  rateTypeName?: string;
  rateTypeDescription?: string;
  areaType?: 'local' | 'ogl' | 'outstation' | 'standard';

  // Audit fields
  createdBy?: string;
  createdByBackendUser?: {
    id: string;
    name: string;
    employeeId?: string;
  };
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // Applicant information
  applicantName?: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantType?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  backendContactNumber?: string;

  // Deduplication fields
  deduplicationChecked?: boolean;
  deduplicationDecision?: string;
  deduplicationRationale?: string;

  // Performance fields
  pendingDurationSeconds?: number;

  // NEW: Multi-task architecture - verification task statistics
  totalTasks?: number;
  completedTasks?: number;
  pendingTasks?: number;
  inProgressTasks?: number;
}

export interface CaseFilters {
  status?: CaseStatus;
  search?: string;
  assignedTo?: string;
  clientId?: string;
  priority?: number;
  dateFrom?: string;
  dateTo?: string;
}
