import { useQuery } from '@tanstack/react-query';
import { userAuditService, type SessionQuery } from '@/services/userAuditService';

interface UseUserSessionsOptions {
  enabled?: boolean;
}

export function useUserSessions(query: SessionQuery, options?: UseUserSessionsOptions) {
  return useQuery({
    queryKey: ['user-sessions', query],
    queryFn: () => userAuditService.getUserSessions(query),
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });
}
