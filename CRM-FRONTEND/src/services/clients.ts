import type { AxiosResponse } from 'axios';
import { apiService } from './api';
import type {
  Client,
  Product,
  VerificationType,
  CreateClientData,
  UpdateClientData,
  CreateProductData,
  UpdateProductData,
  CreateVerificationTypeData,
  UpdateVerificationTypeData,
  ProductMappingPayload,
} from '@/types/client';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import { z } from 'zod';
import { validateResponse } from './schemas/runtime';
import { ClientSchema, ProductSchema } from './schemas/client.schema';

export interface ClientListQuery extends PaginationQuery {
  // 'all' is sent so the URL/cache key is stable; BE ignores it.
  isActive?: 'true' | 'false' | 'all';
  createdFrom?: string; // ISO 8601 (date-only is fine)
  createdTo?: string; // ISO 8601 (treated as end-of-day inclusive by BE)
  // Single-select product filter. 'all' or undefined → no filter; numeric
  // string narrows to clients mapped to that product (client_products).
  productId?: number | 'all';
}

export class ClientsService {
  // Client operations
  async getClients(query: ClientListQuery = {}): Promise<ApiResponse<Client[]>> {
    const response = await apiService.get<Client[]>('/clients', query);
    if (response.success && Array.isArray(response.data)) {
      validateResponse(z.array(ClientSchema), response.data, {
        service: 'clients',
        endpoint: 'GET /clients',
      });
    }
    return response;
  }

  // Excel export — mirrors getClients filters. Returns the raw axios response
  // so the caller can pull headers (Content-Disposition) + the blob body.
  async exportClients(
    query: Omit<ClientListQuery, 'page' | 'limit'> = {}
  ): Promise<AxiosResponse<Blob>> {
    return apiService.getRaw<Blob>('/clients/export', query, {
      responseType: 'blob',
    });
  }

  // 5-card stats aggregate for ClientsPage shell.
  async getClientStats(): Promise<
    ApiResponse<{
      total: number;
      active: number;
      inactive: number;
      recentlyAddedCount: number;
      withoutProductsCount: number;
    }>
  > {
    return apiService.get('/clients/stats');
  }

  async getClientById(id: number): Promise<ApiResponse<Client>> {
    const response = await apiService.get<Client>(`/clients/${id}`);
    if (response.success && response.data) {
      validateResponse(ClientSchema, response.data, {
        service: 'clients',
        endpoint: 'GET /clients/:id',
      });
    }
    return response;
  }

  async getClientProductMappings(id: number): Promise<ApiResponse<ProductMappingPayload[]>> {
    return apiService.get<ProductMappingPayload[]>(`/clients/${id}/product-mappings`);
  }

  async createClient(data: CreateClientData): Promise<ApiResponse<Client>> {
    return apiService.post('/clients', data);
  }

  async updateClient(id: number, data: UpdateClientData): Promise<ApiResponse<Client>> {
    return apiService.put(`/clients/${id}`, data);
  }

  async deleteClient(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/clients/${id}`);
  }

  // Product operations
  async getProducts(query: PaginationQuery = {}): Promise<ApiResponse<Product[]>> {
    const response = await apiService.get<Product[]>('/products', query);
    if (response.success && Array.isArray(response.data)) {
      validateResponse(z.array(ProductSchema), response.data, {
        service: 'clients',
        endpoint: 'GET /products',
      });
    }
    return response;
  }

  async getProductById(id: number): Promise<ApiResponse<Product>> {
    const response = await apiService.get<Product>(`/products/${id}`);
    if (response.success && response.data) {
      validateResponse(ProductSchema, response.data, {
        service: 'clients',
        endpoint: 'GET /products/:id',
      });
    }
    return response;
  }

  async getProductsByClient(clientId: number, isActive?: boolean): Promise<ApiResponse<Product[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    return apiService.get(`/clients/${clientId}/products`, params);
  }

  async createProduct(data: CreateProductData): Promise<ApiResponse<Product>> {
    return apiService.post('/products', data);
  }

  async updateProduct(id: number, data: UpdateProductData): Promise<ApiResponse<Product>> {
    return apiService.put(`/products/${id}`, data);
  }

  async deleteProduct(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/products/${id}`);
  }

  // Verification Type operations
  async getVerificationTypes(
    query: PaginationQuery = {}
  ): Promise<ApiResponse<VerificationType[]>> {
    return apiService.get('/verification-types', query);
  }

  async getVerificationTypeById(id: number): Promise<ApiResponse<VerificationType>> {
    return apiService.get(`/verification-types/${id}`);
  }

  async getVerificationTypesByClient(
    clientId: number,
    isActive?: boolean
  ): Promise<ApiResponse<VerificationType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    return apiService.get(`/clients/${clientId}/verification-types`, params);
  }

  async createVerificationType(
    data: CreateVerificationTypeData
  ): Promise<ApiResponse<VerificationType>> {
    return apiService.post('/verification-types', data);
  }

  async updateVerificationType(
    id: number,
    data: UpdateVerificationTypeData
  ): Promise<ApiResponse<VerificationType>> {
    return apiService.put(`/verification-types/${id}`, data);
  }

  async deleteVerificationType(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/verification-types/${id}`);
  }

  // Mapping operations
  async mapClientToCities(clientId: number, cityIds: number[]): Promise<ApiResponse<void>> {
    return apiService.post(`/clients/${clientId}/cities`, { cityIds });
  }

  async mapProductToVerificationTypes(
    productId: number,
    verificationTypeIds: number[]
  ): Promise<ApiResponse<void>> {
    return apiService.post(`/products/${productId}/verification-types`, { verificationTypeIds });
  }

  // Bulk operations
  async bulkImportClients(file: File): Promise<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post('/clients/bulk-import', formData);
  }

  async bulkImportProducts(file: File): Promise<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post('/products/bulk-import', formData);
  }

  // Branding asset management (logo + stamp). Returns { url } on success.
  async uploadClientLogo(clientId: number, file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post(`/clients/${clientId}/logo`, formData);
  }

  async uploadClientStamp(clientId: number, file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post(`/clients/${clientId}/stamp`, formData);
  }

  async deleteClientLogo(clientId: number): Promise<ApiResponse<unknown>> {
    return apiService.delete(`/clients/${clientId}/logo`);
  }

  async deleteClientStamp(clientId: number): Promise<ApiResponse<unknown>> {
    return apiService.delete(`/clients/${clientId}/stamp`);
  }
}

export const clientsService = new ClientsService();
