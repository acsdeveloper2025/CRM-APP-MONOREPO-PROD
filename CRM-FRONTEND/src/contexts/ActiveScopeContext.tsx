import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
};

/**
 * Defensive parse — sessionStorage may contain stale data from a prior
 * deploy or an unrelated key clash. We only trust positive integers;
 * anything else falls back to EMPTY_SCOPE so the user starts the tab in
 * the "all assigned" baseline.
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
    return { selectedClientId: clientId, selectedProductId: productId };
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
    if (next.selectedClientId == null && next.selectedProductId == null) {
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

  // Persist on every state change. Kept in an effect (rather than inline
  // inside setScope) so manual sessionStorage edits made from devtools or
  // a future cross-tab broadcast hook can be reflected next render.
  useEffect(() => {
    persistToSessionStorage(state);
  }, [state]);

  const setScope = useCallback((next: Partial<ActiveScopeState>) => {
    setState((prev) => ({
      selectedClientId:
        next.selectedClientId !== undefined ? next.selectedClientId : prev.selectedClientId,
      selectedProductId:
        next.selectedProductId !== undefined ? next.selectedProductId : prev.selectedProductId,
    }));
  }, []);

  const clearScope = useCallback(() => {
    setState(EMPTY_SCOPE);
  }, []);

  const value = useMemo<ActiveScopeContextType>(
    () => ({ ...state, setScope, clearScope }),
    [state, setScope, clearScope]
  );

  return <ActiveScopeContext.Provider value={value}>{children}</ActiveScopeContext.Provider>;
};
