import { apiService } from './api';
import { STORAGE_KEYS, SYNC_KEYS } from '@/types/constants';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';
import { logger } from '@/utils/logger';
import { validateResponse } from './schemas/runtime';
import { UserSchema } from './schemas/user.schema';

export class AuthService {
  private async ensureAccessToken(): Promise<void> {
    if (apiService.getAccessToken()) {
      return;
    }

    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      return;
    }

    const refreshResponse = await apiService.post<{ accessToken?: string; tokens?: { accessToken?: string } }>(
      '/auth/refresh-token',
      { refreshToken }
    );
    const accessToken =
      refreshResponse.data?.accessToken || refreshResponse.data?.tokens?.accessToken;

    if (!accessToken) {
      throw new Error('Failed to restore access token');
    }

    apiService.setAccessToken(accessToken);
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse['data']>('/auth/login', credentials);

    if (response.success && response.data) {
      // Store token in memory and refresh token/user in localStorage
      apiService.setAccessToken(response.data.tokens.accessToken);
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
    } catch (_error) {
      // Continue with logout even if API call fails
    } finally {
      // Notify other tabs
      localStorage.setItem(SYNC_KEYS.FORCE_LOGOUT, Date.now().toString());

      // Clear storage and memory
      apiService.setAccessToken(null);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (_error) {
        return null;
      }
    }

    return null;
  }

  getToken(): string | null {
    return apiService.getAccessToken();
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  async refreshUserData(): Promise<User | null> {
    try {
      await this.ensureAccessToken();
      const response = await apiService.get<User>('/auth/me');

      if (response.success && response.data) {
        // Validate the response shape against our zod schema. In
        // non-strict mode a shape mismatch logs a warning and lets the
        // raw data through so a new backend field never breaks login —
        // but drift is loud in the browser console and any log sink.
        validateResponse(UserSchema, response.data, {
          service: 'auth',
          endpoint: 'GET /auth/me',
        });
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data));
        return response.data;
      }
      return null;
    } catch (error) {
      logger.error('Failed to refresh user data:', error);
      return null;
    }
  }

  async resetRateLimit(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post<{ success: boolean; message: string }>('/auth/reset-rate-limit');
      return {
        success: response.success,
        message: response.message || (response.success ? 'Rate limit reset successfully' : 'Failed to reset rate limit'),
      };
    } catch (error) {
      logger.error('Failed to reset rate limit:', error);
      return {
        success: false,
        message: 'Network error occurred while resetting rate limit',
      };
    }
  }

  async resetUserRateLimit(userId: string, ip?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post<{ success: boolean; message: string }>(`/auth/reset-user-rate-limit/${userId}`, { ip });
      return {
        success: response.success,
        message: response.message || (response.success ? 'User rate limit reset successfully' : 'Failed to reset user rate limit'),
      };
    } catch (error) {
      logger.error('Failed to reset user rate limit:', error);
      return {
        success: false,
        message: 'Network error occurred while resetting user rate limit',
      };
    }
  }
}

export const authService = new AuthService();
