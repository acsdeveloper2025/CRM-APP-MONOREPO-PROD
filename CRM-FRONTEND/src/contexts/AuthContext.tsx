import React, { useCallback, useEffect, useState } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';
import { authService } from '@/services/auth';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/types/constants';
import { AuthContext, AuthContextType } from './AuthContextObject';
import { AUTH_LOGOUT_EVENT } from '@/utils/events';
import { frontendSocketService } from '@/services/socket';
import { useQueryClient } from '@tanstack/react-query';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const normalizeUserPermissions = useCallback(<T extends { permissions?: unknown; permissionCodes?: string[] }>(
    user: T | null
  ): T | null => {
    if (!user) {return null;}
    if (Array.isArray(user.permissions)) {return user;}
    if (Array.isArray(user.permissionCodes)) {
      return { ...user, permissions: user.permissionCodes } as T;
    }
    return { ...user, permissions: [] } as T;
  }, []);

  const refreshUserPermissions = useCallback(async (): Promise<void> => {
    try {
      const updated = await authService.refreshUserData();

      if (!updated) {
        await authService.logout();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      const normalizedUpdated = normalizeUserPermissions(updated);
      setState(prev => ({
        ...prev,
        user: normalizedUpdated,
        token: authService.getToken(),
        isAuthenticated: true,
        isLoading: false,
      }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['reports-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['verification-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['cases'] }),
      ]);

      void queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'active' });
    } catch (error) {
      console.error('Permission refresh failed:', error);
    }
  }, [normalizeUserPermissions, queryClient]);

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
                user: normalizeUserPermissions(refreshedUser),
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
  }, [normalizeUserPermissions]);

  useEffect(() => {
    if (!state.isAuthenticated || !state.token) {
      frontendSocketService.disconnect();
      return;
    }

    const socket = frontendSocketService.connect(state.token);
    const unsubscribe =
      frontendSocketService.onPermissionsUpdated(async () => {
        await refreshUserPermissions();
      }) || undefined;

    socket.on('connect_error', (error) => {
      console.warn('Socket connect error:', error.message);
    });

    return () => {
      if (unsubscribe) {unsubscribe();}
      socket.off('connect_error');
      frontendSocketService.disconnect();
    };
  }, [state.isAuthenticated, state.token, refreshUserPermissions]);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await authService.login(credentials);
      
      if (response.success && response.data) {
        // Refresh user data to get latest permissions
        const refreshedUser = await authService.refreshUserData();

        setState({
          user: normalizeUserPermissions(refreshedUser || response.data.user),
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
    refreshUserPermissions,
    hasRole,
    hasAnyRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
