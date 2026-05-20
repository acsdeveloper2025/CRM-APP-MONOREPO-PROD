import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { HealthResponse } from '@/types/health';

const POLL_INTERVAL_MS = 10_000;

export function useSystemHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['system-health', 'full'],
    queryFn: async () => {
      const res = await apiService.getRaw<HealthResponse>(
        '/health',
        { level: 'full' },
        {
          // /api/health returns 503 when status=unhealthy. Treat both 200 and 503
          // as resolved values so the hook can render the payload instead of throwing.
          validateStatus: (s) => s === 200 || s === 503,
          retryConfig: { retries: 0 },
        }
      );
      return res.data;
    },
    refetchInterval: () => (document.hidden ? false : POLL_INTERVAL_MS),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: POLL_INTERVAL_MS,
  });
}
