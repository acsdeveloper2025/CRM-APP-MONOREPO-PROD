/**
 * Case-related Data Transfer Objects (Frontend)
 */

export interface CompleteCaseData {
  outcome: string;
  notes?: string;
  attachments?: string[];
}

export interface CreateCaseWithMultipleTasksPayload {
  caseDetails: {
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
    panNumber?: string;
    verifications?: Array<{
      verificationTypeId: number | null;
      address?: string;
      pincodeId?: number;
      areaId?: number;
      assignedTo?: string;
    }>;
  }>;
  verificationTasks: Array<{
    verificationTypeId: number;
    taskTitle: string;
    taskDescription?: string;
    priority: string;
    assignedTo?: string;
    rateTypeId?: number;
    address: string;
    pincode: string;
    areaId?: number;
    applicantType?: string;
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
    taskNumber: string;
    caseId: string;
    verificationTypeId: number;
    status: string;
    priority: string;
  }>;
}
