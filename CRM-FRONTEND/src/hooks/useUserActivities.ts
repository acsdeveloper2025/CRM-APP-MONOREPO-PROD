import { useQuery } from '@tanstack/react-query';
import { userAuditService, type ActivityQuery } from '@/services/userAuditService';

export function useUserActivities(query: ActivityQuery) {
  return useQuery({
    queryKey: ['user-activities', query],
    queryFn: () => userAuditService.getUserActivities(query),
    placeholderData: (previousData) => previousData,
  });
}
