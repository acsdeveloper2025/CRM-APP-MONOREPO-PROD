import type { AxiosResponse } from 'axios';
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
  // `category` is currently a stub on the backend — the verification_types
  // table has no such column (see verificationTypesController.ts:296). Kept
  // optional so legacy callers compile; new callers should omit it.
  category?: string;
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
  // 'all' sent verbatim so URL/cache key stays stable; BE treats it as no-filter.
  isActive?: 'true' | 'false' | 'all' | boolean;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** F9.2: field-task dropdowns pass true to filter out the KYC parent type. */
  excludeKyc?: boolean;
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

  // xlsx export — mirrors getVerificationTypes filters.
  async exportVerificationTypes(
    query: Omit<VerificationTypeListQuery, 'page' | 'limit'> = {}
  ): Promise<AxiosResponse<Blob>> {
    return apiService.getRaw<Blob>('/verification-types/export', query, {
      responseType: 'blob',
    });
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
      recentlyAddedCount?: number;
      withRatesCount?: number;
      byCategory: Record<string, number>;
    }>
  > {
    const response = await apiService.get<{
      total: number;
      active: number;
      inactive: number;
      recentlyAddedCount?: number;
      withRatesCount?: number;
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

  /** VTs scoped to one (client, product) tuple — uses client_product_verifications. */
  async getVerificationTypesForClientProduct(
    clientId: number | string,
    productId: number | string
  ): Promise<ApiResponse<VerificationType[]>> {
    const response = await apiService.get<VerificationType[]>(
      `/clients/${Number(clientId)}/products/${Number(productId)}/verification-types`
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'verificationTypes',
        endpoint: 'GET /clients/:clientId/products/:productId/verification-types',
      });
    }
    return response;
  }
}

export const verificationTypesService = new VerificationTypesService();
