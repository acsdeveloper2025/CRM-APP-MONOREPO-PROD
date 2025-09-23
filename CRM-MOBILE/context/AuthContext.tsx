import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User } from '../types';
import AsyncStorage from '../polyfills/AsyncStorage';
import AuthStorageService from '../services/authStorageService';
import TokenRefreshService from '../services/tokenRefreshService';
import NetworkService from '../services/networkService';

interface AuthStatus {
  daysUntilExpiry: number;
  lastLoginDate?: string;
  needsAction: boolean;
  actionRequired?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  authStatus: AuthStatus | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshTokens: () => Promise<{ success: boolean; error?: string }>;
  checkAuthStatus: () => Promise<void>;
  updateUserProfile: (updates: Partial<Pick<User, 'profilePhotoUrl'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  // Initialize persistent authentication on app startup
  useEffect(() => {
    initializeAuth();
    setupEventListeners();
    startBackgroundServices();

    return () => {
      cleanupEventListeners();
    };
  }, []);

  /**
   * Initialize authentication system on app startup
   */
  const initializeAuth = async () => {
    console.log('🚀 Initializing persistent authentication system...');

    try {
      // Validate authentication on startup with token refresh if needed
      const startupResult = await TokenRefreshService.validateOnStartup();

      if (startupResult.isValid && startupResult.user) {
        // User is authenticated with valid tokens
        setUser(startupResult.user);
        setIsAuthenticated(true);
        console.log('✅ Authentication restored:', startupResult.message);

        // Update auth status
        await updateAuthStatus();
      } else {
        // User needs to log in
        console.log('🔐 Authentication required:', startupResult.message);
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Authentication initialization failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Setup event listeners for re-authentication and network changes
   */
  const setupEventListeners = () => {
    // Listen for re-authentication required events
    window.addEventListener('authReauthRequired', handleReauthRequired);

    // Listen for network state changes
    NetworkService.addNetworkListener(handleNetworkChange);

    // Listen for app visibility changes (foreground/background)
    document.addEventListener('visibilitychange', handleVisibilityChange);
  };

  /**
   * Cleanup event listeners
   */
  const cleanupEventListeners = () => {
    window.removeEventListener('authReauthRequired', handleReauthRequired);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  /**
   * Start background services
   */
  const startBackgroundServices = () => {
    // Start background token validation
    TokenRefreshService.startBackgroundValidation();

    // Start network monitoring
    NetworkService.startPeriodicConnectivityCheck();
  };

  /**
   * Handle re-authentication required event
   */
  const handleReauthRequired = (event: any) => {
    console.log('🔐 Re-authentication required:', event.detail?.reason);
    setIsAuthenticated(false);
    setUser(null);
    // Could show a modal or notification here
  };

  /**
   * Handle network state changes
   */
  const handleNetworkChange = (networkState: any) => {
    console.log('🌐 Network state changed:', networkState);
    if (networkState.isOnline && isAuthenticated) {
      // When coming back online, check if tokens need refresh
      setTimeout(() => {
        checkAuthStatus();
      }, 2000);
    }
  };

  /**
   * Handle app visibility changes
   */
  const handleVisibilityChange = () => {
    if (!document.hidden && isAuthenticated) {
      // App came to foreground, check auth status
      NetworkService.handleAppForeground();
      setTimeout(() => {
        checkAuthStatus();
      }, 1000);
    }
  };

  /**
   * Update authentication status information
   */
  const updateAuthStatus = async () => {
    try {
      const status = await AuthStorageService.getAuthStatus();
      setAuthStatus({
        daysUntilExpiry: status.daysUntilExpiry,
        lastLoginDate: status.lastLoginDate,
        needsAction: status.needsAction,
        actionRequired: status.actionRequired,
      });
    } catch (error) {
      console.error('❌ Failed to update auth status:', error);
    }
  };

  /**
   * Check current authentication status and refresh if needed
   */
  const checkAuthStatus = async () => {
    try {
      const result = await TokenRefreshService.checkAndRefreshIfNeeded();

      if (result.validationResult.needsReauth) {
        setIsAuthenticated(false);
        setUser(null);
        setAuthStatus(null);
      } else {
        await updateAuthStatus();
      }
    } catch (error) {
      console.error('❌ Auth status check failed:', error);
    }
  };

  /**
   * Manual token refresh
   */
  const refreshTokens = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await TokenRefreshService.refreshTokens();

      if (result.success) {
        await updateAuthStatus();
        return { success: true };
      } else {
        if (result.requiresReauth) {
          setIsAuthenticated(false);
          setUser(null);
          setAuthStatus(null);
        }
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Manual token refresh failed:', error);
      return { success: false, error: 'Token refresh failed' };
    }
  };

  /**
   * Test network connectivity to the API server
   */
  const testNetworkConnectivity = async (): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('🌐 Testing network connectivity...');
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL_STATIC_IP;

      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Network connectivity test successful:', data);
        return { success: true, message: 'Network connectivity OK' };
      } else {
        console.error('❌ Network connectivity test failed:', response.status, response.statusText);
        return { success: false, message: `Network error: ${response.status} ${response.statusText}` };
      }
    } catch (error) {
      console.error('❌ Network connectivity test error:', error);
      return { success: false, message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  };

  /**
   * Enhanced debugging function to test the exact login request
   */
  const debugLoginRequest = async (username: string, password: string) => {
    console.log('🔍 DEBUG: Testing exact login request...');

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
    const headers = {
      'Content-Type': 'application/json',
      'X-App-Version': '4.0.0',
      'X-Platform': 'ANDROID',
      'X-Client-Type': 'mobile',
      'X-Device-ID': 'mobile-app-device',
      'User-Agent': navigator.userAgent || 'CaseFlow-Mobile/4.0.0'
    };

    const requestBody = {
      username,
      password,
      deviceId: 'mobile-app-device',
    };

    console.log('🔍 DEBUG Request Details:', {
      url: `${API_BASE_URL}/mobile/auth/login`,
      headers,
      body: { ...requestBody, password: '***' },
      userAgent: navigator.userAgent,
      platform: 'ANDROID',
      environment: {
        NODE_ENV: import.meta.env.NODE_ENV,
        VITE_API_BASE_URL_STATIC_IP: import.meta.env.VITE_API_BASE_URL_STATIC_IP,
      }
    });

    try {
      const response = await fetch(`${API_BASE_URL}/mobile/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
        redirect: 'follow',
      });

      console.log('🔍 DEBUG Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        ok: response.ok,
        type: response.type,
        url: response.url,
      });

      const responseText = await response.text();
      console.log('🔍 DEBUG Response Body (raw):', responseText);

      try {
        const responseData = JSON.parse(responseText);
        console.log('🔍 DEBUG Response Body (parsed):', responseData);
        return { success: response.ok && responseData.success, data: responseData, response };
      } catch (parseError) {
        console.error('🔍 DEBUG Parse Error:', parseError);
        return { success: false, error: 'Failed to parse response', rawResponse: responseText, response };
      }
    } catch (fetchError) {
      console.error('🔍 DEBUG Fetch Error:', fetchError);
      return { success: false, error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' };
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('🔐 Starting login process for:', username);

    // Test network connectivity first
    const networkTest = await testNetworkConnectivity();
    if (!networkTest.success) {
      console.error('❌ Network connectivity test failed:', networkTest.message);
      return {
        success: false,
        error: `Network connectivity issue: ${networkTest.message}`
      };
    }

    // Run debug test to see exactly what's happening
    console.log('🔍 Running debug login test...');
    const debugResult = await debugLoginRequest(username, password);
    console.log('🔍 Debug result:', debugResult);

    setIsLoading(true);

    try {
      // Comprehensive validation for required fields
      if (!username.trim()) {
        setIsLoading(false);
        return { success: false, error: 'Username is required' };
      }

      if (!password.trim()) {
        setIsLoading(false);
        return { success: false, error: 'Password is required' };
      }

      // Additional validation rules
      if (username.length < 3) {
        setIsLoading(false);
        return { success: false, error: 'Username must be at least 3 characters long' };
      }

      if (password.length < 4) {
        setIsLoading(false);
        return { success: false, error: 'Password must be at least 4 characters long' };
      }

      // Make real API call to backend
      // Mobile app uses static IP exclusively - no fallbacks
      const getApiBaseUrl = () => {
        console.log('🔍 Mobile App AuthContext - Static IP Only Configuration');

        // Mobile app uses static IP exclusively
        if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
          const url = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
          console.log('🌍 AuthContext using Static IP API URL:', url);
          return url;
        }

        // If static IP not configured, throw error
        console.error('❌ Static IP not configured for mobile app');
        throw new Error('VITE_API_BASE_URL_STATIC_IP must be configured for mobile app');
      };

      const API_BASE_URL = getApiBaseUrl();
      const deviceId = 'mobile-app-device'; // For mobile app

      // Get platform information
      const getPlatform = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
          return 'IOS';
        } else if (userAgent.includes('android')) {
          return 'ANDROID';
        } else {
          return 'WEB';
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '4.0.0',
        'X-Platform': getPlatform(),
        'X-Client-Type': 'mobile',
        'X-Device-ID': deviceId,
        'User-Agent': navigator.userAgent,
      };

      console.log('🌐 Making login request with headers:', headers);
      console.log('🔗 Login URL:', `${API_BASE_URL}/mobile/auth/login`);
      console.log('📱 Platform detected:', getPlatform());
      console.log('🔧 Environment variables:', {
        VITE_API_BASE_URL_STATIC_IP: import.meta.env.VITE_API_BASE_URL_STATIC_IP,
        VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
        NODE_ENV: import.meta.env.NODE_ENV
      });

      const requestBody = {
        username,
        password,
        deviceId,
      };
      console.log('📤 Request body:', requestBody);

      const response = await fetch(`${API_BASE_URL}/mobile/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        // Add WebView-specific configurations
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
        redirect: 'follow',
      });

      console.log('📡 Login response status:', response.status, response.statusText);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('📋 Login response data:', { success: result.success, message: result.message });

      if (!result.success) {
        console.error('❌ Login failed with error:', result);
      }

      if (!response.ok || !result.success) {
        setIsLoading(false);
        return {
          success: false,
          error: result.message || 'Login failed. Please check your credentials.'
        };
      }

      // Extract user and token data from API response
      const { user: apiUser, tokens } = result.data;

      const user: User = {
        id: apiUser.id,
        name: apiUser.name,
        username: apiUser.username,
        email: apiUser.email,
        role: apiUser.role,
        employeeId: apiUser.employeeId,
      };

      // Store authentication data using the new persistent storage service
      await AuthStorageService.storeAuthData({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: apiUser,
        deviceId,
      });

      // Also maintain backward compatibility with old storage for other services
      await AsyncStorage.setItem('auth_token', tokens.accessToken);
      await AsyncStorage.setItem('refresh_token', tokens.refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      setUser(user);
      setIsAuthenticated(true);

      // Update auth status after successful login
      await updateAuthStatus();

      setIsLoading(false);

      console.log('✅ Login successful with 30-day persistent authentication:', user.name);
      return { success: true };
    } catch (error) {
      console.error('❌ Login error:', error);
      setIsLoading(false);

      if (error instanceof Error) {
        // Handle specific WebView/Capacitor network errors
        let errorMessage = error.message;

        if (error.message.includes('fetch')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
          errorMessage = 'SSL certificate error. Please check your device date/time settings.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'Cross-origin request blocked. Please try again.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timeout. Please check your internet connection and try again.';
        } else if (error.message.includes('NetworkError')) {
          errorMessage = 'Network error. Please check your internet connection.';
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  };

  const logout = async () => {
    console.log('🚪 Logging out and clearing persistent authentication...');

    try {
      // Clear persistent authentication storage
      await AuthStorageService.clearAuthData();

      // Clear legacy storage for backward compatibility
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user');

      // Reset state
      setUser(null);
      setIsAuthenticated(false);
      setAuthStatus(null);

      console.log('✅ Logout completed successfully');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Still reset state even if storage clearing fails
      setUser(null);
      setIsAuthenticated(false);
      setAuthStatus(null);
    }
  };

  const updateUserProfile = async (updates: Partial<Pick<User, 'profilePhotoUrl'>>) => {
    if (user) {
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      isLoading,
      authStatus,
      login,
      logout,
      refreshTokens,
      checkAuthStatus,
      updateUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
