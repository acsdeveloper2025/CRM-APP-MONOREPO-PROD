import React from 'react';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface ClientManagementSummaryCardsProps {
  stats: {
    clients: number;
    products: number;
    verificationTypes: number;
    documentTypes: number;
    activeCases: number;
  };
}

const items = [
  {
    key: 'clients',
    label: 'Total Clients',
    description: 'Active organizations',
    tone: 'accent' as const,
  },
  {
    key: 'products',
    label: 'Total Products',
    description: 'All products',
    tone: 'neutral' as const,
  },
  {
    key: 'verificationTypes',
    label: 'Verification Types',
    description: 'Available types',
    tone: 'positive' as const,
  },
  {
    key: 'documentTypes',
    label: 'Document Types',
    description: 'Document types',
    tone: 'warning' as const,
  },
  {
    key: 'activeCases',
    label: 'Active Cases',
    description: 'In progress',
    tone: 'danger' as const,
  },
] as const;

export const ClientManagementSummaryCards = React.memo(function ClientManagementSummaryCards({
  stats,
}: ClientManagementSummaryCardsProps) {
  return (
    <Grid min={200}>
      {items.map((item) => (
        <Card key={item.key} style={{ minHeight: '100%' }}>
          <Stack gap={3}>
            <Badge variant={item.tone}>{item.label}</Badge>
            <Text variant="headline">{stats[item.key]}</Text>
            <Text variant="body-sm" tone="muted">{item.description}</Text>
          </Stack>
        </Card>
      ))}
    </Grid>
  );
});
