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
  DocumentTypeExportData
} from '@/types';

class DocumentTypesService {
  // Document Type CRUD Operations
  async getDocumentTypes(filters: DocumentTypeFilters = {}): Promise<ApiResponse<DocumentType[]>> {
    return apiService.get('/document-types', filters);
  }

  async getDocumentTypeById(id: number): Promise<ApiResponse<DocumentType>> {
    return apiService.get(`/document-types/${id}`);
  }

  async createDocumentType(data: CreateDocumentTypeData): Promise<ApiResponse<DocumentType>> {
    return apiService.post('/document-types', data);
  }

  async updateDocumentType(id: number, data: UpdateDocumentTypeData): Promise<ApiResponse<DocumentType>> {
    return apiService.put(`/document-types/${id}`, data);
  }

  async deleteDocumentType(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/document-types/${id}`);
  }

  // Document Type Statistics and Categories
  async getDocumentTypeStats(): Promise<ApiResponse<DocumentTypeStats>> {
    return apiService.get('/document-types/stats');
  }

  async getDocumentTypeCategories(): Promise<ApiResponse<string[]>> {
    return apiService.get('/document-types/categories');
  }

  // Client-Document Type Mappings
  async getDocumentTypesByClient(clientId: number, isActive?: boolean): Promise<ApiResponse<ClientDocumentType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    return apiService.get(`/clients/${clientId}/document-types`, params);
  }

  async assignDocumentTypesToClient(clientId: number, data: AssignDocumentTypesToClientData): Promise<ApiResponse<ClientDocumentType[]>> {
    return apiService.post(`/clients/${clientId}/document-types`, data);
  }

  async removeDocumentTypeFromClient(clientId: number, documentTypeId: number): Promise<ApiResponse<void>> {
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
  async validateDocument(data: ValidateDocumentRequest): Promise<ApiResponse<DocumentValidationResult>> {
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
      data
    });
  }

  // Import/Export Operations
  async exportDocumentTypes(filters: DocumentTypeFilters = {}): Promise<ApiResponse<DocumentTypeExportData[]>> {
    return apiService.get('/document-types/export', filters);
  }

  async importDocumentTypes(file: File): Promise<ApiResponse<{ created: number; errors: string[] }>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${apiService.getBaseUrl()}/document-types/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
      body: formData,
    });
    
    return response.json();
  }

  // Helper Methods
  async getDocumentTypesByCategory(category: string): Promise<ApiResponse<DocumentType[]>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.getDocumentTypes({ category: category as any });
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
    return apiService.get('/document-types/suggestions', { q: query, limit: 10 });
  }

  // Document Type Usage Analytics
  async getDocumentTypeUsage(documentTypeId: number): Promise<ApiResponse<{
    totalUsage: number;
    clientCount: number;
    productCount: number;
    recentUsage: Array<{
      date: string;
      count: number;
    }>;
  }>> {
    return apiService.get(`/document-types/${documentTypeId}/usage`);
  }

  // Client Document Type Recommendations
  async getRecommendedDocumentTypesForClient(clientId: number): Promise<ApiResponse<DocumentType[]>> {
    return apiService.get(`/clients/${clientId}/recommended-document-types`);
  }

  // Document Type Templates
  async getDocumentTypeTemplates(): Promise<ApiResponse<{
    identity: DocumentType[];
    address: DocumentType[];
    financial: DocumentType[];
    business: DocumentType[];
    education: DocumentType[];
    other: DocumentType[];
  }>> {
    return apiService.get('/document-types/templates');
  }

  // Document Type Validation Rules
  async getValidationRules(documentTypeId: number): Promise<ApiResponse<{
    formatPattern?: string;
    minLength?: number;
    maxLength?: number;
    customRules?: Record<string, unknown>;
  }>> {
    return apiService.get(`/document-types/${documentTypeId}/validation-rules`);
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
  async cloneDocumentType(documentTypeId: number, newName: string, newCode: string): Promise<ApiResponse<DocumentType>> {
    return apiService.post(`/document-types/${documentTypeId}/clone`, {
      name: newName,
      code: newCode
    });
  }

  // Document Type Ordering
  async reorderDocumentTypes(documentTypeIds: number[]): Promise<ApiResponse<void>> {
    return apiService.put('/document-types/reorder', { documentTypeIds });
  }

  // Document Type Dependencies
  async getDocumentTypeDependencies(documentTypeId: number): Promise<ApiResponse<{
    clients: Array<{ id: number; name: string; code: string }>;
    products: Array<{ id: number; name: string; code: string }>;
    verificationTasks: number;
    cases: number;
  }>> {
    return apiService.get(`/document-types/${documentTypeId}/dependencies`);
  }

  // Document Type Audit Trail
  async getDocumentTypeAuditTrail(documentTypeId: number): Promise<ApiResponse<Array<{
    id: string;
    action: string;
    userId: string;
    userName: string;
    timestamp: string;
    details: Record<string, unknown>;
  }>>> {
    return apiService.get(`/document-types/${documentTypeId}/audit-trail`);
  }
}

export const documentTypesService = new DocumentTypesService();
