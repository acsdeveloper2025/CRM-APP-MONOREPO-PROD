import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';
import { authService } from '@/services/auth';
import { toast } from 'sonner';
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

  const normalizeUserPermissions = useCallback(
    <T extends { permissions?: unknown; permissionCodes?: string[] }>(user: T | null): T | null => {
      if (!user) {
        return null;
      }
      if (Array.isArray(user.permissions)) {
        return user;
      }
      if (Array.isArray(user.permissionCodes)) {
        return { ...user, permissions: user.permissionCodes } as T;
      }
      return { ...user, permissions: [] } as T;
    },
    []
  );

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
      setState((prev) => ({
        ...prev,
        user: normalizedUpdated,
        token: authService.getToken(),
        isAuthenticated: true,
        isLoading: false,
      }));

      // P6 — full cache clear on permission change
      // (project_scope_control_audit_2026_05_14.md R-3).
      //
      // The previous narrow invalidate of 5 hard-coded keys
      // (dashboard, dashboard-stats, reports-dashboard,
      // verification-tasks, cases) left every other resource tree
      // (users, clients, products, rates, invoices, commissions,
      // KYC, locations, notifications, …) stale for up to gcTime
      // = 30min. After a revocation that bridged into a render of
      // those screens, the user could still see data they no longer
      // had access to.
      //
      // queryClient.clear() drops the entire QueryCache; every
      // mounted query refetches on next render under the refreshed
      // permission set + current active scope.
      queryClient.clear();
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
        // logged-out state.
        const user = authService.getCurrentUser();

        if (user) {
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

  const logout = useCallback(
    async (customMessage?: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        await authService.logout();
        // Wipe React Query cache so the next user (or login session) does not
        // see any cached data from the previous user. Critical when multiple
        // users share a kiosk / browser, or when permissions change between
        // sessions.
        queryClient.clear();
        // Drop persisted active scope so the next user starts at baseline.
        // sessionStorage entry would otherwise survive the same tab.
        sessionStorage.removeItem('acs.activeScope');
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        toast.success(customMessage || 'Logged out successfully');
      } catch (error) {
        logger.error('Logout error:', error);
        queryClient.clear();
        sessionStorage.removeItem('acs.activeScope');
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
    },
    [queryClient]
  );

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
      if (unsubscribePermissions) {
        unsubscribePermissions();
      }
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
      socket.off('connect_error');
      frontendSocketService.disconnect();
    };
  }, [state.isAuthenticated, state.token, refreshUserPermissions, queryClient]);

  const login = useCallback(
    async (credentials: LoginRequest): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        // P18.H02: symmetric with logout — wipe any stale active scope
        // and React Query cache BEFORE setting the new user state. The
        // tab may have been left with a previous user's locked scope
        // (sessionStorage survives same-tab navigation) or a stale
        // queryCache that would leak across users.
        sessionStorage.removeItem('acs.activeScope');
        queryClient.clear();

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
          setState((prev) => ({ ...prev, isLoading: false }));
          return false;
        }
      } catch (error) {
        const err = error as { response?: { data?: { message?: string } } };
        const message = err.response?.data?.message || 'Login failed';
        toast.error(message);
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }
    },
    [normalizeUserPermissions, queryClient]
  );

  const value = useMemo<AuthContextType>(
    () => ({ ...state, login, logout, refreshUserPermissions }),
    [state, login, logout, refreshUserPermissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
