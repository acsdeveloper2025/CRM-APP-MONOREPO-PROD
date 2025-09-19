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
  UpdateVerificationTypeData
} from '@/types/client';
import type { ApiResponse, PaginationQuery } from '@/types/api';

// Smart API URL selection
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
    const staticIP = import.meta.env.VITE_STATIC_IP || 'PUBLIC_STATIC_IP';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const isStaticIP = hostname === staticIP;
  const isDomain = hostname === 'example.com' || hostname === 'www.example.com';

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    return 'http://localhost:3000/api';
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    return `http://${staticIP}:3000/api`;
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    return 'https://example.com/api';
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    return `http://${staticIP}:3000/api`;
  }

  // 5. Fallback to environment variable or localhost
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

export class ClientsService {
  // Client operations
  async getClients(query: PaginationQuery = {}): Promise<ApiResponse<Client[]>> {
    return apiService.get('/clients', query);
  }

  async getClientById(id: number): Promise<ApiResponse<Client>> {
    return apiService.get(`/clients/${id}`);
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
    return apiService.get('/products', query);
  }

  async getProductById(id: number): Promise<ApiResponse<Product>> {
    return apiService.get(`/products/${id}`);
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
  async getVerificationTypes(query: PaginationQuery = {}): Promise<ApiResponse<VerificationType[]>> {
    return apiService.get('/verification-types', query);
  }

  async getVerificationTypeById(id: number): Promise<ApiResponse<VerificationType>> {
    return apiService.get(`/verification-types/${id}`);
  }

  async getVerificationTypesByClient(clientId: number, isActive?: boolean): Promise<ApiResponse<VerificationType[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    return apiService.get(`/clients/${clientId}/verification-types`, params);
  }

  async createVerificationType(data: CreateVerificationTypeData): Promise<ApiResponse<VerificationType>> {
    return apiService.post('/verification-types', data);
  }

  async updateVerificationType(id: number, data: UpdateVerificationTypeData): Promise<ApiResponse<VerificationType>> {
    return apiService.put(`/verification-types/${id}`, data);
  }

  async deleteVerificationType(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/verification-types/${id}`);
  }

  // Mapping operations
  async mapClientToCities(clientId: number, cityIds: number[]): Promise<ApiResponse<void>> {
    return apiService.post(`/clients/${clientId}/cities`, { cityIds });
  }

  async mapProductToVerificationTypes(productId: number, verificationTypeIds: number[]): Promise<ApiResponse<void>> {
    return apiService.post(`/products/${productId}/verification-types`, { verificationTypeIds });
  }

  // Bulk operations
  async bulkImportClients(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/clients/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: formData,
    });
    
    return response.json();
  }

  async bulkImportProducts(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/products/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: formData,
    });
    
    return response.json();
  }
}

export const clientsService = new ClientsService();
