import { useQuery } from '@tanstack/react-query';
import { locationsService } from '@/services/locations';

export const useAreasByPincode = (pincodeId?: number) => {
  return useQuery({
    queryKey: ['areas', 'by-pincode', pincodeId],
    queryFn: () => locationsService.getAreasByPincode(pincodeId!),
    enabled: !!pincodeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAreas = () => {
  return useQuery({
    queryKey: ['areas'],
    queryFn: () => locationsService.getAreas(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
