import { apiService } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  RateType,
  CreateRateTypeData,
  UpdateRateTypeData,
  RateTypeListQuery,
  RateTypeStats,
  AvailableRateTypeForCase,
} from '@/types/rateManagement';
import { validateResponse } from './schemas/runtime';
import {
  GenericEntitySchema,
  GenericEntityListSchema,
  GenericObjectSchema,
} from './schemas/generic.schema';

export type {
  RateType,
  CreateRateTypeData,
  UpdateRateTypeData,
  RateTypeListQuery,
  RateTypeStats,
  AvailableRateTypeForCase,
};

export class RateTypesService {
  async getRateTypes(query: RateTypeListQuery = {}): Promise<PaginatedResponse<RateType>> {
    const response = await apiService.get<RateType[]>('/rate-types', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'rateTypes',
        endpoint: 'GET /rate-types',
      });
    }
    return response as unknown as PaginatedResponse<RateType>;
  }

  async getRateTypeById(id: number): Promise<ApiResponse<RateType>> {
    const response = await apiService.get<RateType>(`/rate-types/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'rateTypes',
        endpoint: 'GET /rate-types/:id',
      });
    }
    return response;
  }

  async createRateType(data: CreateRateTypeData): Promise<ApiResponse<RateType>> {
    return apiService.post('/rate-types', data);
  }

  async updateRateType(id: number, data: UpdateRateTypeData): Promise<ApiResponse<RateType>> {
    return apiService.put(`/rate-types/${id}`, data);
  }

  async deleteRateType(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/rate-types/${id}`);
  }

  async getRateTypeStats(): Promise<ApiResponse<RateTypeStats>> {
    const response = await apiService.get<RateTypeStats>('/rate-types/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'rateTypes',
        endpoint: 'GET /rate-types/stats',
      });
    }
    return response;
  }

  // Get all active rate types for dropdowns
  async getActiveRateTypes(): Promise<ApiResponse<RateType[]>> {
    const response = await this.getRateTypes({ isActive: true, limit: 100 });
    return {
      success: response.success,
      message: response.message,
      data: response.data || [],
      error: response.error,
    };
  }

  // Get available rate types for case assignment
  async getAvailableRateTypesForCase(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<ApiResponse<AvailableRateTypeForCase[]>> {
    const response = await apiService.get<AvailableRateTypeForCase[]>(
      '/rate-types/available-for-case',
      {
        clientId,
        productId,
        verificationTypeId,
      }
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'rateTypes',
        endpoint: 'GET /rate-types/available-for-case',
      });
    }
    return response;
  }
}

export const rateTypesService = new RateTypesService();
