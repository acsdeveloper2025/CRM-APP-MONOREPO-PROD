import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    // Smart URL selection based on environment
    const baseURL = this.getOptimalApiUrl();
    console.log('🔗 API Service initialized with URL:', baseURL);

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
    const isStaticIP = hostname === 'PUBLIC_STATIC_IP';
    const isDomain = hostname === 'example.com' || hostname === 'www.example.com';

    console.log('🌐 Frontend API Service - URL Detection:', {
      hostname,
      isLocalhost,
      isLocalNetwork,
      isStaticIP,
      isDomain,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_BASE_URL_STATIC_IP: import.meta.env.VITE_API_BASE_URL_STATIC_IP,
      VITE_API_BASE_URL_DEVICE: import.meta.env.VITE_API_BASE_URL_DEVICE
    });

    // Priority order for API URL selection:
    // 1. Check if we're on localhost (development)
    if (isLocalhost) {
      const url = 'http://localhost:3000/api';
      console.log('🏠 Frontend API Service - Using localhost API URL:', url);
      return url;
    }

    // 2. Check if we're on the local network IP (hairpin NAT workaround)
    if (isLocalNetwork) {
      const url = 'http://PUBLIC_STATIC_IP:3000/api';
      console.log('🏠 Frontend API Service - Using local network API URL (hairpin NAT workaround):', url);
      return url;
    }

    // 3. Check if we're on the domain name (production access)
    if (isDomain) {
      const url = 'https://example.com/api';
      console.log('🌐 Frontend API Service - Using domain API URL:', url);
      return url;
    }

    // 4. Check if we're on the static IP (external access)
    if (isStaticIP) {
      const url = 'http://PUBLIC_STATIC_IP:3000/api';
      console.log('🌐 Frontend API Service - Using static IP API URL:', url);
      return url;
    }

    // 5. Fallback to environment variable or localhost
    const fallbackUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    console.log('🔄 Frontend API Service - Using fallback API URL:', fallbackUrl);
    return fallbackUrl;
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
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
          localStorage.removeItem('accessToken');
          localStorage.removeItem('authUser');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.api.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    const response = await this.api.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.api.delete<ApiResponse<T>>(url);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.patch<ApiResponse<T>>(url, data);
    return response.data;
  }
}

export const apiService = new ApiService();


