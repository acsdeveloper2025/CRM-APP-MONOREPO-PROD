export interface CreateCaseDetails {
  customerName: string;
  customerPhone?: string;
  customerCallingCode?: string;
  clientId: number;
  productId: number;
  verificationTypeId?: number;
  pincode?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  trigger?: string;
  applicantType?: string;
  backendContactNumber?: string;
  deduplicationDecision?: string;
  deduplicationRationale?: string;
  panNumber?: string;
  [key: string]: unknown;
}

export interface CreateVerificationTask {
  verification_type_id: number;
  task_title?: string;
  task_description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigned_to?: string;
  assignedTo?: string;
  rate_type_id?: number;
  estimated_amount?: number;
  address?: string;
  pincode?: string;
  trigger?: string;
  document_type?: string;
  document_number?: string;
  document_details?: Record<string, unknown>;
  estimated_completion_date?: string;
  applicant_type?: string;
  applicantType?: string;
  attachment_keys?: string[];
  [key: string]: unknown;
}

export interface CreateCaseRequest {
  case_details: CreateCaseDetails;
  verification_tasks: CreateVerificationTask[];
}

export interface CaseUpdateBody {
  customerName?: string;
  customerPhone?: string;
  customerCallingCode?: string;
  clientId?: number;
  productId?: number;
  verificationTypeId?: number;
  pincode?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  trigger?: string;
  applicantType?: string;
  backendContactNumber?: string;
  assignedToId?: string;
  rateTypeId?: string;
  address?: string;
  taskId?: string;
  [key: string]: unknown;
}
