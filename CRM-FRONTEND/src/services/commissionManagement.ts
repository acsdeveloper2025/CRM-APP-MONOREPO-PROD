import { apiService } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  CommissionRateType,
  CreateCommissionRateTypeData,
  UpdateCommissionRateTypeData,
  FieldUserCommissionAssignment,
  CreateFieldUserCommissionAssignmentData,
  UpdateFieldUserCommissionAssignmentData,
  CommissionCalculation,
  CommissionQuery,
  CommissionStats,
  CommissionSummary,
  BulkCommissionOperation,
  CommissionCalculationInput,
  CommissionCalculationResult,
  CommissionExportData
} from '@/types/commission';

class CommissionManagementService {
  private baseUrl = '/commission-management';

  // =====================================================
  // COMMISSION RATE TYPES
  // =====================================================

  async getCommissionRateTypes(params?: {
    isActive?: boolean;
    search?: string;
  }): Promise<ApiResponse<CommissionRateType[]>> {
    return apiService.get(`${this.baseUrl}/rate-types`, { params });
  }

  async createCommissionRateType(data: CreateCommissionRateTypeData): Promise<ApiResponse<CommissionRateType>> {
    return apiService.post(`${this.baseUrl}/rate-types`, data);
  }

  async updateCommissionRateType(id: number, data: UpdateCommissionRateTypeData): Promise<ApiResponse<CommissionRateType>> {
    return apiService.put(`${this.baseUrl}/rate-types/${id}`, data);
  }

