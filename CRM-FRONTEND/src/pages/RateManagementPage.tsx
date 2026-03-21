import { useState } from 'react';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { Badge } from '@/ui/components/badge';
import { rateManagementService } from '@/services/rateManagement';
import { RateTypesTab } from '@/components/rate-management/RateTypesTab';
import { RateTypeAssignmentTab } from '@/components/rate-management/RateTypeAssignmentTab';
import { RateAssignmentTab } from '@/components/rate-management/RateAssignmentTab';
import { RateViewReportTab } from '@/components/rate-management/RateViewReportTab';
import { DocumentTypeRatesTab } from '@/components/rate-management/DocumentTypeRatesTab';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Badge as UiBadge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export function RateManagementPage() {
  const [activeTab, setActiveTab] = useState('rate-types');

  const { data: statsData } = useStandardizedQuery({
    queryKey: ['rate-management-stats'],
    queryFn: () => rateManagementService.getRateManagementStats(),
    errorContext: 'Loading Rate Management Statistics',
    errorFallbackMessage: 'Failed to load rate management statistics',
  });

  const stats = statsData?.data || {
    rateTypes: { total: 0, active: 0, inactive: 0 },
    rates: { total: 0, active: 0, inactive: 0, averageAmount: 0 },
    documentTypeRates: { totalRates: 0, totalClients: 0, totalProducts: 0, totalDocumentTypes: 0, averageRate: 0, minRate: 0, maxRate: 0 }
  };

  return (
    <Page
      title="Rate Management"
      subtitle="Manage rate types, assignments, and pricing for verification services."
      shell
    >
      <Section>
        <Stack gap={3}>
          <UiBadge variant="accent">Pricing System</UiBadge>
          <Text as="h2" variant="headline">Keep the rate workflow visible while preserving the existing pricing logic.</Text>
          <Text variant="body-sm" tone="muted">
            This page now follows the shared shell and section rhythm without changing any of the tab-level rate management behavior.
          </Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            {
              title: 'Rate Types',
              value: stats.rateTypes.total,
              detail: `${stats.rateTypes.active} active${stats.rateTypes.inactive > 0 ? ` • ${stats.rateTypes.inactive} inactive` : ''}`,
              tone: 'accent',
            },
            {
              title: 'Verification Rates',
              value: stats.rates.total,
              detail: `${stats.rates.active} active${stats.rates.inactive > 0 ? ` • ${stats.rates.inactive} inactive` : ''}`,
              tone: 'neutral',
            },
            {
              title: 'Document Rates',
              value: stats.documentTypeRates?.totalRates || 0,
              detail: `${stats.documentTypeRates?.totalDocumentTypes || 0} document types`,
              tone: 'warning',
            },
            {
              title: 'Average Rate',
              value: `₹${stats.rates.averageAmount?.toFixed(0) || '0'}`,
              detail: 'Verification services',
              tone: 'positive',
            },
            {
              title: 'System Status',
              value: 'Operational',
              detail: 'All systems running',
              tone: 'accent',
            },
          ]}
        />
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Tabs value={activeTab} onValueChange={setActiveTab} {...{ className: "w-full" }}>
            <TabsList {...{ className: "grid w-full grid-cols-5" }}>
              <TabsTrigger value="rate-types" {...{ className: "text-sm" }}>1. Create Rate Types</TabsTrigger>
              <TabsTrigger value="rate-type-assignment" {...{ className: "text-sm" }}>2. Rate Type Assignment</TabsTrigger>
              <TabsTrigger value="rate-assignment" {...{ className: "text-sm" }}>3. Rate Assignment</TabsTrigger>
              <TabsTrigger value="rate-view-report" {...{ className: "text-sm" }}>4. Rate View/Report</TabsTrigger>
              <TabsTrigger value="document-type-rates" {...{ className: "text-sm" }}>5. Document Type Rates</TabsTrigger>
            </TabsList>

            <div {...{ className: "mt-6" }}>
              <TabsContent value="rate-types" {...{ className: "space-y-4" }}>
                <div {...{ className: "border rounded-lg p-4" }}>
                  <h3 {...{ className: "text-lg font-semibold mb-2" }}>Rate Types Management</h3>
                  <p {...{ className: "text-sm text-gray-600 mb-4" }}>
                    Create and manage rate types: Local, Local1, Local2, OGL, OGL1, OGL2, Outstation
                  </p>
                  <RateTypesTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-type-assignment" {...{ className: "space-y-4" }}>
                <div {...{ className: "border rounded-lg p-4" }}>
                  <h3 {...{ className: "text-lg font-semibold mb-2" }}>Rate Type Assignment</h3>
                  <p {...{ className: "text-sm text-gray-600 mb-4" }}>
                    Assign rate types to Client → Product → Verification Type combinations
                  </p>
                  <RateTypeAssignmentTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-assignment" {...{ className: "space-y-4" }}>
                <div {...{ className: "border rounded-lg p-4" }}>
                  <h3 {...{ className: "text-lg font-semibold mb-2" }}>Rate Assignment</h3>
                  <p {...{ className: "text-sm text-gray-600 mb-4" }}>
                    Set actual rate amounts for assigned rate types
                  </p>
                  <RateAssignmentTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-view-report" {...{ className: "space-y-4" }}>
                <div {...{ className: "border rounded-lg p-4" }}>
                  <h3 {...{ className: "text-lg font-semibold mb-2" }}>Rate View & Reports</h3>
                  <p {...{ className: "text-sm text-gray-600 mb-4" }}>
                    View and manage all configured rates with comprehensive filtering and reporting
                  </p>
                  <RateViewReportTab />
                </div>
              </TabsContent>

              <TabsContent value="document-type-rates" {...{ className: "space-y-4" }}>
                <div {...{ className: "border rounded-lg p-4" }}>
                  <h3 {...{ className: "text-lg font-semibold mb-2" }}>Document Type Rates</h3>
                  <p {...{ className: "text-sm text-gray-600 mb-4" }}>
                    Configure pricing for document verification services (independent of rate types)
                  </p>
                  <DocumentTypeRatesTab />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <Stack gap={1}>
              <Text as="h3" variant="headline">Rate Management Workflow</Text>
              <Text variant="body-sm" tone="muted">Follow these steps to set up rates for verification services.</Text>
            </Stack>
            <div {...{ className: "grid gap-4 md:grid-cols-5" }}>
              <div {...{ className: "flex items-start gap-3" }}>
                <div {...{ className: "w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold" }}>1</div>
                <div>
                  <h4 {...{ className: "font-semibold" }}>Create Rate Types</h4>
                  <p {...{ className: "text-sm text-gray-600" }}>Define rate categories like Local, OGL, Outstation</p>
                </div>
              </div>
              <div {...{ className: "flex items-start gap-3" }}>
                <div {...{ className: "w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold" }}>2</div>
                <div>
                  <h4 {...{ className: "font-semibold" }}>Assign Rate Types</h4>
                  <p {...{ className: "text-sm text-gray-600" }}>Map rate types to client-product-verification combinations</p>
                </div>
              </div>
              <div {...{ className: "flex items-start gap-3" }}>
                <div {...{ className: "w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold" }}>3</div>
                <div>
                  <h4 {...{ className: "font-semibold" }}>Set Rate Amounts</h4>
                  <p {...{ className: "text-sm text-gray-600" }}>Configure actual pricing for each assigned rate type</p>
                </div>
              </div>
              <div {...{ className: "flex items-start gap-3" }}>
                <div {...{ className: "w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold" }}>4</div>
                <div>
                  <h4 {...{ className: "font-semibold" }}>View & Manage</h4>
                  <p {...{ className: "text-sm text-gray-600" }}>Monitor and update rates with comprehensive reporting</p>
                </div>
              </div>
              <div {...{ className: "flex items-start gap-3" }}>
                <div {...{ className: "w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold" }}>5</div>
                <div>
                  <h4 {...{ className: "font-semibold" }}>Document Type Rates</h4>
                  <p {...{ className: "text-sm text-gray-600" }}>Set pricing for document verification without rate types</p>
                </div>
              </div>
            </div>
          </Stack>
        </Card>
      </Section>
    </Page>
  );
}
