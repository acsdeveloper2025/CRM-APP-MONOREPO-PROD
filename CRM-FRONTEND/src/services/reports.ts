import { apiService } from './api';
import type { PaginationQuery } from '@/types/api';
import type { MISFilters, MISDataResponse } from '@/types/mis';

export interface ReportQuery extends PaginationQuery {
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
  generatedBy?: string;
}

function buildMISParams(filters: MISFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.dateFrom) {
    params.append('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.append('dateTo', filters.dateTo);
  }
  if (filters.clientId) {
    params.append('clientId', filters.clientId.toString());
  }
  if (filters.productId) {
    params.append('productId', filters.productId.toString());
  }
  if (filters.verificationTypeId) {
    params.append('verificationTypeId', filters.verificationTypeId.toString());
  }
  if (filters.caseStatus) {
    params.append('caseStatus', filters.caseStatus);
  }
  if (filters.fieldAgentId) {
    params.append('fieldAgentId', filters.fieldAgentId);
  }
  if (filters.backendUserId) {
    params.append('backendUserId', filters.backendUserId);
  }
  if (filters.priority) {
    params.append('priority', filters.priority);
  }
  if (filters.sortBy) {
    params.append('sortBy', filters.sortBy);
  }
  if (filters.sortOrder) {
    params.append('sortOrder', filters.sortOrder);
  }
  return params;
}

export class ReportsService {
  // ===== MIS DASHBOARD APIs =====

  async getMISDashboardData(filters: MISFilters = {}): Promise<MISDataResponse> {
    const params = buildMISParams(filters);
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }
    const response = await apiService.get<MISDataResponse>(
      `/reports/mis-dashboard-data?${params.toString()}`
    );
    return response as unknown as MISDataResponse;
  }

  /**
   * Export MIS Dashboard data as xlsx. Mirrors list filters via the shared
   * BE `buildMISWhereClause` helper. 10k row hard cap server-side.
   */
  async exportMISDashboardData(filters: MISFilters = {}): Promise<Blob> {
    const params: Record<string, string> = {};
    const search = buildMISParams(filters);
    search.forEach((value, key) => {
      params[key] = value;
    });
    return apiService.getBlob('/reports/mis-dashboard-data/export', params);
  }
}

export const reportsService = new ReportsService();
