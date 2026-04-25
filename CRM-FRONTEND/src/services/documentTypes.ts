import { apiService } from './api';
import type {
  ApiResponse,
  DocumentType,
  CreateDocumentTypeData,
  UpdateDocumentTypeData,
  DocumentTypeFilters,
  DocumentTypeStats,
  AssignDocumentTypesToClientData,
  ClientDocumentType,
  DocumentValidationResult,
  ValidateDocumentRequest,
  DocumentTypeExportData,
} from '@/types';
import { validateResponse } from './schemas/runtime';
import {
  GenericEntitySchema,
  GenericEntityListSchema,
  GenericObjectSchema,
} from './schemas/generic.schema';

class DocumentTypesService {
  // Document Type CRUD Operations
  async getDocumentTypes(filters: DocumentTypeFilters = {}): Promise<ApiResponse<DocumentType[]>> {
    const response = await apiService.get<DocumentType[]>('/document-types', filters);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types',
      });
    }
    return response;
  }

  /** DocTypes scoped to one (client, product) tuple — uses client_product_documents. */
  async getDocumentTypesForClientProduct(
    clientId: number | string,
    productId: number | string
  ): Promise<ApiResponse<DocumentType[]>> {
    const response = await apiService.get<DocumentType[]>(
      `/clients/${Number(clientId)}/products/${Number(productId)}/document-types`
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /clients/:clientId/products/:productId/document-types',
      });
    }
    return response;
  }

  async getDocumentTypeById(id: number): Promise<ApiResponse<DocumentType>> {
    const response = await apiService.get<DocumentType>(`/document-types/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/:id',
      });
    }
    return response;
  }

  async createDocumentType(data: CreateDocumentTypeData): Promise<ApiResponse<DocumentType>> {
    return apiService.post('/document-types', data);
  }

  async updateDocumentType(
    id: number,
    data: UpdateDocumentTypeData
  ): Promise<ApiResponse<DocumentType>> {
    return apiService.put(`/document-types/${id}`, data);
  }

  async deleteDocumentType(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/document-types/${id}`);
  }

  // Document Type Statistics and Categories
  async getDocumentTypeStats(): Promise<ApiResponse<DocumentTypeStats>> {
    const response = await apiService.get<DocumentTypeStats>('/document-types/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/stats',
      });
    }
    return response;
  }

  async getDocumentTypeCategories(): Promise<ApiResponse<string[]>> {
    return apiService.get('/document-types/categories');
  }

  // Client-Document Type Mappings
  async getDocumentTypesByClient(
    clientId: number,
    isActive?: boolean
  ): Promise<ApiResponse<ClientDocumentType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    const response = await apiService.get<ClientDocumentType[]>(
      `/clients/${clientId}/document-types`,
      params
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /clients/:clientId/document-types',
      });
    }
    return response;
  }

  async assignDocumentTypesToClient(
    clientId: number,
    data: AssignDocumentTypesToClientData
  ): Promise<ApiResponse<ClientDocumentType[]>> {
    return apiService.post(`/clients/${clientId}/document-types`, data);
  }

  async removeDocumentTypeFromClient(
    clientId: number,
    documentTypeId: number
  ): Promise<ApiResponse<void>> {
    return apiService.delete(`/clients/${clientId}/document-types/${documentTypeId}`);
  }

  async updateClientDocumentTypeMapping(
    clientId: number,
    documentTypeId: number,
    data: { isRequired?: boolean; priority?: number; clientSpecificRules?: Record<string, unknown> }
  ): Promise<ApiResponse<ClientDocumentType>> {
    return apiService.put(`/clients/${clientId}/document-types/${documentTypeId}`, data);
  }

  // Document Validation
  async validateDocument(
    data: ValidateDocumentRequest
  ): Promise<ApiResponse<DocumentValidationResult>> {
    return apiService.post('/document-types/validate', data);
  }

  // Bulk Operations
  async bulkUpdateDocumentTypes(
    documentTypeIds: number[],
    operation: 'activate' | 'deactivate' | 'delete' | 'updateCategory',
    data?: { category?: string; isActive?: boolean; reason?: string }
  ): Promise<ApiResponse<{ updated: number; errors: string[] }>> {
    return apiService.post('/document-types/bulk-update', {
      documentTypeIds,
      operation,
      data,
    });
  }

  // Import/Export Operations
  async exportDocumentTypes(
    filters: DocumentTypeFilters = {}
  ): Promise<ApiResponse<DocumentTypeExportData[]>> {
    const response = await apiService.get<DocumentTypeExportData[]>(
      '/document-types/export',
      filters
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/export',
      });
    }
    return response;
  }

  async importDocumentTypes(
    file: File
  ): Promise<ApiResponse<{ created: number; errors: string[] }>> {
    const formData = new FormData();
    formData.append('file', file);

    // Use apiService directly - it handles Content-Type for FormData automatically
    // and adds the Authorization header via interceptors
    return apiService.post('/document-types/import', formData);
  }

  // Helper Methods
  async getDocumentTypesByCategory(category: string): Promise<ApiResponse<DocumentType[]>> {
    return this.getDocumentTypes({
      category: category as import('@/types/documentType').DocumentCategory,
    });
  }

  async getActiveDocumentTypes(): Promise<ApiResponse<DocumentType[]>> {
    return this.getDocumentTypes({ isActive: true });
  }

  async getGovernmentIssuedDocumentTypes(): Promise<ApiResponse<DocumentType[]>> {
    return this.getDocumentTypes({ isGovernmentIssued: true });
  }

  async searchDocumentTypes(searchTerm: string): Promise<ApiResponse<DocumentType[]>> {
    return this.getDocumentTypes({ search: searchTerm });
  }

  // Document Type Suggestions
  async getDocumentTypeSuggestions(query: string): Promise<ApiResponse<DocumentType[]>> {
    const response = await apiService.get<DocumentType[]>('/document-types/suggestions', {
      q: query,
      limit: 10,
    });
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/suggestions',
      });
    }
    return response;
  }

  // Document Type Usage Analytics
  async getDocumentTypeUsage(documentTypeId: number): Promise<
    ApiResponse<{
      totalUsage: number;
      clientCount: number;
      productCount: number;
      recentUsage: Array<{
        date: string;
        count: number;
      }>;
    }>
  > {
    const response = await apiService.get<{
      totalUsage: number;
      clientCount: number;
      productCount: number;
      recentUsage: Array<{ date: string; count: number }>;
    }>(`/document-types/${documentTypeId}/usage`);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/:id/usage',
      });
    }
    return response;
  }

  // Client Document Type Recommendations
  async getRecommendedDocumentTypesForClient(
    clientId: number
  ): Promise<ApiResponse<DocumentType[]>> {
    const response = await apiService.get<DocumentType[]>(
      `/clients/${clientId}/recommended-document-types`
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /clients/:clientId/recommended-document-types',
      });
    }
    return response;
  }

  // Document Type Templates
  async getDocumentTypeTemplates(): Promise<
    ApiResponse<{
      identity: DocumentType[];
      address: DocumentType[];
      financial: DocumentType[];
      business: DocumentType[];
      education: DocumentType[];
      other: DocumentType[];
    }>
  > {
    const response = await apiService.get<{
      identity: DocumentType[];
      address: DocumentType[];
      financial: DocumentType[];
      business: DocumentType[];
      education: DocumentType[];
      other: DocumentType[];
    }>('/document-types/templates');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/templates',
      });
    }
    return response;
  }

  // Document Type Validation Rules
  async getValidationRules(documentTypeId: number): Promise<
    ApiResponse<{
      formatPattern?: string;
      minLength?: number;
      maxLength?: number;
      customRules?: Record<string, unknown>;
    }>
  > {
    const response = await apiService.get<{
      formatPattern?: string;
      minLength?: number;
      maxLength?: number;
      customRules?: Record<string, unknown>;
    }>(`/document-types/${documentTypeId}/validation-rules`);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/:id/validation-rules',
      });
    }
    return response;
  }

  async updateValidationRules(
    documentTypeId: number,
    rules: {
      formatPattern?: string;
      minLength?: number;
      maxLength?: number;
      customRules?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<DocumentType>> {
    return apiService.put(`/document-types/${documentTypeId}/validation-rules`, rules);
  }

  // Document Type Cloning
  async cloneDocumentType(
    documentTypeId: number,
    newName: string,
    newCode: string
  ): Promise<ApiResponse<DocumentType>> {
    return apiService.post(`/document-types/${documentTypeId}/clone`, {
      name: newName,
      code: newCode,
    });
  }

  // Document Type Ordering
  async reorderDocumentTypes(documentTypeIds: number[]): Promise<ApiResponse<void>> {
    return apiService.put('/document-types/reorder', { documentTypeIds });
  }

  // Document Type Dependencies
  async getDocumentTypeDependencies(documentTypeId: number): Promise<
    ApiResponse<{
      clients: Array<{ id: number; name: string; code: string }>;
      products: Array<{ id: number; name: string; code: string }>;
      verificationTasks: number;
      cases: number;
    }>
  > {
    const response = await apiService.get<{
      clients: Array<{ id: number; name: string; code: string }>;
      products: Array<{ id: number; name: string; code: string }>;
      verificationTasks: number;
      cases: number;
    }>(`/document-types/${documentTypeId}/dependencies`);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/:id/dependencies',
      });
    }
    return response;
  }

  // Document Type Audit Trail
  async getDocumentTypeAuditTrail(documentTypeId: number): Promise<
    ApiResponse<
      Array<{
        id: string;
        action: string;
        userId: string;
        userName: string;
        timestamp: string;
        details: Record<string, unknown>;
      }>
    >
  > {
    const response = await apiService.get<
      Array<{
        id: string;
        action: string;
        userId: string;
        userName: string;
        timestamp: string;
        details: Record<string, unknown>;
      }>
    >(`/document-types/${documentTypeId}/audit-trail`);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'documentTypes',
        endpoint: 'GET /document-types/:id/audit-trail',
      });
    }
    return response;
  }
}

export const documentTypesService = new DocumentTypesService();
