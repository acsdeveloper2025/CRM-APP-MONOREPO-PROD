import { apiService } from './api';
import type { ApiResponse, PaginationQuery, PaginatedResponse } from '@/types/api';

export interface VerificationType {
  id: number; // Fixed: Changed from string to number to match database
  name: string;
  code: string;
  description?: string;
  category: string;
  isActive: boolean;
  fields?: {
    name: string;
    type: string;
    required: boolean;
    options?: string[];
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVerificationTypeData {
  name: string;
  code: string;
  description?: string;
  category: string;
  isActive?: boolean;
  fields?: {
    name: string;
    type: string;
    required: boolean;
    options?: string[];
  }[];
}

export interface UpdateVerificationTypeData extends Partial<CreateVerificationTypeData> {}

export interface VerificationTypeListQuery extends PaginationQuery {
  category?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class VerificationTypesService {
  async getVerificationTypes(query: VerificationTypeListQuery = {}): Promise<PaginatedResponse<VerificationType>> {
    return apiService.get('/verification-types', query);
  }

  async getVerificationTypeById(id: string): Promise<ApiResponse<VerificationType>> {
    return apiService.get(`/verification-types/${Number(id)}`);
  }

  async createVerificationType(data: CreateVerificationTypeData): Promise<ApiResponse<VerificationType>> {
    return apiService.post('/verification-types', data);
  }

  async updateVerificationType(id: string, data: UpdateVerificationTypeData): Promise<ApiResponse<VerificationType>> {
    return apiService.put(`/verification-types/${Number(id)}`, data);
  }

  async deleteVerificationType(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/verification-types/${Number(id)}`);
  }

  async bulkImportVerificationTypes(verificationTypes: CreateVerificationTypeData[]): Promise<ApiResponse<{ created: number; errors: string[] }>> {
    return apiService.post('/verification-types/bulk-import', { verificationTypes });
  }

  async getVerificationTypeCategories(): Promise<ApiResponse<string[]>> {
    return apiService.get('/verification-types/categories');
  }

  async getVerificationTypeStats(): Promise<ApiResponse<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
  }>> {
    return apiService.get('/verification-types/stats');
  }

  async getVerificationTypesByClient(clientId: string, isActive?: boolean): Promise<ApiResponse<VerificationType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    return apiService.get(`/clients/${Number(clientId)}/verification-types`, params);
  }

  async getVerificationTypesByProduct(productId: string, isActive?: boolean): Promise<ApiResponse<VerificationType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    return apiService.get(`/products/${Number(productId)}/verification-types`, params);
  }
}

export const verificationTypesService = new VerificationTypesService();
