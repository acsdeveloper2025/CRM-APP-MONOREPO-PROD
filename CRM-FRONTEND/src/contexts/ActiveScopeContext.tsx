import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import {
  ACTIVE_SCOPE_STORAGE_KEY,
  ActiveScopeContext,
  type ActiveScopeContextType,
  type ActiveScopeState,
} from './ActiveScopeContextObject';

interface ActiveScopeProviderProps {
  children: React.ReactNode;
}

const EMPTY_SCOPE: ActiveScopeState = {
  selectedClientId: null,
  selectedProductId: null,
  isDemoMode: false,
};

/**
 * Defensive parse — sessionStorage may contain stale data from a prior
 * deploy or an unrelated key clash. We only trust positive integers;
 * anything else falls back to EMPTY_SCOPE so the user starts the tab in
 * the "all assigned" baseline.
 *
 * isDemoMode is force-disabled when no scope is set, otherwise locking
 * an "all clients" baseline would be meaningless and confusing.
 */
const hydrateFromSessionStorage = (): ActiveScopeState => {
  if (typeof sessionStorage === 'undefined') {
    return EMPTY_SCOPE;
  }
  try {
    const raw = sessionStorage.getItem(ACTIVE_SCOPE_STORAGE_KEY);
    if (!raw) {
      return EMPTY_SCOPE;
    }
    const parsed = JSON.parse(raw) as Partial<ActiveScopeState>;
    const clientId =
      typeof parsed.selectedClientId === 'number' && parsed.selectedClientId > 0
        ? parsed.selectedClientId
        : null;
    const productId =
      typeof parsed.selectedProductId === 'number' && parsed.selectedProductId > 0
        ? parsed.selectedProductId
        : null;
    const isDemoMode = parsed.isDemoMode === true && clientId != null;
    return { selectedClientId: clientId, selectedProductId: productId, isDemoMode };
  } catch (error) {
    logger.warn('Failed to hydrate active scope from sessionStorage:', error);
    return EMPTY_SCOPE;
  }
};

const persistToSessionStorage = (next: ActiveScopeState): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    if (next.selectedClientId == null && next.selectedProductId == null && !next.isDemoMode) {
      sessionStorage.removeItem(ACTIVE_SCOPE_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(ACTIVE_SCOPE_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    logger.warn('Failed to persist active scope to sessionStorage:', error);
  }
};

export const ActiveScopeProvider: React.FC<ActiveScopeProviderProps> = ({ children }) => {
  const [state, setState] = useState<ActiveScopeState>(() => hydrateFromSessionStorage());
  const queryClient = useQueryClient();
  const skipNextCacheClearRef = useRef(true);

  // Persist on every state change. Kept in an effect (rather than inline
  // inside setScope) so manual sessionStorage edits made from devtools or
  // a future cross-tab broadcast hook can be reflected next render.
  useEffect(() => {
    persistToSessionStorage(state);
  }, [state]);

  // P5 — mandatory cache wipe on scope change
  // (project_scope_control_audit_2026_05_14.md). Any narrowing change
  // must invalidate ALL React Query state because in-flight queries
  // memoise arrays of rows that would otherwise display data from the
  // previous scope until staleTime / gcTime expires.
  //
  // Skip the very first run: hydration on mount sets the initial state
  // from sessionStorage; there is nothing cached yet to clear, and a
  // surprise clear on app boot would defeat queryClient warm-up.
  useEffect(() => {
    if (skipNextCacheClearRef.current) {
      skipNextCacheClearRef.current = false;
      return;
    }
    queryClient.clear();
  }, [state.selectedClientId, state.selectedProductId, queryClient]);

  const setScope = useCallback(
    (next: Partial<Pick<ActiveScopeState, 'selectedClientId' | 'selectedProductId'>>) => {
      setState((prev) => ({
        ...prev,
        selectedClientId:
          next.selectedClientId !== undefined ? next.selectedClientId : prev.selectedClientId,
        selectedProductId:
          next.selectedProductId !== undefined ? next.selectedProductId : prev.selectedProductId,
        // Locking an empty scope makes no sense — auto-disable demo mode
        // when the user clears the scope entirely.
        isDemoMode:
          prev.isDemoMode &&
          (next.selectedClientId !== null || prev.selectedClientId !== null) &&
          (next.selectedClientId !== undefined ? next.selectedClientId : prev.selectedClientId) !=
            null,
      }));
    },
    []
  );

  const clearScope = useCallback(() => {
    setState(EMPTY_SCOPE);
  }, []);

  const lockScope = useCallback(() => {
    setState((prev) => {
      // Refuse to lock when no scope is set — locking the "all clients"
      // baseline would just confuse the user with a banner that says
      // nothing meaningful.
      if (prev.selectedClientId == null && prev.selectedProductId == null) {
        return prev;
      }
      return { ...prev, isDemoMode: true };
    });
  }, []);

  const unlockScope = useCallback(() => {
    setState((prev) => ({ ...prev, isDemoMode: false }));
  }, []);

  const value = useMemo<ActiveScopeContextType>(
    () => ({ ...state, setScope, clearScope, lockScope, unlockScope }),
    [state, setScope, clearScope, lockScope, unlockScope]
  );

  return <ActiveScopeContext.Provider value={value}>{children}</ActiveScopeContext.Provider>;
};
