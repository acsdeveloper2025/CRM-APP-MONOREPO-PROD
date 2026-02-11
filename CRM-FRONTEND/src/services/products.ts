import { apiService } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Product, CreateProductData, UpdateProductData, ProductListQuery } from '@/types/product';



export class ProductsService {
  async getProducts(query: ProductListQuery = {}): Promise<PaginatedResponse<Product>> {
    const response = await apiService.get<Product[]>('/products', query);
    return response as PaginatedResponse<Product>;
  }

  async getProductById(id: string): Promise<ApiResponse<Product>> {
    return apiService.get(`/products/${Number(id)}`);
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
    return apiService.get(`/clients/${Number(clientId)}/products`, params);
  }

  async mapVerificationTypes(productId: string, verificationTypes: string[]): Promise<ApiResponse<void>> {
    return apiService.post(`/products/${Number(productId)}/verification-types`, { verificationTypes });
  }

  async bulkImportProducts(products: CreateProductData[]): Promise<ApiResponse<{ created: number; errors: string[] }>> {
    return apiService.post('/products/bulk-import', { products });
  }

  async getProductCategories(): Promise<ApiResponse<string[]>> {
    return apiService.get('/products/categories');
  }

  async getProductStats(): Promise<ApiResponse<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
  }>> {
    return apiService.get('/products/stats');
  }
}

export const productsService = new ProductsService();
