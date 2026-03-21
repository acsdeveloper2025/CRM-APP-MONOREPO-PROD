import React from 'react';
import { MISDashboard } from '@/components/reports/MISDashboard';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const MISDashboardPage: React.FC = () => {
  return (
    <Page
      title="MIS Dashboard"
      subtitle="Monitor reporting KPIs and management signals from one shared surface."
      shell
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Management View</Badge>
          <Text as="h2" variant="headline">Use the existing MIS dashboard inside the shared operational shell.</Text>
        </Stack>
      </Section>
      <Section>
        <MISDashboard />
      </Section>
    </Page>
  );
};
