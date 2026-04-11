import { apiService } from './api';
import type { ApiResponse, PaginationQuery, PaginatedResponse } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import {
  GenericEntitySchema,
  GenericEntityListSchema,
  GenericObjectSchema,
} from './schemas/generic.schema';

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
  hasRates?: boolean;
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

export type UpdateVerificationTypeData = Partial<CreateVerificationTypeData>;

export interface VerificationTypeListQuery extends PaginationQuery {
  category?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class VerificationTypesService {
  async getVerificationTypes(
    query: VerificationTypeListQuery = {}
  ): Promise<PaginatedResponse<VerificationType>> {
    const response = await apiService.get<VerificationType[]>('/verification-types', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'verificationTypes',
        endpoint: 'GET /verification-types',
      });
    }
    return response as PaginatedResponse<VerificationType>;
  }

  async getVerificationTypeById(id: string): Promise<ApiResponse<VerificationType>> {
    const response = await apiService.get<VerificationType>(`/verification-types/${Number(id)}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'verificationTypes',
        endpoint: 'GET /verification-types/:id',
      });
    }
    return response;
  }

  async createVerificationType(
    data: CreateVerificationTypeData
  ): Promise<ApiResponse<VerificationType>> {
    return apiService.post('/verification-types', data);
  }

  async updateVerificationType(
    id: string,
    data: UpdateVerificationTypeData
  ): Promise<ApiResponse<VerificationType>> {
    return apiService.put(`/verification-types/${Number(id)}`, data);
  }

  async deleteVerificationType(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/verification-types/${Number(id)}`);
  }

  async bulkImportVerificationTypes(
    verificationTypes: CreateVerificationTypeData[]
  ): Promise<ApiResponse<{ created: number; errors: string[] }>> {
    return apiService.post('/verification-types/bulk-import', { verificationTypes });
  }

  async getVerificationTypeCategories(): Promise<ApiResponse<string[]>> {
    return apiService.get('/verification-types/categories');
  }

  async getVerificationTypeStats(): Promise<
    ApiResponse<{
      total: number;
      active: number;
      inactive: number;
      byCategory: Record<string, number>;
    }>
  > {
    const response = await apiService.get<{
      total: number;
      active: number;
      inactive: number;
      byCategory: Record<string, number>;
    }>('/verification-types/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'verificationTypes',
        endpoint: 'GET /verification-types/stats',
      });
    }
    return response;
  }

  async getVerificationTypesByClient(
    clientId: string,
    isActive?: boolean
  ): Promise<ApiResponse<VerificationType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    const response = await apiService.get<VerificationType[]>(
      `/clients/${Number(clientId)}/verification-types`,
      params
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'verificationTypes',
        endpoint: 'GET /clients/:clientId/verification-types',
      });
    }
    return response;
  }

  async getVerificationTypesByProduct(
    productId: string,
    isActive?: boolean
  ): Promise<ApiResponse<VerificationType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    const response = await apiService.get<VerificationType[]>(
      `/products/${Number(productId)}/verification-types`,
      params
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'verificationTypes',
        endpoint: 'GET /products/:productId/verification-types',
      });
    }
    return response;
  }
}

export const verificationTypesService = new VerificationTypesService();
