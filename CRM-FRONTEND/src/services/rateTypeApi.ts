import { apiService } from './api';
import { RateType, CreateRateTypeData, UpdateRateTypeData, RateTypeListQuery } from '../types/rateManagement';

export interface GetRateTypesResponse {
  data: RateType[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const rateTypeApi = {
  // Get all rate types with optional filtering
  async getRateTypes(params: RateTypeListQuery = {}): Promise<GetRateTypesResponse> {
    const response = await apiService.get('/rate-types', params);
    return {
      data: response.data || [],
      pagination: response.pagination
    };
  },

  // Get rate type by ID
  async getRateTypeById(id: number): Promise<RateType> {
    const response = await apiService.get(`/rate-types/${id}`);
    return response.data;
  },

  // Create new rate type
  async createRateType(rateTypeData: CreateRateTypeData): Promise<RateType> {
    const response = await apiService.post('/rate-types', rateTypeData);
    return response.data;
  },

  // Update rate type
  async updateRateType(id: number, rateTypeData: UpdateRateTypeData): Promise<RateType> {
    const response = await apiService.put(`/rate-types/${id}`, rateTypeData);
    return response.data;
  },

  // Delete rate type
  async deleteRateType(id: number): Promise<void> {
    await apiService.delete(`/rate-types/${id}`);
  },

  // Get active rate types only
  async getActiveRateTypes(): Promise<RateType[]> {
    const response = await this.getRateTypes({ isActive: true });
    return response.data;
  },

  // Search rate types
  async searchRateTypes(query: string): Promise<RateType[]> {
    const response = await this.getRateTypes({ search: query });
    return response.data;
  },

  // Export rate types
  async exportRateTypes(params: RateTypeListQuery = {}): Promise<Blob> {
    const response = await apiService.get('/rate-types/export', params, { responseType: 'blob' });
    return response.data;
  }
};
