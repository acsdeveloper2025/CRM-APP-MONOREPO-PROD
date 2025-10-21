import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for debouncing values
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for debounced search functionality
 * @param initialValue - Initial search value
 * @param delay - Debounce delay in milliseconds (default: 400ms for optimal UX)
 * @returns Object with search value, debounced value, setter, and loading state
 */
export function useDebouncedSearch(initialValue: string = '', delay: number = 400) {
  const [searchValue, setSearchValue] = useState(initialValue);
  const debouncedSearchValue = useDebounce(searchValue, delay);

  // Determine if we're waiting for debounce
  const isSearching = searchValue !== debouncedSearchValue;

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchValue('');
  }, []);

  // Reset search to initial value
  const resetSearch = useCallback(() => {
    setSearchValue(initialValue);
  }, [initialValue]);

  return {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    resetSearch,
    isSearching,
  };
}

/**
 * Enhanced search hook with additional features for complex search scenarios
 * @param initialValue - Initial search value
 * @param delay - Debounce delay in milliseconds
 * @param minLength - Minimum length before triggering search (default: 0)
 * @returns Enhanced search state and handlers
 */
export function useAdvancedSearch(
  initialValue: string = '',
  delay: number = 400,
  minLength: number = 0
) {
  const [searchValue, setSearchValue] = useState(initialValue);
  const [isManuallyCleared, setIsManuallyCleared] = useState(false);
  const debouncedSearchValue = useDebounce(searchValue, delay);

  // Only trigger search if value meets minimum length requirement
  const effectiveSearchValue = debouncedSearchValue.length >= minLength ? debouncedSearchValue : '';

  // Determine if we're waiting for debounce
  const isSearching = searchValue !== debouncedSearchValue && searchValue.length >= minLength;

  // Check if search is active (has meaningful value)
  const hasActiveSearch = effectiveSearchValue.length > 0;

  const clearSearch = useCallback(() => {
    setSearchValue('');
    setIsManuallyCleared(true);
    setTimeout(() => setIsManuallyCleared(false), 100);
  }, []);

  const resetSearch = useCallback(() => {
    setSearchValue(initialValue);
    setIsManuallyCleared(false);
  }, [initialValue]);

  return {
    searchValue,
    debouncedSearchValue,
    effectiveSearchValue,
    setSearchValue,
    clearSearch,
    resetSearch,
    isSearching,
    hasActiveSearch,
    isManuallyCleared,
  };
}
