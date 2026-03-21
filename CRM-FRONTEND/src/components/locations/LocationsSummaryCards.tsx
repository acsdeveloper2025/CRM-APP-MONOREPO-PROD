import React from 'react';
import { Building, Globe, Map, MapPin } from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface LocationsSummaryCardsProps {
  stats: {
    countries: number;
    states: number;
    cities: number;
    pincodes: number;
    areas: number;
  };
}

const items = [
  {
    key: 'countries',
    label: 'Countries',
    description: 'Across all continents',
    icon: Globe,
    tone: 'accent' as const,
  },
  {
    key: 'states',
    label: 'States',
    description: 'Across all countries',
    icon: MapPin,
    tone: 'neutral' as const,
  },
  {
    key: 'cities',
    label: 'Cities',
    description: 'Across all states and countries',
    icon: Building,
    tone: 'positive' as const,
  },
  {
    key: 'pincodes',
    label: 'Pincodes',
    description: 'Postal codes across all cities',
    icon: MapPin,
    tone: 'warning' as const,
  },
  {
    key: 'areas',
    label: 'Areas',
    description: 'Areas across all pincodes',
    icon: Map,
    tone: 'accent' as const,
  },
] as const;

export const LocationsSummaryCards = React.memo(function LocationsSummaryCards({
  stats,
}: LocationsSummaryCardsProps) {
  return (
    <Grid min={200}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key}>
            <Stack gap={3}>
              <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                <Badge variant={item.tone}>{item.label}</Badge>
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
