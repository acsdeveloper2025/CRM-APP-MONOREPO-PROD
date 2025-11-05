import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Standardized debounce delay for all search inputs across the application
 * Increased to 800ms to reduce API calls and improve performance
 */
export const SEARCH_DEBOUNCE_DELAY = 800;

/**
 * URL parameter names for search and filters
 */
export const SEARCH_PARAMS = {
  SEARCH: 'search',
  STATUS: 'status',
  PRIORITY: 'priority',
  CLIENT: 'client',
  ASSIGNED_TO: 'assignedTo',
  DATE_FROM: 'dateFrom',
  DATE_TO: 'dateTo',
  VERIFICATION_TYPE: 'verificationType',
  PRODUCT: 'product',
  PAGE: 'page',
  LIMIT: 'limit',
} as const;

export interface UseUnifiedSearchOptions {
  /**
   * Custom debounce delay in milliseconds
   * @default 800
   */
  debounceDelay?: number;
  
  /**
   * Minimum search term length before triggering search
   * @default 0
   */
  minSearchLength?: number;
  
  /**
   * Whether to sync search state with URL parameters
   * @default true
   */
  syncWithUrl?: boolean;
  
  /**
   * Callback when search value changes (after debounce)
   */
  onSearchChange?: (value: string) => void;
  
  /**
   * Initial search value
   */
  initialValue?: string;
}

export interface UseUnifiedSearchReturn {
  /**
   * Current search input value (immediate, not debounced)
   */
  searchValue: string;
  
  /**
   * Debounced search value (use this for API calls)
   */
  debouncedSearchValue: string;
  
  /**
   * Update search value
   */
  setSearchValue: (value: string) => void;
  
  /**
   * Clear search value
   */
  clearSearch: () => void;
  
  /**
   * Whether search is currently debouncing
   */
  isDebouncing: boolean;
}

/**
 * Unified search hook with standardized debouncing and URL sync
 * 
 * @example
 * ```tsx
 * const { searchValue, debouncedSearchValue, setSearchValue, clearSearch } = useUnifiedSearch({
 *   syncWithUrl: true,
 *   onSearchChange: (value) => console.log('Search:', value)
 * });
 * 
 * // Use in query
 * const { data } = useQuery({
 *   queryKey: ['items', debouncedSearchValue],
 *   queryFn: () => fetchItems({ search: debouncedSearchValue })
 * });
 * ```
 */
export function useUnifiedSearch(options: UseUnifiedSearchOptions = {}): UseUnifiedSearchReturn {
  const {
    debounceDelay = SEARCH_DEBOUNCE_DELAY,
    minSearchLength = 0,
    syncWithUrl = true,
    onSearchChange,
    initialValue = '',
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial value from URL if syncing, otherwise use provided initial value
  const urlSearchValue = syncWithUrl ? searchParams.get(SEARCH_PARAMS.SEARCH) || '' : '';
  const [searchValue, setSearchValueState] = useState<string>(urlSearchValue || initialValue);
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>(searchValue);
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);

  // Debounce effect
  useEffect(() => {
    // Don't debounce if search value is below minimum length
    if (searchValue.length > 0 && searchValue.length < minSearchLength) {
      setDebouncedSearchValue('');
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
      setIsDebouncing(false);
      
      // Call onChange callback
      if (onSearchChange) {
        onSearchChange(searchValue);
      }
      
      // Sync with URL if enabled
      if (syncWithUrl) {
        const newParams = new URLSearchParams(searchParams);
        if (searchValue) {
          newParams.set(SEARCH_PARAMS.SEARCH, searchValue);
        } else {
          newParams.delete(SEARCH_PARAMS.SEARCH);
        }
        setSearchParams(newParams, { replace: true });
      }
    }, debounceDelay);

    return () => {
      clearTimeout(timer);
      setIsDebouncing(false);
    };
  }, [searchValue, debounceDelay, minSearchLength, syncWithUrl, onSearchChange, searchParams, setSearchParams]);

  // Update search value from URL when it changes externally
  useEffect(() => {
    if (syncWithUrl) {
      const urlValue = searchParams.get(SEARCH_PARAMS.SEARCH) || '';
      if (urlValue !== searchValue) {
        setSearchValueState(urlValue);
      }
    }
  }, [searchParams, syncWithUrl]); // Intentionally not including searchValue to avoid loops

  const setSearchValue = useCallback((value: string) => {
    setSearchValueState(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchValueState('');
    setDebouncedSearchValue('');
    
    if (syncWithUrl) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete(SEARCH_PARAMS.SEARCH);
      setSearchParams(newParams, { replace: true });
    }
  }, [syncWithUrl, searchParams, setSearchParams]);

  return useMemo(() => ({
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  }), [searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing]);
}

