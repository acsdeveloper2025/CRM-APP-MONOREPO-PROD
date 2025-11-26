import { useQuery } from '@tanstack/react-query';
import { rateTypesService } from '@/services/rateTypes';

export const useRateTypes = () => {
  return useQuery({
    queryKey: ['rate-types'],
    queryFn: async () => {
      const response = await rateTypesService.getActiveRateTypes();
      return response;
    },
  });
};
