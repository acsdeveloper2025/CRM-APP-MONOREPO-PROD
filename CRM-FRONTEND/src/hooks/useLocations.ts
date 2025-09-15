import { useQuery } from '@tanstack/react-query';
import { locationsService } from '@/services/locations';
import type { LocationQuery } from '@/services/locations';

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
    queryFn: () => locationsService.getPincodesByCity(cityId!),
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCountryById = (id?: string) => {
  return useQuery({
    queryKey: ['countries', id],
    queryFn: () => locationsService.getCountryById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useStateById = (id?: string) => {
  return useQuery({
    queryKey: ['states', id],
    queryFn: () => locationsService.getStateById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCityById = (id?: string) => {
  return useQuery({
    queryKey: ['cities', id],
    queryFn: () => locationsService.getCityById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const usePincodeById = (id?: string) => {
  return useQuery({
    queryKey: ['pincodes', id],
    queryFn: () => locationsService.getPincodeById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
