import { apiService } from './api';
import type { ApiResponse, PaginationQuery, PaginatedResponse } from '@/types/api';
import type {
  RateType,
  CreateRateTypeData,
  UpdateRateTypeData,
  RateTypeListQuery,
  RateTypeStats,
  AvailableRateTypeForCase
} from '@/types/rateManagement';

export class RateTypesService {
  async getRateTypes(query: RateTypeListQuery = {}): Promise<PaginatedResponse<RateType>> {
    return apiService.get('/rate-types', query);
  }

  async getRateTypeById(id: number): Promise<ApiResponse<RateType>> {
    return apiService.get(`/rate-types/${id}`);
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
    return apiService.get('/rate-types/stats');
  }

  // Get all active rate types for dropdowns
  async getActiveRateTypes(): Promise<ApiResponse<RateType[]>> {
    const response = await this.getRateTypes({ isActive: true, limit: 100 });
    return {
      success: response.success,
      message: response.message,
      data: response.data || [],
      error: response.error
    };
  }

  // Get available rate types for case assignment
  async getAvailableRateTypesForCase(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<ApiResponse<AvailableRateTypeForCase[]>> {
    return apiService.get('/rate-types/available-for-case', {
      clientId,
      productId,
      verificationTypeId
    });
  }
}

export const rateTypesService = new RateTypesService();
