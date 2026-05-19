import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';
import { authService } from '@/services/auth';
import { toast } from 'sonner';
import { AuthContext, AuthContextType, LoginAttemptResult } from './AuthContextObject';
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

    // NM-4 (2026-05-16): BE emits `case:updated` to room `case:{caseId}`
    // on assign / revisit / revoke. Without a listener, a second admin
    // tab stayed stale until polling tick. Invalidate the case/task
    // query keys so live data refetches.
    const unsubscribeCaseUpdated =
      frontendSocketService.onCaseUpdated(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['verification-tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['all-verification-tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['cases'] }),
          queryClient.invalidateQueries({ queryKey: ['case'] }),
          queryClient.invalidateQueries({ queryKey: ['verification-tasks-for-case'] }),
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
      if (unsubscribeCaseUpdated) {
        unsubscribeCaseUpdated();
      }
      socket.off('connect_error');
      frontendSocketService.disconnect();
    };
  }, [state.isAuthenticated, state.token, refreshUserPermissions, queryClient]);

  // T1-2: shared "post-tokens" success path — runs after either
  // password-only login OR completed MFA verification. Extracted so the
  // two callers cannot drift.
  const applyAuthenticatedSession = useCallback(
    async (
      user: NonNullable<Awaited<ReturnType<typeof authService.login>>['data']> & {
        user: import('@/types/auth').User;
        tokens: { accessToken: string };
      }
    ) => {
      const refreshedUser = await authService.refreshUserData();
      setState({
        user: normalizeUserPermissions(refreshedUser || user.user),
        token: user.tokens.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      toast.success('Login successful!');
    },
    [normalizeUserPermissions]
  );

  const login = useCallback(
    async (credentials: LoginRequest): Promise<LoginAttemptResult> => {
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

        // T1-2: MFA branch. BE returned a challenge token, not session
        // tokens. Surface to the caller so the LoginPage can swap to
        // the code-entry screen; do NOT mark the user authenticated.
        if (response.success && response.data && 'mfaRequired' in response.data) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return { status: 'mfa-required', mfaChallenge: response.data.mfaChallenge };
        }

        if (response.success && response.data && 'tokens' in response.data) {
          await applyAuthenticatedSession(response.data);
          return { status: 'ok' };
        }

        toast.error(response.message || 'Login failed');
        setState((prev) => ({ ...prev, isLoading: false }));
        return { status: 'failed' };
      } catch (error) {
        const err = error as { response?: { data?: { message?: string } } };
        const message = err.response?.data?.message || 'Login failed';
        toast.error(message);
        setState((prev) => ({ ...prev, isLoading: false }));
        return { status: 'failed' };
      }
    },
    [applyAuthenticatedSession, queryClient]
  );

  const completeMfaLogin = useCallback(
    async (challenge: string, code: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const response = await authService.verifyMfa(challenge, code);
        if (response.success && response.data && 'tokens' in response.data) {
          await applyAuthenticatedSession(response.data);
          return true;
        }
        toast.error(response.message || 'MFA verification failed');
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      } catch (error) {
        const err = error as { response?: { data?: { message?: string } } };
        toast.error(err.response?.data?.message || 'MFA verification failed');
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }
    },
    [applyAuthenticatedSession]
  );

  const value = useMemo<AuthContextType>(
    () => ({ ...state, login, completeMfaLogin, logout, refreshUserPermissions }),
    [state, login, completeMfaLogin, logout, refreshUserPermissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
