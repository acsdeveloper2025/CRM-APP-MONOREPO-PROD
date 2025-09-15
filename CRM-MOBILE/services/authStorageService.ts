import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Secure Authentication Storage Service
 * Handles persistent storage of authentication tokens and user data
 * with 30-day expiration cycle and offline support
 */

export interface StoredAuthData {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    username: string;
    email?: string;
    role: string;
    employeeId?: string;
  };
  loginTimestamp: number;
  expiresAt: number;
  lastRefreshAt: number;
  deviceId: string;
}

export interface AuthValidationResult {
  isValid: boolean;
  needsRefresh: boolean;
  needsReauth: boolean;
  daysUntilExpiry: number;
  reason?: string;
}

class AuthStorageService {
  private static readonly AUTH_STORAGE_KEY = 'caseflow_auth_data';
  private static readonly TOKEN_EXPIRY_DAYS = 30;
  private static readonly REFRESH_THRESHOLD_DAYS = 7; // Refresh when 7 days left
  private static readonly MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

  /**
   * Store authentication data securely with 30-day expiration
   */
  static async storeAuthData(authData: {
    accessToken: string;
    refreshToken: string;
    user: any;
    deviceId: string;
  }): Promise<void> {
    try {
      const now = Date.now();
      const expiresAt = now + (this.TOKEN_EXPIRY_DAYS * this.MILLISECONDS_PER_DAY);

      const storedData: StoredAuthData = {
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
        user: {
          id: authData.user.id,
          name: authData.user.name,
          username: authData.user.username,
          email: authData.user.email,
          role: authData.user.role,
          employeeId: authData.user.employeeId,
        },
        loginTimestamp: now,
        expiresAt,
        lastRefreshAt: now,
        deviceId: authData.deviceId,
      };

      await AsyncStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify(storedData));
      console.log('✅ Auth data stored successfully', {
        username: authData.user.username,
        expiresAt: new Date(expiresAt).toISOString(),
        daysUntilExpiry: this.TOKEN_EXPIRY_DAYS,
      });
    } catch (error) {
      console.error('❌ Failed to store auth data:', error);
      throw new Error('Failed to store authentication data');
    }
  }

  /**
   * Retrieve stored authentication data
   */
  static async getAuthData(): Promise<StoredAuthData | null> {
    try {
      const storedData = await AsyncStorage.getItem(this.AUTH_STORAGE_KEY);
      if (!storedData) {
        return null;
      }

      const authData: StoredAuthData = JSON.parse(storedData);
      return authData;
    } catch (error) {
      console.error('❌ Failed to retrieve auth data:', error);
      return null;
    }
  }

  /**
   * Validate stored authentication data and determine required actions
   */
  static async validateAuthData(): Promise<AuthValidationResult> {
    try {
      const authData = await this.getAuthData();
      
      if (!authData) {
        return {
          isValid: false,
          needsRefresh: false,
          needsReauth: true,
          daysUntilExpiry: 0,
          reason: 'No stored authentication data found',
        };
      }

      const now = Date.now();
      const timeUntilExpiry = authData.expiresAt - now;
      const daysUntilExpiry = Math.floor(timeUntilExpiry / this.MILLISECONDS_PER_DAY);

      // Check if completely expired (30 days passed)
      if (timeUntilExpiry <= 0) {
        return {
          isValid: false,
          needsRefresh: false,
          needsReauth: true,
          daysUntilExpiry: 0,
          reason: '30-day authentication period has expired',
        };
      }

      // Check if needs refresh (within 7 days of expiry)
      const needsRefresh = daysUntilExpiry <= this.REFRESH_THRESHOLD_DAYS;

      return {
        isValid: true,
        needsRefresh,
        needsReauth: false,
        daysUntilExpiry,
        reason: needsRefresh ? 'Token refresh recommended' : 'Authentication valid',
      };
    } catch (error) {
      console.error('❌ Failed to validate auth data:', error);
      return {
        isValid: false,
        needsRefresh: false,
        needsReauth: true,
        daysUntilExpiry: 0,
        reason: 'Validation error occurred',
      };
    }
  }

  /**
   * Update tokens after successful refresh
   */
  static async updateTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      const authData = await this.getAuthData();
      if (!authData) {
        throw new Error('No existing auth data to update');
      }

      authData.accessToken = accessToken;
      authData.refreshToken = refreshToken;
      authData.lastRefreshAt = Date.now();

      await AsyncStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify(authData));
      console.log('✅ Tokens updated successfully');
    } catch (error) {
      console.error('❌ Failed to update tokens:', error);
      throw new Error('Failed to update authentication tokens');
    }
  }

  /**
   * Clear all stored authentication data
   */
  static async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.AUTH_STORAGE_KEY);
      console.log('✅ Auth data cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear auth data:', error);
      throw new Error('Failed to clear authentication data');
    }
  }

  /**
   * Get current access token if valid
   */
  static async getCurrentAccessToken(): Promise<string | null> {
    try {
      const validation = await this.validateAuthData();
      if (!validation.isValid) {
        return null;
      }

      const authData = await this.getAuthData();
      return authData?.accessToken || null;
    } catch (error) {
      console.error('❌ Failed to get current access token:', error);
      return null;
    }
  }

  /**
   * Get authentication status summary for UI display
   */
  static async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    username?: string;
    daysUntilExpiry: number;
    lastLoginDate?: string;
    needsAction: boolean;
    actionRequired?: string;
  }> {
    try {
      const validation = await this.validateAuthData();
      const authData = await this.getAuthData();

      if (!validation.isValid || !authData) {
        return {
          isAuthenticated: false,
          daysUntilExpiry: 0,
          needsAction: true,
          actionRequired: 'Login required',
        };
      }

      return {
        isAuthenticated: true,
        username: authData.user.username,
        daysUntilExpiry: validation.daysUntilExpiry,
        lastLoginDate: new Date(authData.loginTimestamp).toLocaleDateString(),
        needsAction: validation.needsRefresh || validation.needsReauth,
        actionRequired: validation.needsReauth 
          ? 'Re-authentication required' 
          : validation.needsRefresh 
          ? 'Token refresh recommended' 
          : undefined,
      };
    } catch (error) {
      console.error('❌ Failed to get auth status:', error);
      return {
        isAuthenticated: false,
        daysUntilExpiry: 0,
        needsAction: true,
        actionRequired: 'Authentication error',
      };
    }
  }
}

export default AuthStorageService;