  async deleteCommissionRateType(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`${this.baseUrl}/rate-types/${id}`);
  }

  // =====================================================
  // FIELD USER COMMISSION ASSIGNMENTS
  // =====================================================

  async getFieldUserCommissionAssignments(params?: {
    userId?: string;
    rateTypeId?: number;
    clientId?: number;
    isActive?: boolean;
    search?: string;
  }): Promise<ApiResponse<FieldUserCommissionAssignment[]>> {
    return apiService.get(`${this.baseUrl}/field-user-assignments`, { params });
  }

  async createFieldUserCommissionAssignment(data: CreateFieldUserCommissionAssignmentData): Promise<ApiResponse<FieldUserCommissionAssignment>> {
    return apiService.post(`${this.baseUrl}/field-user-assignments`, data);
  }

  async updateFieldUserCommissionAssignment(id: number, data: UpdateFieldUserCommissionAssignmentData): Promise<ApiResponse<FieldUserCommissionAssignment>> {
    return apiService.put(`${this.baseUrl}/field-user-assignments/${id}`, data);
  }

  async deleteFieldUserCommissionAssignment(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`${this.baseUrl}/field-user-assignments/${id}`);
  }

  // Get assignments for a specific user
  async getUserCommissionAssignments(userId: string): Promise<ApiResponse<FieldUserCommissionAssignment[]>> {
    return this.getFieldUserCommissionAssignments({ userId, isActive: true });
  }

  // Get assignments for a specific rate type
  async getRateTypeCommissionAssignments(rateTypeId: number): Promise<ApiResponse<FieldUserCommissionAssignment[]>> {
    return this.getFieldUserCommissionAssignments({ rateTypeId, isActive: true });
  }

  // Get assignments for a specific client
  async getClientCommissionAssignments(clientId: number): Promise<ApiResponse<FieldUserCommissionAssignment[]>> {
    return this.getFieldUserCommissionAssignments({ clientId, isActive: true });
  }

  // =====================================================
  // COMMISSION CALCULATIONS
  // =====================================================

  async getCommissionCalculations(query?: CommissionQuery): Promise<PaginatedResponse<CommissionCalculation>> {
    return apiService.get(`${this.baseUrl}/calculations`, { params: query });
  }

  async getCommissionCalculationById(id: number): Promise<ApiResponse<CommissionCalculation>> {
    return apiService.get(`${this.baseUrl}/calculations/${id}`);
  }

  async approveCommission(id: number, notes?: string): Promise<ApiResponse<CommissionCalculation>> {
    return apiService.put(`${this.baseUrl}/calculations/${id}/approve`, { notes });
  }

  async rejectCommission(id: number, reason: string): Promise<ApiResponse<CommissionCalculation>> {
    return apiService.put(`${this.baseUrl}/calculations/${id}/reject`, { rejectionReason: reason });
  }

  async markCommissionPaid(id: number, data: {
    paymentMethod: string;
    transactionId?: string;
    notes?: string;
  }): Promise<ApiResponse<CommissionCalculation>> {
    return apiService.put(`${this.baseUrl}/calculations/${id}/mark-paid`, data);
  }

  // Bulk operations
  async bulkApproveCommissions(commissionIds: number[], notes?: string): Promise<ApiResponse<void>> {
    const operation: BulkCommissionOperation = {
      commissionIds,
      operation: 'approve',
      notes
    };
    return apiService.post(`${this.baseUrl}/calculations/bulk-operation`, operation);
  }

  async bulkRejectCommissions(commissionIds: number[], reason: string): Promise<ApiResponse<void>> {
    const operation: BulkCommissionOperation = {
      commissionIds,
      operation: 'reject',
      reason
    };
    return apiService.post(`${this.baseUrl}/calculations/bulk-operation`, operation);
  }

  async bulkMarkCommissionsPaid(commissionIds: number[], data: {
    paymentMethod: string;
    transactionId?: string;
    notes?: string;
  }): Promise<ApiResponse<void>> {
    const operation: BulkCommissionOperation = {
      commissionIds,
      operation: 'mark_paid',
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      notes: data.notes
    };
    return apiService.post(`${this.baseUrl}/calculations/bulk-operation`, operation);
  }

  // =====================================================
  // COMMISSION STATISTICS AND REPORTS
  // =====================================================

  async getCommissionStats(params?: {
    userId?: string;
    clientId?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ApiResponse<CommissionStats>> {
    return apiService.get(`${this.baseUrl}/stats`, { params });
  }

  async getCommissionSummary(params?: {
    dateFrom?: string;
    dateTo?: string;
    clientId?: number;
  }): Promise<ApiResponse<CommissionSummary[]>> {
    return apiService.get(`${this.baseUrl}/summary`, { params });
  }

  async getUserCommissionSummary(userId: string, params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ApiResponse<CommissionSummary>> {
    return apiService.get(`${this.baseUrl}/summary/${userId}`, { params });
  }

  // =====================================================
  // COMMISSION EXPORT
  // =====================================================

  async exportCommissions(query?: CommissionQuery): Promise<ApiResponse<CommissionExportData[]>> {
    return apiService.get(`${this.baseUrl}/export`, { params: query });
  }

  async exportCommissionsCSV(query?: CommissionQuery): Promise<Blob> {
    const response = await apiService.getBlob(`${this.baseUrl}/export/csv`, { params: query });
    return response;
  }

  async exportCommissionsExcel(query?: CommissionQuery): Promise<Blob> {
    const response = await apiService.getBlob(`${this.baseUrl}/export/excel`, { params: query });
    return response;
  }

  // =====================================================
  // COMMISSION CALCULATION UTILITIES
  // =====================================================

  async testCommissionCalculation(input: CommissionCalculationInput): Promise<ApiResponse<CommissionCalculationResult>> {
    return apiService.post(`${this.baseUrl}/test-calculation`, input);
  }

  // Client-side commission calculation helper
  calculateCommission(input: CommissionCalculationInput): CommissionCalculationResult {
    const { baseAmount, commissionAmount, commissionPercentage, calculationMethod } = input;

    if (calculationMethod === 'FIXED_AMOUNT' && commissionAmount !== undefined) {
      return {
        calculatedCommission: commissionAmount,
        calculationMethod: 'FIXED_AMOUNT',
        appliedRate: commissionAmount
      };
    } else if (calculationMethod === 'PERCENTAGE' && commissionPercentage !== undefined) {
      const calculated = (baseAmount * commissionPercentage) / 100;
      return {
        calculatedCommission: Math.round(calculated * 100) / 100, // Round to 2 decimal places
        calculationMethod: 'PERCENTAGE',
        appliedRate: commissionPercentage
      };
    } else {
      throw new Error('Invalid calculation method or missing commission data');
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  // Get pending commissions for approval
  async getPendingCommissions(params?: {
    userId?: string;
    clientId?: number;
    limit?: number;
  }): Promise<PaginatedResponse<CommissionCalculation>> {
    return this.getCommissionCalculations({
      ...params,
      status: 'PENDING',
      sortBy: 'caseCompletedAt',
      sortOrder: 'desc'
    });
  }

  // Get approved commissions ready for payment
  async getApprovedCommissions(params?: {
    userId?: string;
    clientId?: number;
    limit?: number;
  }): Promise<PaginatedResponse<CommissionCalculation>> {
    return this.getCommissionCalculations({
      ...params,
      status: 'APPROVED',
      sortBy: 'approvedAt',
      sortOrder: 'desc'
    });
  }

  // Get paid commissions
  async getPaidCommissions(params?: {
    userId?: string;
    clientId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<PaginatedResponse<CommissionCalculation>> {
    return this.getCommissionCalculations({
      ...params,
      status: 'PAID',
      sortBy: 'paidAt',
      sortOrder: 'desc'
    });
  }

  // Get commission calculations for a specific case
  async getCaseCommissions(caseId: string): Promise<ApiResponse<CommissionCalculation[]>> {
    return apiService.get(`${this.baseUrl}/calculations/case/${caseId}`);
  }

  // Get commission calculations for a specific user in a date range
  async getUserCommissions(userId: string, params?: {
    dateFrom?: string;
    dateTo?: string;
    status?: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<CommissionCalculation>> {
    return this.getCommissionCalculations({
      userId,
      ...params,
      sortBy: 'caseCompletedAt',
      sortOrder: 'desc'
    });
  }
}

export const commissionManagementService = new CommissionManagementService();
