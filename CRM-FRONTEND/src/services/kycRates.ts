import type { AxiosResponse } from 'axios';
import { apiService } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  KYCRate,
  CreateKYCRateData,
  UpdateKYCRateData,
  KYCRateQuery,
  KYCRateStats,
} from '@/types/kycRates';
import { validateResponse } from './schemas/runtime';
import { GenericEntityListSchema, GenericObjectSchema } from './schemas/generic.schema';

export class KYCRatesService {
  /**
   * Get document type rates with filtering and pagination
   */
  async getKYCRates(query: KYCRateQuery = {}): Promise<PaginatedResponse<KYCRate>> {
    const response = await apiService.get<KYCRate[]>('/kyc-rates', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'kycRates',
        endpoint: 'GET /kyc-rates',
      });
    }
    return response as unknown as PaginatedResponse<KYCRate>;
  }

  /**
   * Create or update a document type rate
   * If a rate already exists for the client-product-document type combination, it will be updated
   */
  async createOrUpdateKYCRate(data: CreateKYCRateData): Promise<ApiResponse<void>> {
    return apiService.post('/kyc-rates', data);
  }

  /**
   * Delete a document type rate (soft delete - sets isActive to false)
   */
  async deleteKYCRate(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/kyc-rates/${id}`);
  }

  /**
   * Get statistics for document type rates
   */
  async getKYCRateStats(): Promise<ApiResponse<KYCRateStats>> {
    const response = await apiService.get<KYCRateStats>('/kyc-rates/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'kycRates',
        endpoint: 'GET /kyc-rates/stats',
      });
    }
    return response;
  }

  // xlsx export — mirrors getKYCRates filters via shared BE WHERE-helper.
  async exportKYCRates(
    query: Omit<KYCRateQuery, 'page' | 'limit'> = {}
  ): Promise<AxiosResponse<Blob>> {
    return apiService.getRaw<Blob>('/kyc-rates/export', query, { responseType: 'blob' });
  }

  /**
   * Helper method to get rates for a specific client
   */
  async getRatesForClient(clientId: number): Promise<PaginatedResponse<KYCRate>> {
    return this.getKYCRates({ clientId, limit: 100 });
  }

  /**
   * Helper method to get rates for a specific product
   */
  async getRatesForProduct(productId: number): Promise<PaginatedResponse<KYCRate>> {
    return this.getKYCRates({ productId, limit: 100 });
  }

  /**
   * Helper method to get rates for a specific client-product combination
   */
  async getRatesForClientProduct(
    clientId: number,
    productId: number
  ): Promise<PaginatedResponse<KYCRate>> {
    return this.getKYCRates({ clientId, productId, limit: 100 });
  }

  /**
   * Helper method to get rate for a specific client-product-document type combination
   */
  async getRateForCombination(
    clientId: number,
    productId: number,
    documentTypeId: number
  ): Promise<KYCRate | null> {
    const response = await this.getKYCRates({
      clientId,
      productId,
      documentTypeId,
      isActive: true,
      limit: 1,
    });
    return response.data && response.data.length > 0 ? response.data[0] : null;
  }

  /**
   * Helper method to check if a rate exists for a combination
   */
  async hasRate(clientId: number, productId: number, documentTypeId: number): Promise<boolean> {
    const rate = await this.getRateForCombination(clientId, productId, documentTypeId);
    return rate !== null;
  }
}

// Export singleton instance
export const kycRatesService = new KYCRatesService();

// Export types for convenience
export type { KYCRate, CreateKYCRateData, UpdateKYCRateData, KYCRateQuery, KYCRateStats };
