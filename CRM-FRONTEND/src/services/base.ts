/**
 * Base API Service
 *
 * Provides centralized API configuration, URL detection, and common functionality
 * to eliminate code duplication across service files.
 */

import { AxiosRequestConfig, isAxiosError } from 'axios';
import { ApiResponse, PaginatedResponse, ErrorResponse } from '@/types';
import { ERROR_CODES } from '@/types/constants';
import { apiService as coreApiService } from './api';
import { logger } from '@/utils/logger';

// Environment configuration
const getApiBaseUrl = (): string => {
  return coreApiService.getBaseUrl();
};

// Base API service class
export class BaseApiService {
  protected baseEndpoint: string;

  constructor(baseEndpoint: string) {
    this.baseEndpoint = baseEndpoint;
  }

  // Generic GET request
  protected async get<T = unknown>(
    endpoint: string = '',
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      return await coreApiService.get<T>(`${this.baseEndpoint}${endpoint}`, params, config);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic POST request
  protected async post<T = unknown>(
    endpoint: string = '',
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      return await coreApiService.post<T>(`${this.baseEndpoint}${endpoint}`, data, config);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic PUT request
  protected async put<T = unknown>(
    endpoint: string = '',
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      return await coreApiService.put<T>(`${this.baseEndpoint}${endpoint}`, data, config);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic PATCH request
  protected async patch<T = unknown>(
    endpoint: string = '',
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      return await coreApiService.patch<T>(`${this.baseEndpoint}${endpoint}`, data, config);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic DELETE request
  protected async delete<T = unknown>(
    endpoint: string = '',
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      return await coreApiService.delete<T>(`${this.baseEndpoint}${endpoint}`, config);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Paginated GET request
  protected async getPaginated<T = unknown>(
    endpoint: string = '',
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig
  ): Promise<PaginatedResponse<T>> {
    try {
      const response = await coreApiService.get<T>(
        `${this.baseEndpoint}${endpoint}`,
        params,
        config
      );
      // Assuming the response body IS the PaginatedResponse
      // Note: If coreApiService.get returns ApiResponse<T>, we might need casting.
      // But typically for Paginated, the 'T' passed to get should match the expected structure.
      // If PaginatedResponse extends ApiResponse, it's fine.
      return response as unknown as PaginatedResponse<T>;
    } catch (error) {
      return this.handleError(error) as PaginatedResponse<T>;
    }
  }

  // File upload request
  protected async uploadFile<T = unknown>(
    endpoint: string = '',
    file: File,
    additionalData?: Record<string, unknown>,
    onUploadProgress?: (progressEvent: unknown) => void
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }

      return await coreApiService.post<T>(`${this.baseEndpoint}${endpoint}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Bulk operations
  protected async bulkOperation<T = unknown>(
    endpoint: string = '',
    operation: string,
    ids: string[],
    data?: unknown
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
    filters?: Record<string, unknown>
  ): Promise<Blob> {
    try {
      return await coreApiService.getBlob(`${this.baseEndpoint}${endpoint}`, {
        format,
        ...filters,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handling
  private handleError(error: unknown): ErrorResponse {
    logger.error('API Error:', error);

    if (isAxiosError(error)) {
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
      }
    }

    // Other error
    return {
      success: false,
      message: (error as Error).message || 'An unexpected error occurred',
      error: {
        code: ERROR_CODES.SERVER_ERROR,
        details: (error as Error).message,
      },
    };
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

// Export singleton instance for direct use (Wrapper around apiService)
export const apiService = new BaseApiService('');

// Export utility functions
export { getApiBaseUrl };
export default BaseApiService;
