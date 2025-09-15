import { apiService } from './api';
import { ApiResponse } from '../types/api';
import {
  CommissionRateType,
  CreateCommissionRateTypeData,
  FieldUserCommissionAssignment,
  CreateFieldUserCommissionAssignmentData,
  CommissionCalculation,
  CommissionStats
} from '../types/commission';

export interface GetCommissionRateTypesParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface GetFieldUserAssignmentsParams {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  rateTypeId?: number;
  clientId?: number;
}

export interface GetCommissionCalculationsParams {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}



export const commissionManagementApi = {
  // Commission Rate Types
  async getCommissionRateTypes(params: GetCommissionRateTypesParams = {}): Promise<ApiResponse<CommissionRateType[]>> {
    const queryParams: Record<string, string | number | boolean> = {};
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;
    if (params.search) queryParams.search = params.search;
    if (params.isActive !== undefined) queryParams.isActive = params.isActive;

    return apiService.get('/commission-management/rate-types', queryParams);
  },

  async createCommissionRateType(data: CreateCommissionRateTypeData): Promise<ApiResponse<CommissionRateType>> {
    return apiService.post('/commission-management/rate-types', data);
  },

  async updateCommissionRateType(id: number, data: Partial<CreateCommissionRateTypeData>): Promise<ApiResponse<CommissionRateType>> {
    return apiService.put(`/commission-management/rate-types/${id}`, data);
  },

  async deleteCommissionRateType(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/commission-management/rate-types/${id}`);
  },

  // Field User Commission Assignments
  async getFieldUserCommissionAssignments(params: GetFieldUserAssignmentsParams = {}): Promise<ApiResponse<FieldUserCommissionAssignment[]>> {
    const queryParams: Record<string, string | number> = {};
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;
    if (params.search) queryParams.search = params.search;
    if (params.userId) queryParams.userId = params.userId;
    if (params.rateTypeId) queryParams.rateTypeId = params.rateTypeId;
    if (params.clientId) queryParams.clientId = params.clientId;

    return apiService.get('/commission-management/field-user-assignments', queryParams);
  },

  async createFieldUserCommissionAssignment(data: CreateFieldUserCommissionAssignmentData): Promise<ApiResponse<FieldUserCommissionAssignment>> {
    return apiService.post('/commission-management/field-user-assignments', data);
  },

  async updateFieldUserCommissionAssignment(id: string, data: Partial<CreateFieldUserCommissionAssignmentData>): Promise<ApiResponse<FieldUserCommissionAssignment>> {
    return apiService.put(`/commission-management/field-user-assignments/${id}`, data);
  },

  async deleteFieldUserCommissionAssignment(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/commission-management/field-user-assignments/${id}`);
  },

  // Commission Calculations
  async getCommissionCalculations(params: GetCommissionCalculationsParams = {}): Promise<ApiResponse<CommissionCalculation[]>> {
    const queryParams: Record<string, string | number> = {};
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;
    if (params.search) queryParams.search = params.search;
    if (params.userId) queryParams.userId = params.userId;
    if (params.startDate) queryParams.startDate = params.startDate;
    if (params.endDate) queryParams.endDate = params.endDate;
    if (params.status) queryParams.status = params.status;

    return apiService.get('/commission-management/calculations', queryParams);
  },

  async calculateCommissionForCase(caseId: string): Promise<ApiResponse<CommissionCalculation>> {
    return apiService.post(`/commission-management/calculate-case/${caseId}`);
  },

  // Commission Statistics
  async getCommissionStats(): Promise<ApiResponse<CommissionStats>> {
    return apiService.get('/commission-management/stats');
  },

  // Export Functions
  async exportCommissionRateTypes(): Promise<Blob> {
    const response = await apiService.get('/commission-management/rate-types');
    const data = Array.isArray(response.data) ? response.data : [];
    const csvData = this.convertRateTypesToCSV(data);
    return new Blob([csvData], { type: 'text/csv' });
  },

  async exportFieldUserAssignments(): Promise<Blob> {
    const response = await apiService.get('/commission-management/field-user-assignments');
    const data = Array.isArray(response.data) ? response.data : [];
    const csvData = this.convertAssignmentsToCSV(data);
    return new Blob([csvData], { type: 'text/csv' });
  },

  async exportCommissionCalculations(params: GetCommissionCalculationsParams = {}): Promise<Blob> {
    const queryParams: Record<string, string> = {};
    if (params.userId) queryParams.userId = params.userId;
    if (params.startDate) queryParams.startDate = params.startDate;
    if (params.endDate) queryParams.endDate = params.endDate;
    if (params.status) queryParams.status = params.status;

    const response = await apiService.get('/commission-management/calculations', queryParams);
    const data = Array.isArray(response.data) ? response.data : [];
    const csvData = this.convertCalculationsToCSV(data);
    return new Blob([csvData], { type: 'text/csv' });
  },

  // Helper functions for CSV conversion
  convertRateTypesToCSV(data: CommissionRateType[]): string {
    if (!data.length) return '';
    const headers = ['ID', 'Rate Type ID', 'Commission Amount', 'Currency', 'Active', 'Created At'];
    const rows = data.map(item => [
      item.id || '',
      item.rateTypeId || '',
      item.commissionAmount || '',
      item.currency || '',
      item.isActive ? 'Yes' : 'No',
      item.createdAt || ''
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  },

  convertAssignmentsToCSV(data: FieldUserCommissionAssignment[]): string {
    if (!data.length) return '';
    const headers = ['User Name', 'Rate Type', 'Commission Amount', 'Currency', 'Status', 'Effective From', 'Effective To'];
    const rows = data.map(item => [
      item.user_name || '',
      item.rate_type_name || '',
      item.commission_amount || '',
      item.currency || '',
      item.is_active ? 'Active' : 'Inactive',
      item.effective_from || '',
      item.effective_to || ''
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  },

  convertCalculationsToCSV(data: CommissionCalculation[]): string {
    if (!data.length) return '';
    const headers = ['Case ID', 'User Name', 'Rate Type', 'Commission Amount', 'Currency', 'Status', 'Calculated Date'];
    const rows = data.map(item => [
      item.case_id || '',
      item.user_name || '',
      item.rate_type_name || '',
      item.commission_amount || '',
      item.currency || '',
      item.status || '',
      item.calculated_at || ''
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
};
