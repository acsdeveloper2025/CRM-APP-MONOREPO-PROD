import { apiService } from './api';
import { ApiResponse, PaginatedResponse } from '@/types/api';
import { RoleData, CreateRoleRequest, UpdateRoleRequest } from '@/types/user';

export interface RolesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
  systemRolesOnly?: boolean;
}

class RolesService {
  // Get all roles with pagination and filtering
  async getRoles(params: RolesQueryParams = {}): Promise<PaginatedResponse<RoleData>> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.includeInactive) queryParams.append('includeInactive', params.includeInactive.toString());
    if (params.systemRolesOnly) queryParams.append('systemRolesOnly', params.systemRolesOnly.toString());

    const response = await apiService.get<PaginatedResponse<RoleData>>(`/roles?${queryParams.toString()}`);
    return response;
  }

  // Get role by ID
  async getRoleById(id: string): Promise<ApiResponse<RoleData>> {
    const response = await apiService.get<ApiResponse<RoleData>>(`/roles/${id}`);
    return response;
  }

  // Create new role
  async createRole(data: CreateRoleRequest): Promise<ApiResponse<RoleData>> {
    const response = await apiService.post<ApiResponse<RoleData>>('/roles', data);
    return response;
  }

  // Update role
  async updateRole(id: string, data: UpdateRoleRequest): Promise<ApiResponse<RoleData>> {
    const response = await apiService.put<ApiResponse<RoleData>>(`/roles/${id}`, data);
    return response;
  }

  // Delete role
  async deleteRole(id: string): Promise<ApiResponse<void>> {
    const response = await apiService.delete<ApiResponse<void>>(`/roles/${id}`);
    return response;
  }

  // Get system roles only
  async getSystemRoles(): Promise<PaginatedResponse<RoleData>> {
    return this.getRoles({ systemRolesOnly: true, limit: 100 });
  }

  // Get active roles for dropdowns
  async getActiveRoles(): Promise<PaginatedResponse<RoleData>> {
    return this.getRoles({ includeInactive: false, limit: 100 });
  }
}

export const rolesService = new RolesService();
