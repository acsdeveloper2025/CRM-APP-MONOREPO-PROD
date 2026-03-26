import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { locationsService, type LocationQuery } from '@/services/locations';

export const useCountries = (query: LocationQuery = {}) => {
  return useQuery({
    queryKey: ['countries', query],
    queryFn: () => locationsService.getCountries(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useStates = (query: LocationQuery = {}) => {
  return useQuery({
    queryKey: ['states', query],
    queryFn: () => locationsService.getStates(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCities = (query: LocationQuery = {}) => {
  return useQuery({
    queryKey: ['cities', query],
    queryFn: () => locationsService.getCities(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const usePincodes = (query: LocationQuery = {}) => {
  return useQuery({
    queryKey: ['pincodes', query],
    queryFn: () => locationsService.getPincodes(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const usePincodesByCity = (cityId?: string) => {
  return useQuery({
    queryKey: ['pincodes', 'by-city', cityId],
    queryFn: () => locationsService.getPincodesByCity(cityId as string),
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCountryById = (id?: string) => {
  return useQuery({
    queryKey: ['countries', id],
    queryFn: () => locationsService.getCountryById(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useStateById = (id?: string) => {
  return useQuery({
    queryKey: ['states', id],
    queryFn: () => locationsService.getStateById(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCityById = (id?: string) => {
  return useQuery({
    queryKey: ['cities', id],
    queryFn: () => locationsService.getCityById(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const usePincodeById = (id?: string) => {
  return useQuery({
    queryKey: ['pincodes', id],
    queryFn: () => locationsService.getPincodeById(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Server-side pincode search hook with debounced autocomplete.
 * Replaces client-side bulk loading (limit: 10000) with on-demand search.
 *
 * Usage:
 *   const { options, searchTerm, setSearchTerm, isLoading, selectedPincode } = usePincodeSearch(initialPincodeId);
 *
 * - Shows first 30 pincodes on mount (instant dropdown)
 * - Searches server-side as user types (debounced 300ms)
 * - Caches results per search term for 2 minutes
 * - Keeps selected pincode in options even when search changes
 */
export const usePincodeSearch = (initialPincodeId?: string) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(() => {
      setDebouncedSearch(term);
    }, 300);
  }, [debounceRef]);

  // Fetch initial/default pincodes (first 30) for immediate dropdown
  const { data: defaultData, isLoading: defaultLoading } = useQuery({
    queryKey: ['pincodes', 'search-default'],
    queryFn: () => locationsService.getPincodes({ limit: 30, sortBy: 'code', sortOrder: 'asc' }),
    staleTime: 2 * 60 * 1000,
  });

  // Server-side search when user types
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['pincodes', 'search', debouncedSearch],
    queryFn: () => locationsService.getPincodes({ search: debouncedSearch, limit: 30 }),
    enabled: debouncedSearch.length >= 1,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch the initially-selected pincode (for edit mode) so it's always in options
  const { data: selectedData } = useQuery({
    queryKey: ['pincodes', 'selected', initialPincodeId],
    queryFn: () => locationsService.getPincodeById(initialPincodeId as string),
    enabled: !!initialPincodeId,
    staleTime: 5 * 60 * 1000,
  });

  const pincodes = useMemo(() => {
    const sourceData = debouncedSearch.length >= 1 ? searchData : defaultData;
    const items = sourceData?.data || [];

    // Always include the selected pincode in the list
    if (selectedData?.data && initialPincodeId) {
      const selectedPincode = selectedData.data;
      const exists = items.some(
        (p: { id: string | number }) => String(p.id) === String(initialPincodeId)
      );
      if (!exists) {
        return [selectedPincode, ...items];
      }
    }

    return items;
  }, [defaultData, searchData, selectedData, debouncedSearch, initialPincodeId]);

  const selectedPincode = useMemo(() => {
    if (!initialPincodeId) return null;
    return pincodes.find(
      (p: { id: string | number }) => String(p.id) === String(initialPincodeId)
    ) || selectedData?.data || null;
  }, [pincodes, initialPincodeId, selectedData]);

  return {
    pincodes,
    searchTerm,
    setSearchTerm: handleSearchChange,
    isLoading: defaultLoading || searchLoading,
    selectedPincode,
  };
};
