import { useContext } from 'react';
import {
  ActiveScopeContext,
  type ActiveScopeContextType,
} from '@/contexts/ActiveScopeContextObject';

/**
 * Access the per-tab active client / product scope. Throws if used outside
 * <ActiveScopeProvider> — matches the useAuth assertion pattern.
 */
export const useActiveScope = (): ActiveScopeContextType => {
  const ctx = useContext(ActiveScopeContext);
  if (!ctx) {
    throw new Error('useActiveScope must be used within an ActiveScopeProvider');
  }
  return ctx;
};
