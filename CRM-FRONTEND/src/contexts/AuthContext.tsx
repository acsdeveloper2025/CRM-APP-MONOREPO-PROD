import React, { useEffect, useState } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';
import { authService } from '@/services/auth';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/types/constants';
import { AuthContext, AuthContextType } from './AuthContextObject';
import { AUTH_LOGOUT_EVENT } from '@/utils/events';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check if user is already authenticated on app start
    const initializeAuth = async () => {
      try {
        const user = authService.getCurrentUser();
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (user && refreshToken) {
          // We have user data and a refresh token, but access token is in memory (and thus gone on reload)
          // Proactively refresh user data/token
          try {
            const refreshedUser = await authService.refreshUserData();
            if (refreshedUser) {
              setState({
                user: refreshedUser,
                token: authService.getToken(), // This will now get the newly refreshed in-memory token
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              // Refresh failed, likely expired session
              await authService.logout();
              setState({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } catch (error) {
            console.warn('Auto-refresh failed during initialization:', error);
            await authService.logout();
            setState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          // No user data or no refresh token
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initializeAuth();

    // Listen for logout events (e.g. from 401 responses)
    const handleLogoutEvent = (event: Event) => {
      const message = (event as CustomEvent).detail?.message;
      logout(message);
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogoutEvent);

    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogoutEvent);
    };
  }, []);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await authService.login(credentials);
      
      if (response.success && response.data) {
        // Refresh user data to get latest permissions
        const refreshedUser = await authService.refreshUserData();

        setState({
          user: refreshedUser || response.data.user,
          token: response.data.tokens.accessToken,
          isAuthenticated: true,
          isLoading: false,
        });

        toast.success('Login successful!');
        return true;
      } else {
        toast.error(response.message || 'Login failed');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      const message = err.response?.data?.message || 'Login failed';
      toast.error(message);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const logout = async (customMessage?: string): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await authService.logout();
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      toast.success(customMessage || 'Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear the state even if logout API fails
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      if (customMessage) {
        toast.info(customMessage);
      }
    }
  };



  const hasRole = (role: string): boolean => {
    return authService.hasRole(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return authService.hasAnyRole(roles);
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    hasRole,
    hasAnyRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => React.useContext(AuthContext);
