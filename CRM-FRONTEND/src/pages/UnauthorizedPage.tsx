import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export function UnauthorizedPage() {
  return (
    <Page>
      <Section>
        <Card tone="strong" staticCard style={{ maxWidth: '34rem', margin: '12vh auto 0' }}>
          <Stack gap={3} style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div>
              <Badge variant="danger">Access Denied</Badge>
            </div>
            <ShieldAlert size={40} style={{ color: 'var(--ui-danger)', margin: '0 auto' }} />
            <Text as="h1" variant="headline">You do not have access to this module</Text>
            <Text tone="muted">
              Your current role does not include permission to open this area of the CRM.
            </Text>
          </Stack>
        </Card>
      </Section>
    </Page>
  );
}
