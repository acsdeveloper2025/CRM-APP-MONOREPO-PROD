import React from 'react';
import { Activity, Navigation, Radio, UserCheck } from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import type { FieldMonitoringStats } from '@/services/fieldMonitoring';

interface FieldMonitoringSummaryCardsProps {
  stats: FieldMonitoringStats;
}

const items = [
  {
    key: 'totalFieldUsers',
    title: 'Total Field Users',
    description: 'Eligible field executives',
    icon: UserCheck,
    tone: 'accent' as const,
  },
  {
    key: 'activeToday',
    title: 'Active Today',
    description: 'Operational activity today',
    icon: Activity,
    tone: 'positive' as const,
  },
  {
    key: 'activeNow',
    title: 'Active Now',
    description: 'Fresh activity in last 15 minutes',
    icon: Radio,
    tone: 'warning' as const,
  },
  {
    key: 'offlineCount',
    title: 'Offline',
    description: 'No recent heartbeat',
    icon: Navigation,
    tone: 'danger' as const,
  },
] satisfies Array<{
  key: keyof FieldMonitoringStats;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  tone: 'accent' | 'positive' | 'warning' | 'danger';
}>;

export const FieldMonitoringSummaryCards = React.memo(function FieldMonitoringSummaryCards({
  stats,
}: FieldMonitoringSummaryCardsProps) {
  return (
    <Grid min={220}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} className="ui-stat-card">
            <Stack gap={3}>
              <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                <Badge variant={item.tone}>{item.title}</Badge>
                <Icon size={18} />
              </Stack>
              <Text variant="headline">{stats[item.key]}</Text>
              <Text variant="body-sm" tone="muted">{item.description}</Text>
            </Stack>
          </Card>
        );
      })}
    </Grid>
  );
});
