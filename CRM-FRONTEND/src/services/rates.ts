import { apiService } from './api';
import type { ApiResponse, PaginationQuery, PaginatedResponse } from '@/types/api';
import type { Rate, AvailableRateType } from '@/types/rateManagement';
import { validateResponse } from './schemas/runtime';
import { GenericEntityListSchema, GenericObjectSchema } from './schemas/generic.schema';

export type { Rate, AvailableRateType };

export interface CreateOrUpdateRateData {
  clientId: number; // Changed from string to number
  productId: number; // Changed from string to number
  verificationTypeId: number; // Changed from string to number
  rateTypeId: number; // Changed from string to number
  amount: number;
  currency?: string;
}

export interface RateListQuery extends PaginationQuery {
  clientId?: number; // Changed from string to number
  productId?: number; // Changed from string to number
  verificationTypeId?: number; // Changed from string to number
  rateTypeId?: number; // Changed from string to number
  isActive?: boolean;
  search?: string;
  sortBy?:
    | 'clientName'
    | 'productName'
    | 'verificationTypeName'
    | 'rateTypeName'
    | 'amount'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AvailableRateTypesQuery {
  clientId: number; // Changed from string to number
  productId: number; // Changed from string to number
  verificationTypeId: number; // Changed from string to number
}

export interface RateStats {
  total: number;
  active: number;
  inactive: number;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
}

export class RatesService {
  async getRates(query: RateListQuery = {}): Promise<PaginatedResponse<Rate>> {
    const response = await apiService.get<Rate[]>('/rates', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'rates',
        endpoint: 'GET /rates',
      });
    }
    return response as unknown as PaginatedResponse<Rate>;
  }

  async getAvailableRateTypesForAssignment(
    query: AvailableRateTypesQuery
  ): Promise<ApiResponse<AvailableRateType[]>> {
    const response = await apiService.get<AvailableRateType[]>(
      '/rates/available-for-assignment',
      query
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'rates',
        endpoint: 'GET /rates/available-for-assignment',
      });
    }
    return response;
  }

  async createOrUpdateRate(data: CreateOrUpdateRateData): Promise<ApiResponse<void>> {
    return apiService.post('/rates', data);
  }

  async deleteRate(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/rates/${id}`);
  }

  async getRateStats(): Promise<ApiResponse<RateStats>> {
    const response = await apiService.get<RateStats>('/rates/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'rates',
        endpoint: 'GET /rates/stats',
      });
    }
    return response;
  }

  // Helper method to get rates for a specific combination
  async getRatesForCombination(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<PaginatedResponse<Rate>> {
    return this.getRates({ clientId, productId, verificationTypeId, limit: 100 });
  }

  // Helper method to get available rate types for assignment
  async getAvailableRateTypes(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<ApiResponse<AvailableRateType[]>> {
    return this.getAvailableRateTypesForAssignment({ clientId, productId, verificationTypeId });
  }

  // Helper method to set rate for a specific combination
  async setRate(
    clientId: number,
    productId: number,
    verificationTypeId: number,
    rateTypeId: number,
    amount: number,
    currency: string = 'INR'
  ): Promise<ApiResponse<void>> {
    return this.createOrUpdateRate({
      clientId,
      productId,
      verificationTypeId,
      rateTypeId,
      amount,
      currency,
    });
  }

  // Helper method to get all rates with comprehensive filtering
  async getAllRates(
    filters: {
      clientId?: number; // Changed from string to number
      productId?: number; // Changed from string to number
      verificationTypeId?: number; // Changed from string to number
      search?: string;
      isActive?: boolean;
    } = {}
  ): Promise<PaginatedResponse<Rate>> {
    return this.getRates({ ...filters, limit: 100 }); // Backend max limit is 100
  }
}

export const ratesService = new RatesService();
