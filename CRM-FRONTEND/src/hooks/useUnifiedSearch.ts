import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

  /**
   * Custom URL parameter name for search
   * @default 'search'
   */
  urlParamName?: string;
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
 *   onSearchChange: (value) => logger.warn('Search:', value)
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

  const searchKey = options.urlParamName || SEARCH_PARAMS.SEARCH;

  // Get initial value from URL if syncing, otherwise use provided initial value
  const urlSearchValue = syncWithUrl ? searchParams.get(searchKey) || '' : '';
  const [searchValue, setSearchValueState] = useState<string>(urlSearchValue || initialValue);
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>(searchValue);
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);

  // 2026-05-03: keep refs of the latest URL helpers so the debounce effect
  // doesn't depend on `searchParams`/`setSearchParams` references. Putting
  // those in the deps caused a ping-pong loop: typing → debounce writes URL
  // → searchParams ref changes → debounce re-fires → writes URL again. The
  // user-visible symptom was "search box auto-fills with prior value after
  // any URL-changing action (e.g. opening/closing a Dialog that triggered
  // a route restore)". Refs let us capture latest without re-subscribing.
  const searchParamsRef = useRef(searchParams);
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
    setSearchParamsRef.current = setSearchParams;
  });

  // Track whether the user (not a URL sync) just edited the value, so the
  // URL→state effect doesn't clobber a fresh user edit with a stale URL.
  const userEditedAtRef = useRef<number>(0);

  // Debounce effect — restarts ONLY when searchValue (user edit) changes.
  useEffect(() => {
    if (searchValue.length > 0 && searchValue.length < minSearchLength) {
      setDebouncedSearchValue('');
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);

    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
      setIsDebouncing(false);

      if (onSearchChange) {
        onSearchChange(searchValue);
      }

      if (syncWithUrl) {
        const newParams = new URLSearchParams(searchParamsRef.current);
        if (searchValue) {
          newParams.set(searchKey, searchValue);
        } else {
          newParams.delete(searchKey);
        }
        setSearchParamsRef.current(newParams, { replace: true });
      }
    }, debounceDelay);

    return () => {
      clearTimeout(timer);
      setIsDebouncing(false);
    };
  }, [searchValue, debounceDelay, minSearchLength, syncWithUrl, onSearchChange, searchKey]);

  // Update search value from URL when it changes externally — but ignore
  // URL changes that arrive within 2*debounce of a user edit (those are
  // echoes of our own write). This prevents the URL→state effect from
  // resurrecting stale values during the ping-pong window.
  useEffect(() => {
    if (!syncWithUrl) {
      return;
    }
    const sinceEdit = Date.now() - userEditedAtRef.current;
    if (sinceEdit < debounceDelay * 2) {
      return;
    }
    const urlValue = searchParams.get(searchKey) || '';
    if (urlValue !== searchValue) {
      setSearchValueState(urlValue);
    }
  }, [searchParams, syncWithUrl, searchKey, debounceDelay]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSearchValue = useCallback((value: string) => {
    userEditedAtRef.current = Date.now();
    setSearchValueState(value);
  }, []);

  const clearSearch = useCallback(() => {
    userEditedAtRef.current = Date.now();
    setSearchValueState('');
    setDebouncedSearchValue('');

    if (syncWithUrl) {
      const newParams = new URLSearchParams(searchParamsRef.current);
      newParams.delete(searchKey);
      setSearchParamsRef.current(newParams, { replace: true });
    }
  }, [syncWithUrl, searchKey]);

  return useMemo(
    () => ({
      searchValue,
      debouncedSearchValue,
      setSearchValue,
      clearSearch,
      isDebouncing,
    }),
    [searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing]
  );
}

/**
 * Hook for managing filter state with URL synchronization
 */
export interface UseUnifiedFiltersOptions<T extends Record<string, unknown>> {
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

  /**
   * Prefix for URL parameter names to avoid collisions
   */
  urlParamPrefix?: string;
}

