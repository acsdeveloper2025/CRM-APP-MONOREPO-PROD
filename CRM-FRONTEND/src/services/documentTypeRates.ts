import { apiService } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  DocumentTypeRate,
  CreateDocumentTypeRateData,
  UpdateDocumentTypeRateData,
  DocumentTypeRateQuery,
  DocumentTypeRateStats
} from '@/types/documentTypeRates';

export class DocumentTypeRatesService {
  /**
   * Get document type rates with filtering and pagination
   */
  async getDocumentTypeRates(query: DocumentTypeRateQuery = {}): Promise<PaginatedResponse<DocumentTypeRate>> {
    return apiService.get('/document-type-rates', query);
  }

  /**
   * Create or update a document type rate
   * If a rate already exists for the client-product-document type combination, it will be updated
   */
  async createOrUpdateDocumentTypeRate(data: CreateDocumentTypeRateData): Promise<ApiResponse<void>> {
    return apiService.post('/document-type-rates', data);
  }

  /**
   * Delete a document type rate (soft delete - sets isActive to false)
   */
  async deleteDocumentTypeRate(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/document-type-rates/${id}`);
  }

  /**
   * Get statistics for document type rates
   */
  async getDocumentTypeRateStats(): Promise<ApiResponse<DocumentTypeRateStats>> {
    return apiService.get('/document-type-rates/stats');
  }

  /**
   * Helper method to get rates for a specific client
   */
  async getRatesForClient(clientId: number): Promise<PaginatedResponse<DocumentTypeRate>> {
    return this.getDocumentTypeRates({ clientId, limit: 100 });
  }

  /**
   * Helper method to get rates for a specific product
   */
  async getRatesForProduct(productId: number): Promise<PaginatedResponse<DocumentTypeRate>> {
    return this.getDocumentTypeRates({ productId, limit: 100 });
  }

  /**
   * Helper method to get rates for a specific client-product combination
   */
  async getRatesForClientProduct(clientId: number, productId: number): Promise<PaginatedResponse<DocumentTypeRate>> {
    return this.getDocumentTypeRates({ clientId, productId, limit: 100 });
  }

  /**
   * Helper method to get rate for a specific client-product-document type combination
   */
  async getRateForCombination(
    clientId: number,
    productId: number,
    documentTypeId: number
  ): Promise<DocumentTypeRate | null> {
    const response = await this.getDocumentTypeRates({ 
      clientId, 
      productId, 
      documentTypeId, 
      isActive: true,
      limit: 1 
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
export const documentTypeRatesService = new DocumentTypeRatesService();

// Export types for convenience
export type {
  DocumentTypeRate,
  CreateDocumentTypeRateData,
  UpdateDocumentTypeRateData,
  DocumentTypeRateQuery,
  DocumentTypeRateStats
};

