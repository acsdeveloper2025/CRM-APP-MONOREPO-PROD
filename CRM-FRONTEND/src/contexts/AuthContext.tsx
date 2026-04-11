import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';
import { authService } from '@/services/auth';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/types/constants';
import { AuthContext, AuthContextType } from './AuthContextObject';
import { AUTH_LOGOUT_EVENT } from '@/utils/events';
import { frontendSocketService } from '@/services/socket';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/utils/logger';

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
      logger.error('Permission refresh failed:', error);
    }
  }, [normalizeUserPermissions, queryClient]);

  useEffect(() => {
    // Check if user is already authenticated on app start
    const initializeAuth = async () => {
      try {
        // Phase E5 follow-up: the refresh token is in an HttpOnly
        // cookie and is not readable from JS. Use the cached user
        // profile as the "maybe logged in" hint — if it exists,
        // attempt a refresh; the cookie either succeeds (user stays
        // logged in) or the backend 401s and we fall through to the
        // logged-out state. The legacy REFRESH_TOKEN key is still
        // checked for one migration cycle so pre-flip users don't
        // get force-logged-out on upgrade.
        const user = authService.getCurrentUser();
        const hasLegacyRefreshToken = !!localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (user || hasLegacyRefreshToken) {
          // We have a session hint. Attempt a refresh; the cookie
          // (or legacy body token) will drive it.
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
            logger.warn('Auto-refresh failed during initialization:', error);
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
        logger.error('Auth initialization error:', error);
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initializeAuth();
  }, [normalizeUserPermissions]);

  const logout = useCallback(async (customMessage?: string): Promise<void> => {
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
      logger.error('Logout error:', error);
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
  }, []);

  // Logout event listener (separate effect — logout must be defined first)
  useEffect(() => {
    // Listen for logout events (e.g. from 401 responses)
    const handleLogoutEvent = (event: Event) => {
      const message = (event as CustomEvent).detail?.message;
      logout(message);
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogoutEvent);

    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogoutEvent);
    };
  }, [logout]);

  useEffect(() => {
    if (!state.isAuthenticated || !state.token) {
      frontendSocketService.disconnect();
      return;
    }

    const socket = frontendSocketService.connect(state.token);
    const unsubscribePermissions =
      frontendSocketService.onPermissionsUpdated(async () => {
        await refreshUserPermissions();
      }) || undefined;
    const unsubscribeNotifications =
      frontendSocketService.onNotification(async (notification) => {
        toast.info(notification.title, {
          description: notification.message,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['notifications'] }),
          queryClient.invalidateQueries({ queryKey: ['notifications-history'] }),
        ]);
      }) || undefined;

    socket.on('connect_error', (error) => {
      logger.warn('Socket connect error:', error.message);
    });

    return () => {
      if (unsubscribePermissions) {unsubscribePermissions();}
      if (unsubscribeNotifications) {unsubscribeNotifications();}
      socket.off('connect_error');
      frontendSocketService.disconnect();
    };
  }, [state.isAuthenticated, state.token, refreshUserPermissions, queryClient]);

  const login = useCallback(async (credentials: LoginRequest): Promise<boolean> => {
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
  }, [normalizeUserPermissions]);

  const value = useMemo<AuthContextType>(
    () => ({ ...state, login, logout, refreshUserPermissions }),
    [state, login, logout, refreshUserPermissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
