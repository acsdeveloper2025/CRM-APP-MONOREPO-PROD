/**
 * Case-related Data Transfer Objects (Frontend)
 */

export interface CompleteCaseData {
  outcome: string;
  notes?: string;
  attachments?: string[];
}

export interface CreateCaseWithMultipleTasksPayload {
  case_details: {
    customerName: string;
    customerPhone?: string;
    customerCallingCode?: string;
    clientId: number;
    productId?: number;
    verificationTypeId?: number;
    applicantType?: string;
    backendContactNumber?: string;
    priority: string;
    pincode: string;
    trigger?: string;
    deduplicationDecision?: string;
    deduplicationRationale?: string;
    panNumber?: string;
  };
  applicants: Array<{
    name: string;
    mobile?: string;
    role?: string;
    pan_number?: string;
    verifications?: Array<{
      verification_type_id: number | null;
      address?: string;
      pincode_id?: number;
      area_id?: number;
      assigned_to?: string;
    }>;
  }>;
  verification_tasks: Array<{
    verification_type_id: number;
    task_title: string;
    task_description?: string;
    priority: string;
    assigned_to?: string;
    rate_type_id?: number;
    address: string;
    pincode: string;
    area_id?: number;
    applicant_type?: string;
    trigger?: string;
  }>;
}

export interface CreateCaseWithMultipleTasksResponse {
  case: {
    id: string;
    caseId: number;
    customerName: string;
    status: string;
    priority: string;
    createdAt: string;
  };
  tasks: Array<{
    id: string;
    task_number: string;
    case_id: string;
    verification_type_id: number;
    status: string;
    priority: string;
  }>;
}
