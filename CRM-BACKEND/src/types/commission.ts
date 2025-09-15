// Commission Management Types
// Date: 2025-09-13

export interface CommissionRateType {
  id: number;
  rateTypeId: number;
  commissionAmount: number;
  currency: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  rateTypeName?: string;
}

export interface CreateCommissionRateTypeData {
  rateTypeId: number;
  commissionAmount: number;
  currency?: string;
  isActive?: boolean;
}

export interface UpdateCommissionRateTypeData extends Partial<Omit<CreateCommissionRateTypeData, 'rateTypeId'>> {}

export interface FieldUserCommissionAssignment {
  id: number;
  userId: string;
  rateTypeId: number;
  commissionAmount: number;
  currency: string;
  clientId?: number; // NULL for global assignments
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  userName?: string;
  userEmail?: string;
  rateTypeName?: string;
  clientName?: string;
}

export interface CreateFieldUserCommissionAssignmentData {
  userId: string;
  rateTypeId: number;
  commissionAmount: number;
  currency?: string;
  clientId?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface UpdateFieldUserCommissionAssignmentData extends Partial<Omit<CreateFieldUserCommissionAssignmentData, 'userId'>> {}

export interface CommissionCalculation {
  id: number;
  caseId: string;
  caseNumber: number;
  userId: string;
  clientId: number;
  rateTypeId: number;
  baseAmount: number;
  commissionAmount: number;
  calculatedCommission: number;
  currency: string;
  calculationMethod: 'FIXED_AMOUNT';
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  caseCompletedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  paidBy?: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionId?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  userName?: string;
  userEmail?: string;
  clientName?: string;
  rateTypeName?: string;
  caseTitle?: string;
  customerName?: string;
  approvedByName?: string;
  paidByName?: string;
}

export interface CreateCommissionCalculationData {
  caseId: string;
  caseNumber: number;
  userId: string;
  clientId: number;
  rateTypeId: number;
  baseAmount: number;
  commissionAmount?: number;
  commissionPercentage?: number;
  calculatedCommission: number;
  currency?: string;
  calculationMethod: 'FIXED_AMOUNT' | 'PERCENTAGE';
  caseCompletedAt: string;
  notes?: string;
}

export interface UpdateCommissionCalculationData {
  status?: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  paidBy?: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionId?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface CommissionPaymentBatch {
  id: number;
  batchNumber: string;
  totalAmount: number;
  totalCommissions: number;
  currency: string;
  paymentMethod: string;
  paymentDate?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdBy: string;
  processedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  createdByName?: string;
  processedByName?: string;
  items?: CommissionBatchItem[];
}

export interface CreateCommissionPaymentBatchData {
  batchNumber: string;
  totalAmount: number;
  totalCommissions: number;
  currency?: string;
  paymentMethod: string;
  paymentDate?: string;
  notes?: string;
  commissionIds: number[]; // Commission calculation IDs to include
}

export interface UpdateCommissionPaymentBatchData {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  paymentDate?: string;
  processedBy?: string;
  notes?: string;
}

export interface CommissionBatchItem {
  id: number;
  batchId: number;
  commissionId: number;
  amount: number;
  createdAt: string;
  // Populated fields
  commission?: CommissionCalculation;
}

export interface CommissionQuery {
  userId?: string;
  clientId?: number;
  rateTypeId?: number;
  status?: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'caseCompletedAt' | 'calculatedCommission' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CommissionStats {
  totalCommissions: number;
  totalAmount: number;
  pendingCommissions: number;
  pendingAmount: number;
  approvedCommissions: number;
  approvedAmount: number;
  paidCommissions: number;
  paidAmount: number;
  rejectedCommissions: number;
  rejectedAmount: number;
  currency: string;
}

export interface CommissionSummary {
  userId: string;
  userName: string;
  userEmail: string;
  totalCommissions: number;
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  currency: string;
  lastCommissionDate?: string;
}

export interface BulkCommissionOperation {
  commissionIds: number[];
  operation: 'approve' | 'reject' | 'mark_paid';
  reason?: string;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
}

export interface CommissionExportData {
  id: number;
  caseNumber: number;
  userName: string;
  userEmail: string;
  clientName: string;
  rateTypeName: string;
  baseAmount: number;
  calculatedCommission: number;
  currency: string;
  calculationMethod: string;
  status: string;
  caseCompletedAt: string;
  approvedAt?: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
}

// Commission calculation helper types
export interface CommissionCalculationInput {
  baseAmount: number;
  commissionAmount?: number;
  commissionPercentage?: number;
  calculationMethod: 'FIXED_AMOUNT' | 'PERCENTAGE';
}

export interface CommissionCalculationResult {
  calculatedCommission: number;
  calculationMethod: 'FIXED_AMOUNT' | 'PERCENTAGE';
  appliedRate: number; // The amount or percentage used
}
