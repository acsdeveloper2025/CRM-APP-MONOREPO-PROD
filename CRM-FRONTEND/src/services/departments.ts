import type { AxiosResponse } from 'axios';
import { apiService } from './api';
import { ApiResponse, PaginatedResponse } from '@/types/api';
import { Department, CreateDepartmentRequest, UpdateDepartmentRequest } from '@/types/user';
import { validateResponse } from './schemas/runtime';
import { GenericEntitySchema, GenericEntityListSchema } from './schemas/generic.schema';

export interface DepartmentsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  // §9 canonical isActive contract: 'all' yields stable URL/cache key; BE ignores it.
  isActive?: 'true' | 'false' | 'all';
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  createdFrom?: string;
  createdTo?: string;
  // Back-compat for old getActiveDepartments callers — translated to isActive=true.
  includeInactive?: boolean;
}

export interface DepartmentStats {
  total: number;
  active: number;
  inactive: number;
  recentlyAddedCount: number;
  withUsersCount: number;
}

class DepartmentsService {
  // Get all departments with pagination and filtering
  async getDepartments(
    params: DepartmentsQueryParams = {}
  ): Promise<PaginatedResponse<Department>> {
    const queryParams = new URLSearchParams();

    if (params.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.search) {
      queryParams.append('search', params.search);
    }

    // includeInactive shim — old callers pass boolean; new code uses isActive.
    if (params.isActive !== undefined) {
      queryParams.append('isActive', params.isActive);
    } else if (params.includeInactive === false) {
      queryParams.append('isActive', 'true');
    }

    if (params.sortBy) {
      queryParams.append('sortBy', params.sortBy);
    }
    if (params.sortOrder) {
      queryParams.append('sortOrder', params.sortOrder);
    }
    if (params.createdFrom) {
      queryParams.append('createdFrom', params.createdFrom);
    }
    if (params.createdTo) {
      queryParams.append('createdTo', params.createdTo);
    }

    const qs = queryParams.toString();
    const response = await apiService.get<Department[]>(`/departments${qs ? `?${qs}` : ''}`);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'departments',
        endpoint: 'GET /departments',
      });
    }
    return response as PaginatedResponse<Department>;
  }

  // 5-card stats aggregate for DepartmentsPage shell.
  async getDepartmentStats(): Promise<ApiResponse<DepartmentStats>> {
    return apiService.get<DepartmentStats>('/departments/stats');
  }

  // Excel export — mirrors getDepartments filters. Returns the raw axios
  // response so the caller can pull headers + blob body.
  async exportDepartments(
    params: Omit<DepartmentsQueryParams, 'page' | 'limit'> = {}
  ): Promise<AxiosResponse<Blob>> {
    // Build a plain object so apiService.getRaw can serialize as query string.
    const query: Record<string, string | undefined> = {
      search: params.search,
      isActive: params.isActive,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
    };
    return apiService.getRaw<Blob>('/departments/export', query, {
      responseType: 'blob',
    });
  }

  // Get department by ID
  async getDepartmentById(id: string | number): Promise<ApiResponse<Department>> {
    const response = await apiService.get<Department>(`/departments/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'departments',
        endpoint: 'GET /departments/:id',
      });
    }
    return response;
  }

  // Create new department
  async createDepartment(data: CreateDepartmentRequest): Promise<ApiResponse<Department>> {
    return apiService.post<Department>('/departments', data);
  }

  // Update department
  async updateDepartment(
    id: string | number,
    data: UpdateDepartmentRequest
  ): Promise<ApiResponse<Department>> {
    return apiService.put<Department>(`/departments/${id}`, data);
  }

  // Delete department
  async deleteDepartment(id: string | number): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/departments/${id}`);
  }

  // Get active departments for dropdowns
  async getActiveDepartments(): Promise<PaginatedResponse<Department>> {
    return this.getDepartments({ isActive: 'true', limit: 100 });
  }
}

export const departmentsService = new DepartmentsService();
