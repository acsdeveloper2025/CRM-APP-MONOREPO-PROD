import React from 'react';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface MetricCardItem {
  title: string;
  value: React.ReactNode;
  detail: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  tone?: React.ComponentProps<typeof Badge>['variant'];
}

interface MetricCardGridProps {
  items: MetricCardItem[];
  min?: number;
}

export const MetricCardGrid = React.memo(function MetricCardGrid({
  items,
  min = 200,
}: MetricCardGridProps) {
  return (
    <Grid min={min}>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.title} className="ui-stat-card">
            <Stack gap={3}>
              <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                <Badge variant={item.tone || 'neutral'}>{item.title}</Badge>
                {Icon ? <Icon size={18} /> : null}
              </Stack>
              <Text variant="headline">{item.value}</Text>
              <Text variant="body-sm" tone="muted">{item.detail}</Text>
            </Stack>
          </Card>
        );
      })}
    </Grid>
  );
});
