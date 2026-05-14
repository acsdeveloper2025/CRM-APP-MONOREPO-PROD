import { createContext } from 'react';

/**
 * Per-tab "active scope" — narrows the visible data to a chosen client /
 * product without changing the underlying RBAC assignments. Persisted in
 * sessionStorage (NOT localStorage) so the scope dies with the tab and
 * cannot leak across browser sessions.
 *
 * Backend contract: project_scope_control_audit_2026_05_14.md.
 * Headers attached by services/api.ts request interceptor:
 *   X-Active-Client-Id, X-Active-Product-Id
 * Backend validates each against assignedClientIds / assignedProductIds
 * and returns 403 INVALID_ACTIVE_SCOPE_* on miss.
 */
export interface ActiveScopeState {
  selectedClientId: number | null;
  selectedProductId: number | null;
}

export interface ActiveScopeContextType extends ActiveScopeState {
  setScope: (next: Partial<ActiveScopeState>) => void;
  clearScope: () => void;
}

export const ACTIVE_SCOPE_STORAGE_KEY = 'acs.activeScope';

export const ActiveScopeContext = createContext<ActiveScopeContextType | undefined>(undefined);
