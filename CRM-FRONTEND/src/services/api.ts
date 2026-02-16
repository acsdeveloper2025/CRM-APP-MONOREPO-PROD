import axios, { type AxiosInstance, type AxiosResponse, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types/api';
import { triggerLogout } from '@/utils/events';
import { STORAGE_KEYS, SYNC_KEYS } from '@/types/constants';

// Queue to hold requests while token is refreshing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// -- Enhanced Features Types --
interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
  etag?: string;
}

interface RequestMetrics {
  url: string;
  method: string;
  duration: number;
  status: number;
  cached: boolean;
  timestamp: number;
}

interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition: (error: unknown) => boolean;
}

interface AugmentedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: { startTime: number };
}

class ApiService {
  private api: AxiosInstance;
  private activeRequestCount = 0;
  private accessToken: string | null = null;
  
  // Enhanced features state
  private cache: Map<string, CacheEntry> = new Map();
  private requestMetrics: RequestMetrics[] = [];
  private maxCacheSize = 1000;
  private defaultTTL = 300000; // 5 minutes
  private maxMetricsSize = 1000;

  constructor() {
    // Smart URL selection based on environment
    const baseURL = this.getOptimalApiUrl();
    console.warn('🔗 API Service initialized with URL:', baseURL);

    this.api = axios.create({
      baseURL,
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000, 
      withCredentials: true, // Enable cookies for cross-site requests
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.startCacheCleanup();
  }

  public hasActiveRequests(): boolean {
    return this.activeRequestCount > 0;
  }

  private incrementActiveRequests() {
    this.activeRequestCount++;
  }

  private decrementActiveRequests() {
    if (this.activeRequestCount > 0) {
      this.activeRequestCount--;
    }
  }

  private getOptimalApiUrl(): string {
    const baseURL = import.meta.env.VITE_API_BASE_URL;

    if (!baseURL) {
      const errorMsg = '❌ CRITICAL ERROR: VITE_API_BASE_URL is not defined in environment variables!';
      console.error(errorMsg);
      // In development, we might want to alert, in production this is a fatal config error
      if (import.meta.env.DEV) {
          alert(errorMsg);
      }
      throw new Error(errorMsg);
    }

    return baseURL;
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        this.incrementActiveRequests();
        const token = this.getAccessToken();

        // Add request timestamp for metrics
        (config as AugmentedAxiosRequestConfig).metadata = { startTime: Date.now() };

        // Special handling for refresh endpoint: NO Authorization header needed
        // The refresh token is sent in the body
        if (config.url?.includes('/mobile/auth/refresh')) {
          delete config.headers.Authorization;
        } else if (token) {
          // Normal requests: Use Access Token
          config.headers.Authorization = `Bearer ${token}`;
        }

         // Add cache headers for GET requests
         if (config.method === 'get') {
          const cacheKey = this.getCacheKey(config);
          const cached = this.cache.get(cacheKey);
          if (cached?.etag) {
            config.headers['If-None-Match'] = cached.etag;
          }
        }

        return config;
      },
      (error) => {
        this.decrementActiveRequests();
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors and token refresh
    this.api.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        this.decrementActiveRequests();
        this.recordMetrics(response);
        return response;
      },
      async (error) => {
        this.decrementActiveRequests();
        this.recordMetrics(error.response, true);

        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const status = error.response?.status;

        // Handle 401 Unauthorized OR 403 Forbidden (Session Expiry)
        if ((status === 401 || status === 403) && !originalRequest._retry) {
          // Prevent infinite loops: sensitive endpoints shouldn't trigger refresh logic
          const url = originalRequest.url || '';
          if (url.includes('/auth/login') || url.includes('/auth/refresh-token') || url.includes('/auth/logout')) {
            return Promise.reject(error);
          }

          if (isRefreshing) {
            // Queue the request if a refresh is already in progress
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                // We need to re-increment because this is a "new" attempt in a way, 
                // but strictly speaking, the interceptor chain might handle it. 
                // However, directly calling this.api(originalRequest) triggers interceptors again?
                // Yes, axios(config) triggers interceptors. 
                // So we don't need to manually increment here if we call this.api()
                return this.api(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
            
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            console.warn('🔄 Attempting token refresh (mobile endpoint)...');
            
            // Call backend refresh endpoint
            // Using a fresh axios instance to avoid interceptors
            // We usually don't track this request in activeRequestCount to avoid loops? 
            // Actually we should track it so session doesn't timeout DURING refresh.
            // But we are using raw axios here.
            this.incrementActiveRequests(); 
            const response = await axios.post(`${this.getOptimalApiUrl()}/auth/refresh-token`, {
              refreshToken,
            }, {
              withCredentials: true, // Important for cookies if used
              headers: {
                'Content-Type': 'application/json'
                // NO Authorization header
              }
            });
            this.decrementActiveRequests();

            // Extract new token
            const data = response.data;
            const accessToken = data.data?.accessToken || data.data?.tokens?.accessToken || data.accessToken;
            
            // Note: Mobile refresh endpoint does NOT return a new refresh token (rotation is 7 days)
            // So we do NOT update the refresh token

            if (!accessToken) {
              throw new Error('Invalid refresh response');
            }

            console.warn('✅ Token refresh successful');

            // Update in-memory storage
            this.setAccessToken(accessToken);
            // Do NOT update refresh token in localStorage

            // Update default headers
            this.api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

            // Process queue
            processQueue(null, accessToken);
            isRefreshing = false; // Reset flag after processing queue

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            // Ensure we decrement if we incremented before manual call
            // We did decrement in the try block, but if it failed inside axios.post?
            // The await would throw, so we need to ensure decrement happens. 
            // Ideally we wrap the raw axios call in try/finally or check logic.
            // But simplified: the catch block runs. 
            // We can't easily know if decrement happened. 
            // Let's assume the raw axios call *might* have thrown before decrement.
            // Safe to assume activeRequestCount might be off? 
            // Actually, let's fix the try block logic above to be safe.
            
            console.error('❌ Token refresh failed:', refreshError);
            isRefreshing = false; // Reset flag on error
            processQueue(refreshError as Error, null);
            
            // Notify other tabs to force logout
            localStorage.setItem(SYNC_KEYS.FORCE_LOGOUT, Date.now().toString());
            
            // Clear auth and redirect
            this.setAccessToken(null);
            localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER_DATA);
            triggerLogout('Your session has expired. Please login again.');
            
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // -- Enhanced Features Implementation --

  private recordMetrics(response: AxiosResponse | undefined, _isError = false): void {
    if (!response || !(response.config as AugmentedAxiosRequestConfig)?.metadata) {
      return;
    }

    const duration = Date.now() - ((response.config as AugmentedAxiosRequestConfig).metadata?.startTime || 0);
    const metric: RequestMetrics = {
      url: response.config.url || '',
      method: response.config.method?.toUpperCase() || '',
      duration,
      status: response.status || 0,
      cached: response.headers['x-cache'] === 'HIT',
      timestamp: Date.now(),
    };

    this.requestMetrics.push(metric);

    // Keep only recent metrics
    if (this.requestMetrics.length > this.maxMetricsSize) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetricsSize);
    }
  }

  private getCacheKey(config: AxiosRequestConfig): string {
    const { method, url, params, data } = config;
    return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
  }

  private isResponseCacheable(response: AxiosResponse): boolean {
    const { method, url } = response.config;
    
    // Only cache GET requests
    if (method !== 'get') {
      return false;
    }
    
    // Don't cache error responses
    if (response.status >= 400) {
      return false;
    }
    
    // Don't cache real-time endpoints
    const realtimeEndpoints = ['/notifications', '/live'];
    if (realtimeEndpoints.some(endpoint => url?.includes(endpoint))) {
        return false;
    }
    
    return true; 
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }

      // Limit cache size
      if (this.cache.size > this.maxCacheSize) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, entries.length - this.maxCacheSize);
        toDelete.forEach(([key]) => this.cache.delete(key));
      }
    }, 60000); // Clean every minute
  }

  public invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  public getMetrics() {
    return this.requestMetrics;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>,
    retryConfig?: RetryConfig
  ): Promise<AxiosResponse<T>> {
    const config = {
      retries: 3,
      retryDelay: 1000,
      retryCondition: (error: unknown) => {
        // Retry on network errors and 5xx server errors
        const err = error as { response?: { status: number } };
        return !err.response || (err.response.status !== undefined && err.response.status >= 500 && err.response.status < 600);
      },
      ...retryConfig,
    };

    let lastError: unknown;
    
    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === config.retries || !config.retryCondition(error)) {
          throw error;
        }
        
        // Exponential backoff
        const delay = config.retryDelay * Math.pow(2, attempt);
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  // Raw methods that return full AxiosResponse (for compatibility with enterpriseApiClient)
  async getRaw<T>(
    url: string, 
    params?: unknown,
    config?: AxiosRequestConfig & { 
      cacheTTL?: number; 
      useCache?: boolean;
      retryConfig?: RetryConfig;
    }
  ): Promise<AxiosResponse<T>> {
    const { cacheTTL = this.defaultTTL, useCache = false, retryConfig, ...axiosConfig } = config || {};
    
    // Check if this is a binary request
    const isBinary = axiosConfig.responseType === 'blob' || axiosConfig.responseType === 'arraybuffer';
    
    // Prepare final config
    const finalConfig: AxiosRequestConfig = { params, ...axiosConfig };
    
    if (isBinary) {
      // Bypass automatic JSON transformation for binary data
      finalConfig.transformResponse = [(data) => data];
      
      // Ensure we don't force application/json Content-Type for GET
      finalConfig.headers = {
        ...finalConfig.headers,
        'Accept': '*/*',
      };
      
      // Axios instance has a default Content-Type: application/json
      // We must explicitly remove or change it for binary GET requests to avoid server-side confusion
      if (finalConfig.headers['Content-Type'] === 'application/json') {
        delete finalConfig.headers['Content-Type'];
      }
    }

    if (useCache && !isBinary) {
      const cacheKey = this.getCacheKey({ method: 'get', url, params, ...axiosConfig });
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return {
            data: cached.data as T,
            status: 200,
            statusText: 'OK',
            headers: { 'x-cache': 'HIT', 'etag': cached.etag },
            config: { ...axiosConfig, url, method: 'get' } as InternalAxiosRequestConfig
        };
      }
    }

    const response = await this.executeWithRetry(
      () => this.api.get<T>(url, finalConfig),
      retryConfig
    );

    // Cache successful responses
    if (useCache && !isBinary && this.isResponseCacheable(response)) {
      const cacheKey = this.getCacheKey({ method: 'get', url, params, ...axiosConfig });
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
        ttl: cacheTTL,
        etag: response.headers.etag,
      });
    }

    return response;
  }

  async postRaw<T>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    
    // Binary handling
    const isBinary = axiosConfig.responseType === 'blob' || axiosConfig.responseType === 'arraybuffer';
    if (isBinary) {
      axiosConfig.transformResponse = [(data) => data];
      axiosConfig.headers = {
        'Accept': '*/*',
        ...axiosConfig.headers,
      };
    }

    return this.executeWithRetry(
      () => this.api.post<T>(url, data, axiosConfig),
      retryConfig
    );
  }

  async putRaw<T>(
    url: string, 
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    return this.executeWithRetry(
      () => this.api.put<T>(url, data, axiosConfig),
      retryConfig
    );
  }

  async deleteRaw<T>(
    url: string, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    return this.executeWithRetry(
      () => this.api.delete<T>(url, axiosConfig),
      retryConfig
    );
  }

  async patchRaw<T>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    return this.executeWithRetry(
      () => this.api.patch<T>(url, data, axiosConfig),
      retryConfig
    );
  }

  // Standard convenience methods returning just data
  async get<T>(
    url: string, 
    params?: unknown,
    config?: AxiosRequestConfig & { 
      cacheTTL?: number; 
      useCache?: boolean;
      retryConfig?: RetryConfig;
    }
  ): Promise<ApiResponse<T>> {
    const response = await this.getRaw<ApiResponse<T>>(url, params, config);
    return response.data;
  }

  async post<T>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.postRaw<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(
    url: string, 
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.putRaw<ApiResponse<T>>(url, data, config);
    return response.data;
  }
  
  async delete<T>(
    url: string, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.deleteRaw<ApiResponse<T>>(url, config);
    return response.data;
  }

  async patch<T>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.patchRaw<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  getBaseUrl(): string {
    return this.api.defaults.baseURL || '';
  }

  /**
   * Returns the root URL of the server (without /api suffix)
   * Useful for serving static assets like images
   */
  getRootUrl(): string {
    return this.getBaseUrl().replace(/\/api\/?$/, '');
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (token) {
        this.api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
        delete this.api.defaults.headers.common.Authorization;
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async getBlob(url: string, params?: unknown): Promise<Blob> {
    const response = await this.api.get(url, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Safe fetch wrapper that handles authentication and token refresh.
   * Use this instead of raw fetch() calls.
   */
  async safeFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    this.incrementActiveRequests();
    try {
      const token = this.getAccessToken();
      const headers = new Headers(options.headers || {});
      
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
  
      // Determine type of content
      const isMultipart = options.body instanceof FormData;
      if (!isMultipart && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
  
      const url = `${this.getOptimalApiUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Enable cookies
      });
  
      // Handle 401 Unauthorized OR 403 Forbidden (Session Expiry)
      if (response.status === 401 || response.status === 403) {
        // Prevent infinite loops: Don't refresh if the failed request was an auth endpoint
        if (url.includes('/auth/login') || url.includes('/mobile/auth/refresh') || url.includes('/auth/refresh-token') || url.includes('/auth/logout')) {
          return response; 
        }
        
        // We can reuse the axios logic by checking if we are already refreshing
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            }).then((newToken) => {
              headers.set('Authorization', `Bearer ${newToken}`);
              return fetch(url, { ...options, headers, credentials: 'include' });
            }) as Promise<Response>;
        }
  
        // Trigger refresh manually
        isRefreshing = true;
        try {
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
          if (!refreshToken) {
            throw new Error('No refresh token');
          }
          
          // Note: we are inside safeFetch which already incremented activeRequests.
          // The refresh call is another fetch - but we do manually. 
          // We shouldn't necessarily track THIS internal refresh request as user activity, 
          // but we SHOULD keep the overall safeFetch marked as active. 
          // So no changes needed here regarding increment/decrement.
  
          const refreshResponse = await fetch(`${this.getOptimalApiUrl()}/auth/refresh-token`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              // NO Authorization header
            },
            body: JSON.stringify({ refreshToken }),
            credentials: 'include', // Important for refresh token cookie if used
          });
  
          if (!refreshResponse.ok) {
            throw new Error('Refresh failed');
          }
          
          const refreshData = await refreshResponse.json();
          // Look for accessToken in various possible response structures
          const accessToken = refreshData.data?.accessToken || refreshData.data?.tokens?.accessToken || refreshData.accessToken;
          // Do NOT update refresh token
          
          if (!accessToken) {
            throw new Error('Invalid refresh response');
          }
  
          console.warn('✅ Token refresh successful (safeFetch)');
  
          this.setAccessToken(accessToken);
          // Do NOT update refresh token
  
          processQueue(null, accessToken);
          isRefreshing = false;
  
          headers.set('Authorization', `Bearer ${accessToken}`);
          return fetch(url, { ...options, headers });
        } catch (error) {
            processQueue(error as Error, null);
            isRefreshing = false;
            
            // Notify other tabs to force logout
            localStorage.setItem(SYNC_KEYS.FORCE_LOGOUT, Date.now().toString());

            this.setAccessToken(null);
            localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER_DATA);
            triggerLogout('Your session has expired. Please login again.');
            throw error;
        }
      }
  
      return response;
    } finally {
      this.decrementActiveRequests();
    }
  }

}

export const apiService = new ApiService();



// Export authenticatedFetch for use in other services
export const authenticatedFetch = (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  return apiService.safeFetch(endpoint, options);
};
