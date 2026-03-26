import { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { apiService } from './api';
import { logger } from '@/utils/logger';

// Re-export types if needed, or import from api types
interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition: (error: unknown) => boolean;
}

class EnterpriseApiClient {
  // Delegate to apiService
  
  constructor() {
    logger.warn('🏢 Enterprise API Client - Initialized (Delegating to Core API Service)');
  }

  // Enhanced GET with caching
  async get<T = unknown>(
    url: string, 
    config?: AxiosRequestConfig & { 
      cacheTTL?: number; 
      useCache?: boolean;
      retryConfig?: RetryConfig;
    }
  ): Promise<AxiosResponse<T>> {
    return apiService.getRaw<T>(url, undefined, config);
  }

  // Enhanced POST with retry logic
  async post<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    return apiService.postRaw<T>(url, data, config);
  }

  // Enhanced PUT with retry logic
  async put<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    return apiService.putRaw<T>(url, data, config);
  }

  // Enhanced DELETE with retry logic
  async delete<T = unknown>(
    url: string, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    return apiService.deleteRaw<T>(url, config);
  }

  // Batch requests for efficiency
  async batch<T = unknown>(requests: Array<{
    method: 'get' | 'post' | 'put' | 'delete';
    url: string;
    data?: unknown;
    config?: AxiosRequestConfig;
  }>): Promise<AxiosResponse<T>[]> {
    const promises = requests.map(req => {
      switch (req.method) {
        case 'get':
          return this.get<T>(req.url, req.config);
        case 'post':
          return this.post<T>(req.url, req.data, req.config);
        case 'put':
          return this.put<T>(req.url, req.data, req.config);
        case 'delete':
          return this.delete<T>(req.url, req.config);
        default:
          throw new Error(`Unsupported method: ${req.method}`);
      }
    });

    return Promise.all(promises);
  }

  // Cache management
  invalidateCache(pattern?: string): void {
    apiService.invalidateCache(pattern);
  }

  // Performance metrics
  getMetrics() {
    const metrics = apiService.getMetrics();
    
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        slowRequestsCount: 0,
      };
    }

    const totalRequests = metrics.length;
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    const cacheHits = metrics.filter(m => m.cached).length;
    const errors = metrics.filter(m => m.status >= 400).length;
    const slowRequests = metrics.filter(m => m.duration > 1000).length;

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      cacheHitRate: Math.round((cacheHits / totalRequests) * 100),
      errorRate: Math.round((errors / totalRequests) * 100),
      slowRequestsCount: slowRequests,
    };
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    timestamp: number;
  }> {
    const start = Date.now();
    
    try {
      await this.get('/health', { useCache: false, timeout: 5000 });
      const latency = Date.now() - start;
      
      return {
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency,
        timestamp: Date.now(),
      };
    } catch (_error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        timestamp: Date.now(),
      };
    }
  }
}

// Create singleton instance
export const apiClient = new EnterpriseApiClient();
export default apiClient;
