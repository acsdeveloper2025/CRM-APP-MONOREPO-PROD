/**
 * Base API Service
 * 
 * Provides centralized API configuration, URL detection, and common functionality
 * to eliminate code duplication across service files.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, PaginatedResponse, ErrorResponse } from '@/types';
import { ERROR_CODES, STORAGE_KEYS } from '@/types/constants';

// Environment configuration
const getApiBaseUrl = (): string => {
  // Smart URL detection logic (centralized)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production environment
    if (hostname === 'crm.allcheckservices.com') {
      return 'https://crm.allcheckservices.com/api';
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    }
    
    // Default fallback
    return `${window.location.protocol}//${hostname}/api`;
  }
  
  // Server-side fallback
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

// Create axios instance with default configuration
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '10000'),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor for authentication
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle 401 errors (token expired)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
          if (refreshToken) {
            const response = await axios.post(`${getApiBaseUrl()}/auth/refresh`, {
              refreshToken,
            });
            
            const { accessToken } = response.data.data;
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return instance(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Base API service class
export class BaseApiService {
  protected api: AxiosInstance;
  protected baseEndpoint: string;

  constructor(baseEndpoint: string) {
    this.api = createApiInstance();
    this.baseEndpoint = baseEndpoint;
  }

  // Generic GET request
  protected async get<T = any>(
    endpoint: string = '',
    params?: Record<string, any>,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.api.get(
        `${this.baseEndpoint}${endpoint}`,
        { params, ...config }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic POST request
  protected async post<T = any>(
    endpoint: string = '',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.api.post(
        `${this.baseEndpoint}${endpoint}`,
        data,
        config
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic PUT request
  protected async put<T = any>(
    endpoint: string = '',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.api.put(
        `${this.baseEndpoint}${endpoint}`,
        data,
        config
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic PATCH request
  protected async patch<T = any>(
    endpoint: string = '',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.api.patch(
        `${this.baseEndpoint}${endpoint}`,
        data,
        config
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic DELETE request
  protected async delete<T = any>(
    endpoint: string = '',
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.api.delete(
        `${this.baseEndpoint}${endpoint}`,
        config
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Paginated GET request
  protected async getPaginated<T = any>(
    endpoint: string = '',
    params?: Record<string, any>,
    config?: AxiosRequestConfig
  ): Promise<PaginatedResponse<T>> {
    try {
      const response: AxiosResponse<PaginatedResponse<T>> = await this.api.get(
        `${this.baseEndpoint}${endpoint}`,
        { params, ...config }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // File upload request
  protected async uploadFile<T = any>(
    endpoint: string = '',
    file: File,
    additionalData?: Record<string, any>,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }

      const response: AxiosResponse<ApiResponse<T>> = await this.api.post(
        `${this.baseEndpoint}${endpoint}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress,
        }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Bulk operations
  protected async bulkOperation<T = any>(
    endpoint: string = '',
    operation: string,
    ids: string[],
    data?: any
  ): Promise<ApiResponse<T>> {
    return this.post(endpoint, {
      operation,
      ids,
      data,
    });
  }

  // Export data
  protected async exportData(
    endpoint: string = '',
    format: 'excel' | 'csv' | 'pdf' = 'excel',
    filters?: Record<string, any>
  ): Promise<Blob> {
    try {
      const response = await this.api.get(`${this.baseEndpoint}${endpoint}`, {
        params: { format, ...filters },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handling
  private handleError(error: any): ErrorResponse {
    console.error('API Error:', error);

    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      return {
        success: false,
        message: data?.message || `HTTP Error ${status}`,
        error: {
          code: data?.error?.code || this.getErrorCodeFromStatus(status),
          details: data?.error?.details || error.response.data,
        },
      };
    } else if (error.request) {
      // Network error
      return {
        success: false,
        message: 'Network error. Please check your connection.',
        error: {
          code: ERROR_CODES.NETWORK_ERROR,
          details: error.message,
        },
      };
    } else {
      // Other error
      return {
        success: false,
        message: error.message || 'An unexpected error occurred',
        error: {
          code: ERROR_CODES.SERVER_ERROR,
          details: error.message,
        },
      };
    }
  }

  // Map HTTP status codes to error codes
  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case 401:
        return ERROR_CODES.UNAUTHORIZED;
      case 403:
        return ERROR_CODES.FORBIDDEN;
      case 404:
        return ERROR_CODES.NOT_FOUND;
      case 422:
        return ERROR_CODES.VALIDATION_ERROR;
      case 408:
        return ERROR_CODES.TIMEOUT;
      default:
        return ERROR_CODES.SERVER_ERROR;
    }
  }

  // Utility method to build endpoint URLs
  protected buildEndpoint(template: string, params: Record<string, string | number>): string {
    let endpoint = template;
    Object.entries(params).forEach(([key, value]) => {
      endpoint = endpoint.replace(`:${key}`, String(value));
    });
    return endpoint;
  }

  // Get current API base URL
  public getBaseUrl(): string {
    return getApiBaseUrl();
  }
}

// Export singleton instance for direct use
export const apiService = new BaseApiService('');

// Export utility functions
export { getApiBaseUrl };
export default BaseApiService;
