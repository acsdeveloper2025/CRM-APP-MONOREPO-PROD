import { useCallback } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebounce';

/**
 * Hook for managing search state with the SearchInput component
 * 
 * @param initialValue Initial search value
 * @param debounceDelay Debounce delay in milliseconds
 * @returns Search state and handlers
 */
export const useSearchInput = (initialValue: string = '', debounceDelay: number = 400) => {
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    isSearching
  } = useDebouncedSearch(initialValue, debounceDelay);

  const clearSearch = useCallback(() => {
    setSearchValue('');
  }, [setSearchValue]);

  return {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isSearching,
  };
};
