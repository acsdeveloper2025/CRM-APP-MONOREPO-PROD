/**
 * Utility functions for applying unified search and filter patterns
 * This file contains helper functions to standardize search/filter implementation
 */

import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';

/**
 * Standard filter types for different pages
 */
export interface CasePageFilters {
  status?: string;
  priority?: string;
  clientId?: string;
  assignedTo?: string;
}

export interface TaskPageFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
  verificationType?: string;
}

export interface UserPageFilters {
  role?: string;
  department?: string;
  status?: string;
}

export interface ClientPageFilters {
  status?: string;
  type?: string;
}

/**
 * Hook for case pages with standard filters
 */
export function useCasePageSearchFilter() {
  const search = useUnifiedSearch({ syncWithUrl: true });
  const filters = useUnifiedFilters<CasePageFilters>({ syncWithUrl: true });
  
  return {
    ...search,
    ...filters,
    activeFilterCount: Object.keys(filters.filters).length,
  };
}

/**
 * Hook for task pages with standard filters
 */
export function useTaskPageSearchFilter() {
  const search = useUnifiedSearch({ syncWithUrl: true });
  const filters = useUnifiedFilters<TaskPageFilters>({ syncWithUrl: true });
  
  return {
    ...search,
    ...filters,
    activeFilterCount: Object.keys(filters.filters).length,
  };
}

/**
 * Hook for user pages with standard filters
 */
export function useUserPageSearchFilter() {
  const search = useUnifiedSearch({ syncWithUrl: true });
  const filters = useUnifiedFilters<UserPageFilters>({ syncWithUrl: true });
  
  return {
    ...search,
    ...filters,
    activeFilterCount: Object.keys(filters.filters).length,
  };
}

/**
 * Hook for client pages with standard filters
 */
export function useClientPageSearchFilter() {
  const search = useUnifiedSearch({ syncWithUrl: true });
  const filters = useUnifiedFilters<ClientPageFilters>({ syncWithUrl: true });
  
  return {
    ...search,
    ...filters,
    activeFilterCount: Object.keys(filters.filters).length,
  };
}

