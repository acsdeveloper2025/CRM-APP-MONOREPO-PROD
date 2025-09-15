import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';
import { authService } from '@/services/auth';
import toast from 'react-hot-toast';

interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
        const token = authService.getToken();
        const user = authService.getCurrentUser();

        if (token && user) {
          // Refresh user data to get latest permissions
          try {
            const refreshedUser = await authService.refreshUserData();
            if (refreshedUser) {
              // Token is valid and user data refreshed
              setState({
                user: refreshedUser,
                token,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              // Token is invalid, clear auth data
              await authService.logout();
              setState({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } catch (error) {
            // Network error or token invalid, clear auth data
            console.warn('Token validation failed:', error);
            await authService.logout();
            setState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          // No token or user data
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
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await authService.logout();
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear the state even if logout API fails
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
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
