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
    
    if (params.page) {queryParams.append('page', params.page.toString());}
    if (params.limit) {queryParams.append('limit', params.limit.toString());}
    if (params.search) {queryParams.append('search', params.search);}
    if (params.includeInactive) {queryParams.append('includeInactive', params.includeInactive.toString());}

    const response = await apiService.get<Department[]>(`/departments?${queryParams.toString()}`);
    return response as PaginatedResponse<Department>;
  }

  // Get department by ID
  async getDepartmentById(id: string | number): Promise<ApiResponse<Department>> {
    const response = await apiService.get<Department>(`/departments/${id}`);
    return response;
  }

  // Create new department
  async createDepartment(data: CreateDepartmentRequest): Promise<ApiResponse<Department>> {
    const response = await apiService.post<Department>('/departments', data);
    return response;
  }

  // Update department
  async updateDepartment(id: string | number, data: UpdateDepartmentRequest): Promise<ApiResponse<Department>> {
    const response = await apiService.put<Department>(`/departments/${id}`, data);
    return response;
  }

  // Delete department
  async deleteDepartment(id: string | number): Promise<ApiResponse<void>> {
    const response = await apiService.delete<void>(`/departments/${id}`);
    return response;
  }

  // Get active departments for dropdowns
  async getActiveDepartments(): Promise<PaginatedResponse<Department>> {
    return this.getDepartments({ includeInactive: false, limit: 100 });
  }
}

export const departmentsService = new DepartmentsService();
