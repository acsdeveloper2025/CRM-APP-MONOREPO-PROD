import { apiService } from './api';
import { STORAGE_KEYS } from '@/types/constants';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';

interface UuidLoginRequest {
  authUuid: string; // This is the device UUID from mobile app pattern
  deviceId: string; // Same as authUuid for consistency
  platform?: string;
  appVersion?: string;
}

export class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse['data']>('/auth/login', credentials);

    if (response.success && response.data) {
      // Store token and user data
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.tokens.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
    }

    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  }

  async uuidLogin(credentials: UuidLoginRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse['data']>('/auth/uuid-login', credentials);

    if (response.success && response.data) {
      // Store token and user data
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.tokens.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
    }

    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  }

  async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      // Clear local storage
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUser();
    return user ? roles.includes(user.role) : false;
  }

  private getApiBaseUrl(): string {
    const hostname = window.location.hostname;
    const staticIP = import.meta.env.VITE_STATIC_IP || 'PUBLIC_STATIC_IP';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
    const isStaticIP = hostname === staticIP;
    const isDomain = hostname === 'example.com' || hostname === 'www.example.com';

    console.log('🔐 Auth Service - API URL Detection:', {
      hostname,
      isLocalhost,
      isLocalNetwork,
      isStaticIP,
      isDomain
    });

    // Priority order for API URL selection:
    // 1. Check if we're on localhost (development)
    if (isLocalhost) {
      const url = 'http://localhost:3000/api';
      console.log('🏠 Auth Service - Using localhost API URL:', url);
      return url;
    }

    // 2. Check if we're on the local network IP (hairpin NAT workaround)
    if (isLocalNetwork) {
      const url = `http://${staticIP}:3000/api`;
      console.log('🏠 Auth Service - Using local network API URL (hairpin NAT workaround):', url);
      return url;
    }

    // 3. Check if we're on the domain name (production access)
    if (isDomain) {
      const url = 'https://example.com/api';
      console.log('🌐 Auth Service - Using domain API URL:', url);
      return url;
    }

    // 4. Check if we're on the static IP (external access)
    if (isStaticIP) {
      const url = `http://${staticIP}:3000/api`;
      console.log('🌍 Auth Service - Using static IP API URL:', url);
      return url;
    }

    // 5. Fallback to environment variable or localhost
    const fallbackUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    console.log('⚠️ Auth Service - Using fallback API URL:', fallbackUrl);
    return fallbackUrl;
  }

  async refreshUserData(): Promise<User | null> {
    try {
      const token = this.getToken();
      if (!token) return null;

      const apiBaseUrl = this.getApiBaseUrl();
      console.log('🔄 Auth Service - Refreshing user data with URL:', apiBaseUrl);

      const response = await fetch(`${apiBaseUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          localStorage.setItem('authUser', JSON.stringify(result.data));
          return result.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      return null;
    }
  }

  async resetRateLimit(): Promise<{ success: boolean; message: string }> {
    try {
      const apiBaseUrl = this.getApiBaseUrl();
      console.log('🔄 Auth Service - Resetting rate limit with URL:', apiBaseUrl);

      const response = await fetch(`${apiBaseUrl}/auth/reset-rate-limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      return {
        success: result.success,
        message: result.message || (result.success ? 'Rate limit reset successfully' : 'Failed to reset rate limit'),
      };
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      return {
        success: false,
        message: 'Network error occurred while resetting rate limit',
      };
    }
  }

  async resetUserRateLimit(userId: string, ip?: string): Promise<{ success: boolean; message: string }> {
    try {
      const token = this.getToken();
      const apiBaseUrl = this.getApiBaseUrl();
      console.log('🔄 Auth Service - Resetting user rate limit with URL:', apiBaseUrl);

      const response = await fetch(`${apiBaseUrl}/auth/reset-user-rate-limit/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ip }),
      });

      const result = await response.json();
      return {
        success: result.success,
        message: result.message || (result.success ? 'User rate limit reset successfully' : 'Failed to reset user rate limit'),
      };
    } catch (error) {
      console.error('Failed to reset user rate limit:', error);
      return {
        success: false,
        message: 'Network error occurred while resetting user rate limit',
      };
    }
  }
}

export const authService = new AuthService();
