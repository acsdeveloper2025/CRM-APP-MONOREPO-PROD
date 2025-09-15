/**
 * Centralized API Service for Mobile App
 * Handles all API requests with consistent headers including version information
 */

import { getEnvironmentConfig } from '../config/environment';
import AuthStorageService from './authStorageService';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  requireAuth?: boolean;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    details?: any;
    timestamp: string;
  };
}

class ApiService {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor() {
    this.baseUrl = this.getApiBaseUrl();
  }

  /**
   * Get API base URL based on environment and network context
   */
  private getApiBaseUrl(): string {
    // Check if running on physical device vs simulator/web
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    console.log('🔍 API URL Detection:', {
      hostname,
      isLocalhost,
      MODE: import.meta.env.MODE,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_BASE_URL_DEVICE: import.meta.env.VITE_API_BASE_URL_DEVICE,
      VITE_API_BASE_URL_PRODUCTION: import.meta.env.VITE_API_BASE_URL_PRODUCTION
    });

    // Priority order for API URL selection:
    // 1. Production URL if in production mode
    if (import.meta.env.MODE === 'production' && import.meta.env.VITE_API_BASE_URL_PRODUCTION) {
      const url = import.meta.env.VITE_API_BASE_URL_PRODUCTION;
      console.log('🚀 Using production API URL:', url);
      return url;
    }

    // 2. Use network URL if not on localhost (physical device or network access)
    if (!isLocalhost && import.meta.env.VITE_API_BASE_URL_DEVICE) {
      const url = import.meta.env.VITE_API_BASE_URL_DEVICE;
      console.log('📱 Using device API URL:', url);
      return url;
    }

    // 3. Use localhost URL for local development
    const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    console.log('🏠 Using localhost API URL:', url);
    return url;
  }

  /**
   * Get platform identifier
   */
  private getPlatform(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'IOS';
    } else if (userAgent.includes('android')) {
      return 'ANDROID';
    } else {
      return 'WEB';
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo() {
    return {
      platform: this.getPlatform(),
      userAgent: navigator.userAgent,
      deviceId: 'mobile-app-device', // In a real app, this would be unique per device
    };
  }

  /**
   * Get standard headers for all requests
   */
  private async getStandardHeaders(includeAuth: boolean = true): Promise<Record<string, string>> {
    const envConfig = getEnvironmentConfig();
    const deviceInfo = this.getDeviceInfo();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Version': envConfig.app.version,
      'X-Platform': deviceInfo.platform,
      'X-Client-Type': 'mobile',
      'X-Device-ID': deviceInfo.deviceId,
      'User-Agent': deviceInfo.userAgent,
    };

    // Add authentication header if required
    if (includeAuth) {
      try {
        const authData = await AuthStorageService.getAuthData();
        if (authData?.accessToken) {
          headers['Authorization'] = `Bearer ${authData.accessToken}`;
        }
      } catch (error) {
        console.warn('Failed to get auth token for API request:', error);
      }
    }

    return headers;
  }

  /**
   * Make an API request with standard headers and error handling
   */
  async request<T = any>(
    endpoint: string, 
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers: customHeaders = {},
      body,
      requireAuth = true,
      timeout = this.defaultTimeout,
    } = options;

    try {
      // Get standard headers
      const standardHeaders = await this.getStandardHeaders(requireAuth);
      
      // Merge headers
      const headers = {
        ...standardHeaders,
        ...customHeaders,
      };

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers,
      };

      // Add body for non-GET requests
      if (body && method !== 'GET') {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      requestOptions.signal = controller.signal;

      // Make the request
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`🌐 API Request: ${method} ${url}`);
      
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Parse response
      let responseData: any;
      try {
        responseData = await response.json();
      } catch (parseError) {
        responseData = { success: false, message: 'Invalid JSON response' };
      }

      // Handle HTTP errors
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`, responseData);
        
        // Handle specific error codes
        if (response.status === 401) {
          // Token expired or invalid - trigger re-authentication
          await AuthStorageService.clearAuthData();
          // You might want to emit an event here to trigger login
        }

        return {
          success: false,
          message: responseData.message || `HTTP ${response.status}: ${response.statusText}`,
          error: {
            code: responseData.error?.code || 'HTTP_ERROR',
            details: responseData,
            timestamp: new Date().toISOString(),
          },
        };
      }

      console.log(`✅ API Success: ${method} ${url}`);
      return responseData;

    } catch (error) {
      console.error(`❌ API Request Failed: ${method} ${endpoint}`, error);
      
      // Handle different types of errors
      let errorMessage = 'Network request failed';
      let errorCode = 'NETWORK_ERROR';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout';
          errorCode = 'TIMEOUT';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        message: errorMessage,
        error: {
          code: errorCode,
          details: error,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  async get<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async patch<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  async delete<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const response = await this.get('/health', { requireAuth: false, timeout: 10000 });
      const responseTime = Date.now() - startTime;
      
      return {
        success: response.success,
        message: response.success ? 'API connection successful' : 'API connection failed',
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        message: `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get current API configuration
   */
  getConfig() {
    const envConfig = getEnvironmentConfig();
    return {
      baseUrl: this.baseUrl,
      version: envConfig.app.version,
      platform: this.getPlatform(),
      environment: envConfig.app.environment,
    };
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
