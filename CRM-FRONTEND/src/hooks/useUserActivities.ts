import { useQuery } from '@tanstack/react-query';
import { userAuditService, type ActivityQuery } from '@/services/userAuditService';

interface UseUserActivitiesOptions {
  enabled?: boolean;
}

export function useUserActivities(query: ActivityQuery, options?: UseUserActivitiesOptions) {
  return useQuery({
    queryKey: ['user-activities', query],
    queryFn: () => userAuditService.getUserActivities(query),
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });
}
