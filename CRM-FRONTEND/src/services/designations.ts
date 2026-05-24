import type { AxiosResponse } from 'axios';
import { apiService } from './api';
import { Designation, CreateDesignationRequest, UpdateDesignationRequest } from '@/types/user';
import { ApiResponse } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import { GenericEntitySchema, GenericEntityListSchema } from './schemas/generic.schema';

export interface DesignationsResponse {
  success: boolean;
  data: Designation[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DesignationResponse {
  success: boolean;
  data: Designation;
}

export interface DesignationStats {
  total: number;
  active: number;
  inactive: number;
  recentlyAddedCount: number;
  withoutDepartmentCount: number;
}

export interface DesignationsParams {
  page?: number;
  limit?: number;
  search?: string;
  // §9 canonical isActive contract.
  isActive?: 'true' | 'false' | 'all' | boolean;
  departmentId?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  createdFrom?: string;
  createdTo?: string;
}

class DesignationsService {
  private baseUrl = '/designations';

  async getDesignations(params: DesignationsParams = {}): Promise<DesignationsResponse> {
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params.search) {
      searchParams.append('search', params.search);
    }
    if (params.isActive !== undefined) {
      searchParams.append('isActive', String(params.isActive));
    }
    if (params.departmentId) {
      searchParams.append('departmentId', params.departmentId.toString());
    }
    if (params.sortBy) {
      searchParams.append('sortBy', params.sortBy);
    }
    if (params.sortOrder) {
      searchParams.append('sortOrder', params.sortOrder);
    }
    if (params.createdFrom) {
      searchParams.append('createdFrom', params.createdFrom);
    }
    if (params.createdTo) {
      searchParams.append('createdTo', params.createdTo);
    }

    const queryString = searchParams.toString();
    const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;

    const response = await apiService.get<Designation[]>(url);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'designations',
        endpoint: 'GET /designations',
      });
    }
    return response as DesignationsResponse;
  }

  // 5-card stats aggregate for DesignationsPage shell.
  async getDesignationStats(): Promise<ApiResponse<DesignationStats>> {
    return apiService.get<DesignationStats>(`${this.baseUrl}/stats`);
  }

  // Excel export — mirrors getDesignations filters. Returns raw axios
  // response so the caller can pull headers + blob body.
  async exportDesignations(
    params: Omit<DesignationsParams, 'page' | 'limit'> = {}
  ): Promise<AxiosResponse<Blob>> {
    const query: Record<string, string | undefined> = {
      search: params.search,
      isActive: params.isActive !== undefined ? String(params.isActive) : undefined,
      departmentId: params.departmentId ? String(params.departmentId) : undefined,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
    };
    return apiService.getRaw<Blob>(`${this.baseUrl}/export`, query, {
      responseType: 'blob',
    });
  }

  async getDesignationById(id: number): Promise<DesignationResponse> {
    const response = await apiService.get<Designation>(`${this.baseUrl}/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'designations',
        endpoint: 'GET /designations/:id',
      });
    }
    return response as DesignationResponse;
  }

  async createDesignation(data: CreateDesignationRequest): Promise<DesignationResponse> {
    const response = await apiService.post<Designation>(this.baseUrl, data);
    return response as DesignationResponse;
  }

  async updateDesignation(
    id: number,
    data: UpdateDesignationRequest
  ): Promise<DesignationResponse> {
    const response = await apiService.put<Designation>(`${this.baseUrl}/${id}`, data);
    return response as DesignationResponse;
  }

  async deleteDesignation(id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/${id}`
    );
    return response;
  }

  async getActiveDesignations(departmentId?: number): Promise<DesignationsResponse> {
    const searchParams = new URLSearchParams();
    if (departmentId) {
      searchParams.append('departmentId', departmentId.toString());
    }

    const queryString = searchParams.toString();
    const url = queryString ? `${this.baseUrl}/active?${queryString}` : `${this.baseUrl}/active`;

    const response = await apiService.get<Designation[]>(url);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'designations',
        endpoint: 'GET /designations/active',
      });
    }
    return response as DesignationsResponse;
  }

  // Helper method to get designations for a specific department
  async getDesignationsByDepartment(departmentId: number): Promise<DesignationsResponse> {
    return this.getDesignations({ departmentId, isActive: 'true' });
  }

  // Helper method to search designations
  async searchDesignations(
    searchTerm: string,
    departmentId?: number
  ): Promise<DesignationsResponse> {
    return this.getDesignations({
      search: searchTerm,
      departmentId,
      isActive: 'true',
    });
  }
}

export const designationsService = new DesignationsService();
