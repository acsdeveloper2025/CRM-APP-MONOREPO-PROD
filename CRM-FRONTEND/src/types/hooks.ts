/**
 * Custom Hook Return Types
 * Type definitions for custom React hooks
 */

/**
 * Async data fetching hook return type
 */
export interface UseAsyncData<T = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Pagination hook return type
 */
export interface UsePagination {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
}

/**
 * Search hook return type
 */
export interface UseSearch {
  searchValue: string;
  debouncedSearchValue: string;
  setSearchValue: (value: string) => void;
  clearSearch: () => void;
  isDebouncing: boolean;
}

/**
 * Filter hook return type
 */
export interface UseFilters<T = Record<string, unknown>> {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  clearFilters: () => void;
  clearFilter: <K extends keyof T>(key: K) => void;
  hasActiveFilters: boolean;
}

/**
 * Sort hook return type
 */
export interface UseSort {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  setSortBy: (field: string) => void;
  toggleSortOrder: () => void;
  setSort: (field: string, order: 'asc' | 'desc') => void;
}

/**
 * Modal hook return type
 */
export interface UseModal {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Form hook return type
 */
export interface UseForm<T = Record<string, unknown>> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  handleChange: (name: keyof T, value: unknown) => void;
  handleBlur: (name: keyof T) => void;
  handleSubmit: (e?: React.FormEvent) => void | Promise<void>;
  handleReset: () => void;
  setFieldValue: (name: keyof T, value: unknown) => void;
  setFieldError: (name: keyof T, error: string) => void;
}

/**
 * Local storage hook return type
 */
export interface UseLocalStorage<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  removeValue: () => void;
}

/**
 * Debounce hook return type
 */
export interface UseDebounce<T> {
  debouncedValue: T;
  isDebouncing: boolean;
}

/**
 * Network status hook return type
 */
export interface UseNetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}
