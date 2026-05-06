import { useQuery } from '@tanstack/react-query';
import { locationsService } from '@/services/locations';

export const useAreasByPincode = (pincodeId?: number) => {
  return useQuery({
    queryKey: ['areas', 'by-pincode', pincodeId],
    queryFn: () => locationsService.getAreasByPincode(pincodeId as number),
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

/**
 * 2026-05-06 bug 77: areas scoped to (client, product, pincode) via service_zone_rules.
 * Use this in case-creation/edit flows; useAreasByPincode (unscoped) is for admin
 * master-data screens (e.g. ServiceZoneRulesTab) where the full pincode→areas map
 * is needed to define new rules.
 */
export const useScopedAreasByPincode = (
  clientId: string | number | undefined | null,
  productId: string | number | undefined | null,
  pincodeId?: number
) => {
  return useQuery({
    queryKey: ['scoped-areas', clientId, productId, pincodeId],
    queryFn: () =>
      locationsService.getAreasForClientProduct(
        clientId as string | number,
        productId as string | number,
        pincodeId as number
      ),
    enabled: !!(clientId && productId && pincodeId),
    staleTime: 5 * 60 * 1000,
  });
};
