import axios, { type AxiosInstance, type AxiosResponse, type AxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    // Smart URL selection based on environment
    const baseURL = this.getOptimalApiUrl();
    console.warn('🔗 API Service initialized with URL:', baseURL);

    this.api = axios.create({
      baseURL,
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000, // Increased timeout for territory assignments
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private getOptimalApiUrl(): string {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
    const staticIP = import.meta.env.VITE_STATIC_IP || '103.14.234.36';
    const isStaticIP = hostname === staticIP;
    const isDomain = hostname === 'crm.allcheckservices.com' || hostname === 'www.crm.allcheckservices.com';

    // Log only in development mode
    if (import.meta.env.DEV) {
      console.warn('🌐 Frontend API Service - URL Detection:', {
        hostname,
        isLocalhost,
        isLocalNetwork,
        isStaticIP,
        isDomain
      });
    }

    // Priority order for API URL selection:
    // 1. Check if we're on localhost (development)
    if (isLocalhost) {
      const url = 'http://localhost:3000/api';
      if (import.meta.env.DEV) {console.warn('🏠 Frontend API Service - Using localhost API URL:', url);}
      return url;
    }

    // 2. Check if we're on the local network IP (hairpin NAT workaround)
    if (isLocalNetwork) {
      const url = `http://${staticIP}:3000/api`;
      if (import.meta.env.DEV) {console.warn('🏠 Frontend API Service - Using local network API URL (hairpin NAT workaround):', url);}
      return url;
    }

    // 3. Check if we're on the domain name (production access)
    if (isDomain) {
      const url = 'https://crm.allcheckservices.com/api';
      if (import.meta.env.DEV) {console.warn('🌐 Frontend API Service - Using domain API URL:', url);}
      return url;
    }

    // 4. Check if we're on the static IP (external access)
    if (isStaticIP) {
      const url = `http://${staticIP}:3000/api`;
      if (import.meta.env.DEV) {console.warn('🌐 Frontend API Service - Using static IP API URL:', url);}
      return url;
    }

    // 5. Fallback to environment variable or localhost
    const fallbackUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    if (import.meta.env.DEV) {console.warn('🔄 Frontend API Service - Using fallback API URL:', fallbackUrl);}
    return fallbackUrl;
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('crm_auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('crm_auth_token');
          localStorage.removeItem('crm_refresh_token');
          localStorage.removeItem('crm_user_data');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: unknown): Promise<ApiResponse<T>> {
    const response = await this.api.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: unknown): Promise<ApiResponse<T>> {
    const response = await this.api.post<ApiResponse<T>>(url, data, config as AxiosRequestConfig);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.api.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  async delete<T>(url: string, config?: unknown): Promise<ApiResponse<T>> {
    const response = await this.api.delete<ApiResponse<T>>(url, config as AxiosRequestConfig);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.api.patch<ApiResponse<T>>(url, data);
    return response.data;
  }

  getBaseUrl(): string {
    return this.api.defaults.baseURL || '';
  }
}

export const apiService = new ApiService();


