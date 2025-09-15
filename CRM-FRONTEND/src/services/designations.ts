import { apiService } from './api';
import { 
  Designation, 
  CreateDesignationRequest, 
  UpdateDesignationRequest 
} from '@/types/user';

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

export interface DesignationsParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  departmentId?: string;
}

class DesignationsService {
  private baseUrl = '/designations';

  async getDesignations(params: DesignationsParams = {}): Promise<DesignationsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());
    if (params.departmentId) searchParams.append('departmentId', params.departmentId);

    const queryString = searchParams.toString();
    const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;
    
    const response = await apiService.get<DesignationsResponse>(url);
    return response;
  }

  async getDesignationById(id: string): Promise<DesignationResponse> {
    const response = await apiService.get<DesignationResponse>(`${this.baseUrl}/${id}`);
    return response;
  }

  async createDesignation(data: CreateDesignationRequest): Promise<DesignationResponse> {
    const response = await apiService.post<DesignationResponse>(this.baseUrl, data);
    return response;
  }

  async updateDesignation(id: string, data: UpdateDesignationRequest): Promise<DesignationResponse> {
    const response = await apiService.put<DesignationResponse>(`${this.baseUrl}/${id}`, data);
    return response;
  }

  async deleteDesignation(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${id}`);
    return response;
  }

  async getActiveDesignations(departmentId?: string): Promise<DesignationsResponse> {
    const searchParams = new URLSearchParams();
    if (departmentId) searchParams.append('departmentId', departmentId);
    
    const queryString = searchParams.toString();
    const url = queryString ? `${this.baseUrl}/active?${queryString}` : `${this.baseUrl}/active`;
    
    const response = await apiService.get<DesignationsResponse>(url);
    return response;
  }

  // Helper method to get designations for a specific department
  async getDesignationsByDepartment(departmentId: string): Promise<DesignationsResponse> {
    return this.getDesignations({ departmentId, isActive: true });
  }

  // Helper method to search designations
  async searchDesignations(searchTerm: string, departmentId?: string): Promise<DesignationsResponse> {
    return this.getDesignations({ 
      search: searchTerm, 
      departmentId,
      isActive: true 
    });
  }
}

export const designationsService = new DesignationsService();
