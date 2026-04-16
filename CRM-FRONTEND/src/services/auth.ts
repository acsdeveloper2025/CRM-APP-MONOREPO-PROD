import { apiService } from './api';
import { STORAGE_KEYS, SYNC_KEYS } from '@/types/constants';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';
import { logger } from '@/utils/logger';
import { validateResponse } from './schemas/runtime';
import { UserSchema } from './schemas/user.schema';

export class AuthService {
  /**
   * Phase E5 follow-up (item 3): refresh tokens live in an HttpOnly
   * cookie now. `ensureAccessToken` tries the cookie-only refresh
   * path first (the browser sends `crm_refresh_token` automatically
   * because axios is configured with `withCredentials: true` and the
   * cookie's path matches `/api/auth/refresh-token`).
   *
   * Migration fallback: if localStorage still has a legacy refresh
   * token from a pre-flip build, send it in the body so the user
   * doesn't get forced to re-login on first page load after the
   * upgrade. The backend's login response sets the cookie, so on
   * the NEXT refresh the cookie path takes over and we clear the
   * legacy localStorage value immediately to prevent drift.
   */
  private async ensureAccessToken(): Promise<void> {
    if (apiService.getAccessToken()) {
      return;
    }

    // Legacy body payload only survives until the first successful
    // cookie-backed refresh. Reading at call time so a concurrent
    // login flow can't race a stale value.
    const legacyBodyToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    // If no cookie-session hint AND no legacy token, no point trying.
    // The AuthContext has already decided there's no session; bail
    // so we don't issue an unnecessary 401-producing request.
    if (!legacyBodyToken && !localStorage.getItem(STORAGE_KEYS.USER_DATA)) {
      return;
    }

    const body = legacyBodyToken ? { refreshToken: legacyBodyToken } : {};
    const refreshResponse = await apiService.post<{
      accessToken?: string;
      tokens?: { accessToken?: string };
    }>('/auth/refresh-token', body);
    const accessToken =
      refreshResponse.data?.accessToken || refreshResponse.data?.tokens?.accessToken;

    if (!accessToken) {
      throw new Error('Failed to restore access token');
    }

    apiService.setAccessToken(accessToken);

    // Migration cleanup: once we've successfully refreshed, the
    // cookie is in place (the backend set it on every refresh
    // response, see controllers/authController.ts). The legacy
    // localStorage value is no longer needed and leaving it behind
    // is the exact XSS-exfiltration hazard this flip is meant to
    // close.
    if (legacyBodyToken) {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse['data']>('/auth/login', credentials);

    if (response.success && response.data) {
      // Phase E5 follow-up: access token in memory, user profile in
      // localStorage for the "is there a session?" UI hint. The
      // refresh token is deliberately NOT stored in localStorage —
      // the backend set it as an HttpOnly cookie scoped to the
      // refresh-token endpoint, which axios sends automatically.
      apiService.setAccessToken(response.data.tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
      // Clear any legacy refresh token that might still be hanging
      // around from a pre-flip build.
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
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

      // Clear in-memory state + the user profile hint + the legacy
      // refresh token key (no-op on a fresh install). The HttpOnly
      // refresh cookie is cleared by the backend as part of the
      // /auth/logout response.
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
      const response = await apiService.post<{ success: boolean; message: string }>(
        '/auth/reset-rate-limit'
      );
      return {
        success: response.success,
        message:
          response.message ||
          (response.success ? 'Rate limit reset successfully' : 'Failed to reset rate limit'),
      };
    } catch (error) {
      logger.error('Failed to reset rate limit:', error);
      return {
        success: false,
        message: 'Network error occurred while resetting rate limit',
      };
    }
  }

  async resetUserRateLimit(
    userId: string,
    ip?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post<{ success: boolean; message: string }>(
        `/auth/reset-user-rate-limit/${userId}`,
        { ip }
      );
      return {
        success: response.success,
        message:
          response.message ||
          (response.success
            ? 'User rate limit reset successfully'
            : 'Failed to reset user rate limit'),
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
