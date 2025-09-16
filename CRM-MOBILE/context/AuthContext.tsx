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

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
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
      // Smart API URL selection - same logic as apiService
      const getApiBaseUrl = () => {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
        const isStaticIP = hostname === 'PUBLIC_STATIC_IP';
        const isDomain = hostname === 'example.com' || hostname === 'www.example.com';

        console.log('🔍 AuthContext API URL Detection:', {
          hostname,
          isLocalhost,
          isLocalNetwork,
          isStaticIP,
          isDomain,
          VITE_API_BASE_URL_STATIC_IP: import.meta.env.VITE_API_BASE_URL_STATIC_IP,
          VITE_API_BASE_URL_DEVICE: import.meta.env.VITE_API_BASE_URL_DEVICE,
          VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
        });

        // Priority order for API URL selection:
        // 1. Use localhost for local development
        if (isLocalhost) {
          const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
          console.log('🏠 AuthContext using localhost API URL:', url);
          return url;
        }

        // 2. Use local network IP for local network access (hairpin NAT workaround)
        if (isLocalNetwork && import.meta.env.VITE_API_BASE_URL_DEVICE) {
          const url = import.meta.env.VITE_API_BASE_URL_DEVICE;
          console.log('🏠 AuthContext using local network API URL (hairpin NAT workaround):', url);
          return url;
        }

        // 3. Check if we're on the domain name (production access)
        if (isDomain) {
          const url = 'https://example.com/api';
          console.log('🌐 AuthContext using domain API URL:', url);
          return url;
        }

        // 4. Use Static IP URL if available (for internet access)
        if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
          const url = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
          console.log('🌍 AuthContext using Static IP API URL:', url);
          return url;
        }

        // 5. Fallback to localhost
        const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
        console.log('🔄 AuthContext using fallback API URL:', url);
        return url;
      };

      const API_BASE_URL = getApiBaseUrl();
      const deviceId = 'mobile-app-device'; // For mobile app

      const response = await fetch(`${API_BASE_URL}/mobile/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          deviceId,
        }),
      });

      const result = await response.json();

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
