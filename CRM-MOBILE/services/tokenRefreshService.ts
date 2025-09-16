import AuthStorageService from './authStorageService';

/**
 * Token Refresh Service
 * Handles automatic token refresh and background validation
 */

export interface RefreshResult {
  success: boolean;
  newTokens?: {
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
  requiresReauth?: boolean;
}

class TokenRefreshService {
  private static readonly API_BASE_URL = import.meta.env.VITE_API_BASE_URL_DEVICE || import.meta.env.VITE_API_BASE_URL || 'http://103.14.234.36:3000/api';
  private static refreshInProgress = false;
  private static refreshPromise: Promise<RefreshResult> | null = null;

  /**
   * Attempt to refresh authentication tokens
   */
  static async refreshTokens(): Promise<RefreshResult> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshInProgress && this.refreshPromise) {
      console.log('🔄 Token refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    this.refreshInProgress = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshInProgress = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh API call
   */
  private static async performTokenRefresh(): Promise<RefreshResult> {
    try {
      console.log('🔄 Starting token refresh...');
      
      const authData = await AuthStorageService.getAuthData();
      if (!authData || !authData.refreshToken) {
        return {
          success: false,
          error: 'No refresh token available',
          requiresReauth: true,
        };
      }

      const response = await fetch(`${this.API_BASE_URL}/mobile/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: authData.refreshToken,
          deviceId: authData.deviceId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('❌ Token refresh failed:', result.message);
        
        // If refresh token is invalid, require re-authentication
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: result.message || 'Refresh token expired',
            requiresReauth: true,
          };
        }

        return {
          success: false,
          error: result.message || 'Token refresh failed',
          requiresReauth: false,
        };
      }

      // Update stored tokens
      const newTokens = {
        accessToken: result.data.tokens.accessToken,
        refreshToken: result.data.tokens.refreshToken,
      };

      await AuthStorageService.updateTokens(newTokens.accessToken, newTokens.refreshToken);

      console.log('✅ Token refresh successful');
      return {
        success: true,
        newTokens,
      };
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      
      // Network errors don't require re-auth, just retry later
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during token refresh',
        requiresReauth: false,
      };
    }
  }

  /**
   * Check if tokens need refresh and attempt refresh if online
   */
  static async checkAndRefreshIfNeeded(): Promise<{
    refreshAttempted: boolean;
    refreshResult?: RefreshResult;
    validationResult: any;
  }> {
    try {
      const validation = await AuthStorageService.validateAuthData();
      
      if (validation.needsReauth) {
        console.log('🔐 Re-authentication required');
        return {
          refreshAttempted: false,
          validationResult: validation,
        };
      }

      if (!validation.needsRefresh) {
        console.log('✅ Tokens are still valid, no refresh needed');
        return {
          refreshAttempted: false,
          validationResult: validation,
        };
      }

      // Check if online before attempting refresh
      const isOnline = await this.checkNetworkConnectivity();
      if (!isOnline) {
        console.log('📱 Offline - skipping token refresh');
        return {
          refreshAttempted: false,
          validationResult: validation,
        };
      }

      console.log('🔄 Tokens need refresh and device is online, attempting refresh...');
      const refreshResult = await this.refreshTokens();

      return {
        refreshAttempted: true,
        refreshResult,
        validationResult: validation,
      };
    } catch (error) {
      console.error('❌ Error during token check and refresh:', error);
      return {
        refreshAttempted: false,
        validationResult: {
          isValid: false,
          needsRefresh: false,
          needsReauth: true,
          daysUntilExpiry: 0,
          reason: 'Error during validation',
        },
      };
    }
  }

  /**
   * Simple network connectivity check
   */
  private static async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // Try to reach the health endpoint with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.API_BASE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('📱 Network connectivity check failed:', error);
      return false;
    }
  }

  /**
   * Background token validation - runs periodically when app is active
   */
  static async backgroundTokenValidation(): Promise<void> {
    try {
      console.log('🔍 Running background token validation...');
      
      const result = await this.checkAndRefreshIfNeeded();
      
      if (result.refreshAttempted && result.refreshResult) {
        if (result.refreshResult.success) {
          console.log('✅ Background token refresh successful');
        } else if (result.refreshResult.requiresReauth) {
          console.log('🔐 Background validation detected need for re-authentication');
          // Emit event or trigger re-auth flow
          this.notifyReauthRequired(result.refreshResult.error || 'Authentication expired');
        } else {
          console.log('⚠️ Background token refresh failed, will retry later');
        }
      }
    } catch (error) {
      console.error('❌ Background token validation error:', error);
    }
  }

  /**
   * Notify the app that re-authentication is required
   */
  private static notifyReauthRequired(reason: string): void {
    // Emit custom event that the AuthContext can listen to
    const event = new CustomEvent('authReauthRequired', {
      detail: { reason },
    });
    window.dispatchEvent(event);
  }

  /**
   * Start background token validation with periodic checks
   */
  static startBackgroundValidation(): void {
    // Run initial check after 30 seconds
    setTimeout(() => {
      this.backgroundTokenValidation();
    }, 30000);

    // Then run every 30 minutes
    setInterval(() => {
      this.backgroundTokenValidation();
    }, 30 * 60 * 1000);

    console.log('🔍 Background token validation started');
  }

  /**
   * Manual token validation for app startup or network reconnection
   */
  static async validateOnStartup(): Promise<{
    isValid: boolean;
    needsLogin: boolean;
    user?: any;
    message: string;
  }> {
    try {
      console.log('🚀 Validating authentication on startup...');
      
      const result = await this.checkAndRefreshIfNeeded();
      
      if (result.validationResult.needsReauth) {
        return {
          isValid: false,
          needsLogin: true,
          message: result.validationResult.reason || 'Authentication required',
        };
      }

      if (result.refreshAttempted && result.refreshResult && !result.refreshResult.success) {
        if (result.refreshResult.requiresReauth) {
          return {
            isValid: false,
            needsLogin: true,
            message: result.refreshResult.error || 'Re-authentication required',
          };
        }
        // Refresh failed but tokens might still be valid for offline use
        console.log('⚠️ Token refresh failed but continuing with existing tokens');
      }

      const authData = await AuthStorageService.getAuthData();
      if (!authData) {
        return {
          isValid: false,
          needsLogin: true,
          message: 'No authentication data found',
        };
      }

      return {
        isValid: true,
        needsLogin: false,
        user: authData.user,
        message: `Welcome back, ${authData.user.name}! (${result.validationResult.daysUntilExpiry} days remaining)`,
      };
    } catch (error) {
      console.error('❌ Startup validation error:', error);
      return {
        isValid: false,
        needsLogin: true,
        message: 'Authentication validation failed',
      };
    }
  }
}

export default TokenRefreshService;
