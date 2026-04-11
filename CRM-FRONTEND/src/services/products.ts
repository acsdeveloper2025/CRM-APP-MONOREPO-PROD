import { apiService } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  Product,
  CreateProductData,
  UpdateProductData,
  ProductListQuery,
} from '@/types/product';
import { validateResponse } from './schemas/runtime';
import {
  GenericEntitySchema,
  GenericEntityListSchema,
  GenericObjectSchema,
} from './schemas/generic.schema';

export class ProductsService {
  async getProducts(query: ProductListQuery = {}): Promise<PaginatedResponse<Product>> {
    const response = await apiService.get<Product[]>('/products', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'products',
        endpoint: 'GET /products',
      });
    }
    return response as PaginatedResponse<Product>;
  }

  async getProductById(id: string): Promise<ApiResponse<Product>> {
    const response = await apiService.get<Product>(`/products/${Number(id)}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'products',
        endpoint: 'GET /products/:id',
      });
    }
    return response;
  }

  async createProduct(data: CreateProductData): Promise<ApiResponse<Product>> {
    return apiService.post('/products', data);
  }

  async updateProduct(id: string, data: UpdateProductData): Promise<ApiResponse<Product>> {
    return apiService.put(`/products/${Number(id)}`, data);
  }

  async deleteProduct(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/products/${Number(id)}`);
  }

  async getProductsByClient(clientId: string, isActive?: boolean): Promise<ApiResponse<Product[]>> {
    const params = isActive !== undefined ? { isActive } : {};
    const response = await apiService.get<Product[]>(
      `/clients/${Number(clientId)}/products`,
      params
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'products',
        endpoint: 'GET /clients/:clientId/products',
      });
    }
    return response;
  }

  async mapVerificationTypes(
    productId: string,
    verificationTypes: string[]
  ): Promise<ApiResponse<void>> {
    return apiService.post(`/products/${Number(productId)}/verification-types`, {
      verificationTypes,
    });
  }

  async bulkImportProducts(
    products: CreateProductData[]
  ): Promise<ApiResponse<{ created: number; errors: string[] }>> {
    return apiService.post('/products/bulk-import', { products });
  }

  async getProductCategories(): Promise<ApiResponse<string[]>> {
    return apiService.get('/products/categories');
  }

  async getProductStats(): Promise<
    ApiResponse<{
      total: number;
      active: number;
      inactive: number;
      byCategory: Record<string, number>;
    }>
  > {
    const response = await apiService.get<{
      total: number;
      active: number;
      inactive: number;
      byCategory: Record<string, number>;
    }>('/products/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'products',
        endpoint: 'GET /products/stats',
      });
    }
    return response;
  }
}

export const productsService = new ProductsService();