/**
 * Hook for managing filter state with URL synchronization
 */
export interface UseUnifiedFiltersOptions<T extends Record<string, any>> {
  /**
   * Initial filter values
   */
  initialFilters?: Partial<T>;
  
  /**
   * Whether to sync filters with URL parameters
   * @default true
   */
  syncWithUrl?: boolean;
  
  /**
   * Callback when filters change
   */
  onFiltersChange?: (filters: Partial<T>) => void;
}

export interface UseUnifiedFiltersReturn<T extends Record<string, any>> {
  /**
   * Current filter values
   */
  filters: Partial<T>;
  
  /**
   * Update a single filter
   */
  setFilter: <K extends keyof T>(key: K, value: T[K] | undefined) => void;
  
  /**
   * Update multiple filters at once
   */
  setFilters: (filters: Partial<T>) => void;
  
  /**
   * Clear all filters
   */
  clearFilters: () => void;
  
  /**
   * Check if any filters are active
   */
  hasActiveFilters: boolean;
}

/**
 * Unified filters hook with URL synchronization
 * 
 * @example
 * ```tsx
 * const { filters, setFilter, clearFilters, hasActiveFilters } = useUnifiedFilters({
 *   initialFilters: { status: 'PENDING' },
 *   syncWithUrl: true
 * });
 * ```
 */
export function useUnifiedFilters<T extends Record<string, any>>(
  options: UseUnifiedFiltersOptions<T> = {}
): UseUnifiedFiltersReturn<T> {
  const {
    initialFilters = {},
    syncWithUrl = true,
    onFiltersChange,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL or initial values
  const getInitialFilters = useCallback((): Partial<T> => {
    if (!syncWithUrl) {return initialFilters;}
    
    const urlFilters: Partial<T> = {};
    searchParams.forEach((value, key) => {
      if (key !== SEARCH_PARAMS.SEARCH && key !== SEARCH_PARAMS.PAGE && key !== SEARCH_PARAMS.LIMIT) {
        urlFilters[key as keyof T] = value as any;
      }
    });
    
    return { ...initialFilters, ...urlFilters };
  }, [syncWithUrl, initialFilters, searchParams]);

  const [filters, setFiltersState] = useState<Partial<T>>(getInitialFilters);

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K] | undefined) => {
    setFiltersState(prev => {
      const newFilters = { ...prev };
      
      if (value === undefined || value === null || value === '') {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      
      // Sync with URL
      if (syncWithUrl) {
        const newParams = new URLSearchParams(searchParams);
        if (value !== undefined && value !== null && value !== '') {
          newParams.set(String(key), String(value));
        } else {
          newParams.delete(String(key));
        }
        setSearchParams(newParams, { replace: true });
      }
      
      // Call onChange callback
      if (onFiltersChange) {
        onFiltersChange(newFilters);
      }
      
      return newFilters;
    });
  }, [syncWithUrl, searchParams, setSearchParams, onFiltersChange]);

  const setFilters = useCallback((newFilters: Partial<T>) => {
    setFiltersState(newFilters);
    
    // Sync with URL
    if (syncWithUrl) {
      const newParams = new URLSearchParams(searchParams);
      
      // Clear existing filter params (keep search, page, limit)
      Array.from(newParams.keys()).forEach(key => {
        if (key !== SEARCH_PARAMS.SEARCH && key !== SEARCH_PARAMS.PAGE && key !== SEARCH_PARAMS.LIMIT) {
          newParams.delete(key);
        }
      });
      
      // Add new filters
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          newParams.set(key, String(value));
        }
      });
      
      setSearchParams(newParams, { replace: true });
    }
    
    // Call onChange callback
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  }, [syncWithUrl, searchParams, setSearchParams, onFiltersChange]);

  const clearFilters = useCallback(() => {
    setFiltersState({});
    
    // Sync with URL
    if (syncWithUrl) {
      const newParams = new URLSearchParams(searchParams);
      
      // Clear all filter params (keep search, page, limit)
      Array.from(newParams.keys()).forEach(key => {
        if (key !== SEARCH_PARAMS.SEARCH && key !== SEARCH_PARAMS.PAGE && key !== SEARCH_PARAMS.LIMIT) {
          newParams.delete(key);
        }
      });
      
      setSearchParams(newParams, { replace: true });
    }
    
    // Call onChange callback
    if (onFiltersChange) {
      onFiltersChange({});
    }
  }, [syncWithUrl, searchParams, setSearchParams, onFiltersChange]);

  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).length > 0;
  }, [filters]);

  return useMemo(() => ({
    filters,
    setFilter,
    setFilters,
    clearFilters,
    hasActiveFilters,
  }), [filters, setFilter, setFilters, clearFilters, hasActiveFilters]);
}

