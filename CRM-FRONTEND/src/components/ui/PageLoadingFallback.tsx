import React from 'react';
import { Page } from '@/ui/layout/Page';
import { Grid } from '@/ui/layout/Grid';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Skeleton } from '@/components/ui/skeleton';

export function PageLoadingFallback() {
  return (
    <Page shell title="Loading" subtitle="Preparing workspace...">
      <Section>
        <div className="ui-page-loader">
          <Stack gap={4}>
            <Skeleton style={{ height: 120, borderRadius: 28 }} />
            <Grid min={240}>
              <Skeleton style={{ height: 180, borderRadius: 28 }} />
              <Skeleton style={{ height: 180, borderRadius: 28 }} />
              <Skeleton style={{ height: 180, borderRadius: 28 }} />
            </Grid>
            <Skeleton style={{ height: 320, borderRadius: 28 }} />
          </Stack>
        </div>
      </Section>
    </Page>
  );
}
