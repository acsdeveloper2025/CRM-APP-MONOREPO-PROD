import { Badge } from '@/components/ui/badge';
import type { HealthStatus } from '@/types/health';

const VARIANT: Record<HealthStatus, 'success' | 'warning' | 'destructive'> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'destructive',
};

const LABEL: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unhealthy: 'Unhealthy',
};

interface Props {
  status: HealthStatus;
}

export function StatusPill({ status }: Props) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
