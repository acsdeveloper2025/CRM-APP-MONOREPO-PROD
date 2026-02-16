import { useQuery } from '@tanstack/react-query';
import { userAuditService, type SessionQuery } from '@/services/userAuditService';

export function useUserSessions(query: SessionQuery) {
  return useQuery({
    queryKey: ['user-sessions', query],
    queryFn: () => userAuditService.getUserSessions(query),
    placeholderData: (previousData) => previousData,
  });
}
