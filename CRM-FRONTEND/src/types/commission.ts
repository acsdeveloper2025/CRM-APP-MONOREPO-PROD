// Commission Management Types for Frontend
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
  id: string;
  user_id: string;
  rate_type_id: number;
  commission_amount: string;
  currency: string;
  client_id?: number; // NULL for global assignments
  is_active: boolean;
  effective_from: string;
  effective_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Populated fields
  user_name?: string;
  user_email?: string;
  rate_type_name?: string;
  client_name?: string;
}

export interface CreateFieldUserCommissionAssignmentData {
  userId: string;
  rateTypeId: number;
  commissionAmount?: number;
  commissionPercentage?: number;
  currency?: string;
  clientId?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface UpdateFieldUserCommissionAssignmentData extends Partial<Omit<CreateFieldUserCommissionAssignmentData, 'userId'>> {}

export interface CommissionCalculation {
  id: string;
  case_id: string;
  case_number?: number;
  user_id: string;
  client_id?: number;
  rate_type_id: number;
  base_amount?: string;
  commission_amount: string;
  currency: string;
  calculation_method?: 'FIXED_AMOUNT' | 'PERCENTAGE';
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CALCULATED';
  case_completed_at?: string;
  calculated_at?: string;
  approved_by?: string;
  approved_at?: string;
  paid_by?: string;
  paid_at?: string;
  payment_method?: string;
  transaction_id?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Populated fields
  user_name?: string;
  user_email?: string;
  client_name?: string;
  rate_type_name?: string;
  case_title?: string;
  customer_name?: string;
  approved_by_name?: string;
  paid_by_name?: string;
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
  totalCommissions?: number;
  totalAmount?: number;
  pendingCommissions?: number;
  pendingAmount?: number;
  approvedCommissions?: number;
  approvedAmount?: number;
  paidCommissions?: number;
  paidAmount?: number;
  rejectedCommissions?: number;
  rejectedAmount?: number;
  currency?: string;
  // Additional stats for the frontend
  totalCommissionPaid?: number;
  totalCommissionPending?: number;
  activeFieldUsers?: number;
  totalAssignments?: number;
  averageCommissionPerCase?: number;
  topPerformingUser?: string;
  mostUsedRateType?: string;
  totalRateTypes?: number;
  casesCompletedToday?: number;
  commissionCalculatedToday?: number;
  newAssignmentsThisWeek?: number;
  paymentBatchesPending?: number;
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

// UI-specific types
export interface CommissionFormData {
  rateTypeId: number;
  commissionAmount: number;
  currency: string;
  isActive: boolean;
}

export interface FieldUserAssignmentFormData {
  userId: string;
  rateTypeId: number;
  commissionType: 'amount' | 'percentage';
  commissionAmount?: number;
  commissionPercentage?: number;
  currency: string;
  clientId?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CommissionFilterState {
  userId?: string;
  clientId?: number;
  rateTypeId?: number;
  status?: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'ALL';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
