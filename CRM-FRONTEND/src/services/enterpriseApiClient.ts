import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

interface AugmentedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: { startTime: number };
}

// Smart API URL selection function
function getApiBaseUrl(): string {
  const hostname = window.location.hostname;
    const staticIP = import.meta.env.VITE_STATIC_IP || '103.14.234.36';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const isStaticIP = hostname === staticIP;
  const isDomain = hostname === 'crm.allcheckservices.com' || hostname === 'www.crm.allcheckservices.com';

  console.warn('🌐 Enterprise API Client - URL Detection:', {
    hostname,
    isLocalhost,
    isLocalNetwork,
    isStaticIP,
    isDomain
  });

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    const url = 'http://localhost:3000';
    console.warn('🏠 Enterprise API Client - Using localhost URL:', url);
    return url;
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    const url = `http://${staticIP}:3000`;
    console.warn('🏠 Enterprise API Client - Using local network URL (hairpin NAT workaround):', url);
    return url;
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    const url = 'https://crm.allcheckservices.com';
    console.warn('🌐 Enterprise API Client - Using domain URL:', url);
    return url;
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    const url = `http://${staticIP}:3000`;
    console.warn('🌍 Enterprise API Client - Using static IP URL:', url);
    return url;
  }

  // 5. Fallback to environment variable or localhost
  const fallbackUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000';
  console.warn('🔄 Enterprise API Client - Using fallback URL:', fallbackUrl);
  return fallbackUrl;
}

const API_BASE_URL = getApiBaseUrl();
console.warn('🏢 Enterprise API Client - Using base URL:', API_BASE_URL);

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

class EnterpriseApiClient {
  private client: AxiosInstance;
  private cache: Map<string, CacheEntry> = new Map();
  private requestMetrics: RequestMetrics[] = [];
  private maxCacheSize = 1000;
  private defaultTTL = 300000; // 5 minutes
  private maxMetricsSize = 1000;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // Increased timeout for enterprise operations
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '2.0.0',
        'X-Client-Type': 'enterprise-web',
      },
    });

    this.setupInterceptors();
    this.startCacheCleanup();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig<unknown>) => {
        // Add auth token
        const token = localStorage.getItem('crm_auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request timestamp for metrics
        (config as AugmentedAxiosRequestConfig).metadata = { startTime: Date.now() };

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
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.recordMetrics(response);
        return response;
      },
      async (error) => {
        this.recordMetrics(error.response, true);

        // Handle 401 unauthorized
        if (error.response?.status === 401) {
          localStorage.removeItem('crm_auth_token');
          localStorage.removeItem('crm_refresh_token');
          localStorage.removeItem('crm_user_data');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Handle 429 rate limiting with exponential backoff
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
          
          await this.delay(delay);
          return this.client.request(error.config);
        }

        return Promise.reject(error);
      }
    );
  }

  private recordMetrics(response: AxiosResponse | undefined, _isError = false): void {
    if (!response || !(response.config as AugmentedAxiosRequestConfig)?.metadata) {return;}

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

    // Log slow requests in development
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`Slow API request: ${metric.method} ${metric.url} took ${duration}ms`);
    }
  }

  private getCacheKey(config: AxiosRequestConfig): string {
    const { method, url, params, data } = config;
    return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
  }

  private isResponseCacheable(response: AxiosResponse): boolean {
    const { method, url } = response.config;
    
    // Only cache GET requests
    if (method !== 'get') {return false;}
    
    // Don't cache error responses
    if (response.status >= 400) {return false;}
    
    // Don't cache real-time endpoints
    const realtimeEndpoints = ['/notifications', '/live-updates', '/websocket'];
    return !realtimeEndpoints.some(endpoint => url?.includes(endpoint));
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    const { cacheTTL = this.defaultTTL, useCache = true, retryConfig, ...axiosConfig } = config || {};
    
    if (useCache) {
      const cacheKey = this.getCacheKey({ method: 'get', url, ...axiosConfig });
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        // Return cached response
        return {
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: { 'x-cache': 'HIT' },
          config: axiosConfig,
        } as AxiosResponse<T>;
      }
    }

    const response = await this.executeWithRetry(
      () => this.client.get<T>(url, axiosConfig),
      retryConfig
    );

    // Cache successful responses
    if (useCache && this.isResponseCacheable(response)) {
      const cacheKey = this.getCacheKey({ method: 'get', url, ...axiosConfig });
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
        ttl: cacheTTL,
        etag: response.headers.etag,
      });
    }

    return response;
  }

  // Enhanced POST with retry logic
  async post<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    
    return this.executeWithRetry(
      () => this.client.post<T>(url, data, axiosConfig),
      retryConfig
    );
  }

  // Enhanced PUT with retry logic
  async put<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    
    return this.executeWithRetry(
      () => this.client.put<T>(url, data, axiosConfig),
      retryConfig
    );
  }

  // Enhanced DELETE with retry logic
  async delete<T = unknown>(
    url: string, 
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    
    return this.executeWithRetry(
      () => this.client.delete<T>(url, axiosConfig),
      retryConfig
    );
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
        const err = error as import('@/types/api').ApiErrorResponse;
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

  // Performance metrics
  getMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    slowRequestsCount: number;
  } {
    if (this.requestMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        slowRequestsCount: 0,
      };
    }

    const totalRequests = this.requestMetrics.length;
    const averageResponseTime = this.requestMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    const cacheHits = this.requestMetrics.filter(m => m.cached).length;
    const errors = this.requestMetrics.filter(m => m.status >= 400).length;
    const slowRequests = this.requestMetrics.filter(m => m.duration > 1000).length;

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
