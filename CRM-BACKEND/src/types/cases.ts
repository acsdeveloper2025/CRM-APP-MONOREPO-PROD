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
  verificationTypeId: number;
  taskTitle?: string;
  taskDescription?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  rateTypeId?: number;
  estimatedAmount?: number;
  address?: string;
  pincode?: string;
  trigger?: string;
  documentType?: string;
  documentNumber?: string;
  documentDetails?: Record<string, unknown>;
  estimatedCompletionDate?: string;
  applicantType?: string;
  attachmentKeys?: string[];
  [key: string]: unknown;
}

export interface CreateCaseRequest {
  caseDetails: CreateCaseDetails;
  verificationTasks: CreateVerificationTask[];
  applicants?: CreateApplicantData[];
  kycDocuments?: KYCDocumentInput[];
}

export interface KYCDocumentInput {
  documentType: string;
  documentNumber?: string;
  documentHolderName?: string;
  documentDetails?: Record<string, string>;
  description?: string;
  assignedTo?: string;
}

export interface CreateApplicantData {
  name: string;
  mobile: string;
  role?: string;
  panNumber?: string;
  idDetails?: Record<string, unknown>;
  verifications?: CreateVerificationTask[];
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