export interface UseUnifiedFiltersReturn<T extends Record<string, unknown>> {
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
export function useUnifiedFilters<T extends Record<string, unknown>>(
  options: UseUnifiedFiltersOptions<T> = {}
): UseUnifiedFiltersReturn<T> {
  const { initialFilters = {}, syncWithUrl = true, onFiltersChange, urlParamPrefix } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL or initial values
  const getInitialFilters = useCallback((): Partial<T> => {
    if (!syncWithUrl) {
      return initialFilters;
    }

    const urlFilters: Partial<T> = {};
    const prefix = urlParamPrefix || '';

    searchParams.forEach((value, key) => {
      // If prefix is provided, only read params starting with that prefix
      if (prefix) {
        if (key.startsWith(prefix)) {
          const actualKey = key.slice(prefix.length);
          urlFilters[actualKey as keyof T] = value as unknown as T[keyof T];
        }
      } else {
        // Default behavior: read all params except reserved ones
        if (
          key !== SEARCH_PARAMS.SEARCH &&
          key !== SEARCH_PARAMS.PAGE &&
          key !== SEARCH_PARAMS.LIMIT
        ) {
          urlFilters[key as keyof T] = value as unknown as T[keyof T];
        }
      }
    });

    return { ...initialFilters, ...urlFilters };
  }, [syncWithUrl, initialFilters, searchParams, urlParamPrefix]);

  const [filters, setFiltersState] = useState<Partial<T>>(getInitialFilters);

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K] | undefined) => {
      setFiltersState((prev) => {
        const newFilters = { ...prev };

        if (value === undefined || value === null || value === '') {
          delete newFilters[key];
        } else {
          newFilters[key] = value;
        }

        // Sync with URL
        if (syncWithUrl) {
          const newParams = new URLSearchParams(searchParams);
          const urlKey = urlParamPrefix ? `${urlParamPrefix}${String(key)}` : String(key);
          if (value !== undefined && value !== null && value !== '') {
            newParams.set(urlKey, String(value));
          } else {
            newParams.delete(urlKey);
          }
          setSearchParams(newParams, { replace: true });
        }

        // Call onChange callback
        if (onFiltersChange) {
          onFiltersChange(newFilters);
        }

        return newFilters;
      });
    },
    [syncWithUrl, searchParams, setSearchParams, onFiltersChange, urlParamPrefix]
  );

  const setFilters = useCallback(
    (newFilters: Partial<T>) => {
      setFiltersState(newFilters);

      // Sync with URL
      if (syncWithUrl) {
        const newParams = new URLSearchParams(searchParams);
        const prefix = urlParamPrefix || '';

        // Clear existing filter params (keep search, page, limit)
        Array.from(newParams.keys()).forEach((key) => {
          if (prefix) {
            if (key.startsWith(prefix)) {
              newParams.delete(key);
            }
          } else {
            if (
              key !== SEARCH_PARAMS.SEARCH &&
              key !== SEARCH_PARAMS.PAGE &&
              key !== SEARCH_PARAMS.LIMIT
            ) {
              newParams.delete(key);
            }
          }
        });

        // Add new filters
        Object.entries(newFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            const urlKey = prefix ? `${prefix}${key}` : key;
            newParams.set(urlKey, String(value));
          }
        });

        setSearchParams(newParams, { replace: true });
      }

      // Call onChange callback
      if (onFiltersChange) {
        onFiltersChange(newFilters);
      }
    },
    [syncWithUrl, searchParams, setSearchParams, onFiltersChange, urlParamPrefix]
  );

  const clearFilters = useCallback(() => {
    setFiltersState({});

    // Sync with URL
    if (syncWithUrl) {
      const newParams = new URLSearchParams(searchParams);
      const prefix = urlParamPrefix || '';

      // Clear all filter params (keep search, page, limit)
      Array.from(newParams.keys()).forEach((key) => {
        if (prefix) {
          if (key.startsWith(prefix)) {
            newParams.delete(key);
          }
        } else {
          if (
            key !== SEARCH_PARAMS.SEARCH &&
            key !== SEARCH_PARAMS.PAGE &&
            key !== SEARCH_PARAMS.LIMIT
          ) {
            newParams.delete(key);
          }
        }
      });

      setSearchParams(newParams, { replace: true });
    }

    // Call onChange callback
    if (onFiltersChange) {
      onFiltersChange({});
    }
  }, [syncWithUrl, searchParams, setSearchParams, onFiltersChange, urlParamPrefix]);

  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).length > 0;
  }, [filters]);

  return useMemo(
    () => ({
      filters,
      setFilter,
      setFilters,
      clearFilters,
      hasActiveFilters,
    }),
    [filters, setFilter, setFilters, clearFilters, hasActiveFilters]
  );
}
