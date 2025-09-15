import { apiService } from './api';
import { ApiResponse, PaginatedResponse } from '@/types/api';
import { Department, CreateDepartmentRequest, UpdateDepartmentRequest } from '@/types/user';

export interface DepartmentsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;

}

class DepartmentsService {
  // Get all departments with pagination and filtering
  async getDepartments(params: DepartmentsQueryParams = {}): Promise<PaginatedResponse<Department>> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.includeInactive) queryParams.append('includeInactive', params.includeInactive.toString());

    const response = await apiService.get<PaginatedResponse<Department>>(`/departments?${queryParams.toString()}`);
    return response;
  }

  // Get department by ID
  async getDepartmentById(id: string): Promise<ApiResponse<Department>> {
    const response = await apiService.get<ApiResponse<Department>>(`/departments/${id}`);
    return response;
  }

  // Create new department
  async createDepartment(data: CreateDepartmentRequest): Promise<ApiResponse<Department>> {
    const response = await apiService.post<ApiResponse<Department>>('/departments', data);
    return response;
  }

  // Update department
  async updateDepartment(id: string, data: UpdateDepartmentRequest): Promise<ApiResponse<Department>> {
    const response = await apiService.put<ApiResponse<Department>>(`/departments/${id}`, data);
    return response;
  }

  // Delete department
  async deleteDepartment(id: string): Promise<ApiResponse<void>> {
    const response = await apiService.delete<ApiResponse<void>>(`/departments/${id}`);
    return response;
  }

  // Get active departments for dropdowns
  async getActiveDepartments(): Promise<PaginatedResponse<Department>> {
    return this.getDepartments({ includeInactive: false, limit: 100 });
  }
}

export const departmentsService = new DepartmentsService();
