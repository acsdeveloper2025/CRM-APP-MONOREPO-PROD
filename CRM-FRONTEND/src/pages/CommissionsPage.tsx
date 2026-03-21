import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { Calculator, BarChart3, FileText, HelpCircle, Download, DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { CommissionCalculationsTab } from '@/components/commission/CommissionCalculationsTab';
import { CommissionStatsTab } from '@/components/commission/CommissionStatsTab';
import { commissionManagementService } from '@/services/commissionManagement';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const CommissionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('calculations');
  const navigate = useNavigate();

  const { data: statsData } = useQuery({
    queryKey: ['commission-stats'],
    queryFn: () => commissionManagementService.getCommissionStats(),
  });

  const stats = statsData?.data || {};
  const totalCommissions = stats.totalCommissions ?? 0;
  const totalAmount = stats.totalAmount ?? 0;
  const pendingCommissions = stats.pendingCommissions ?? 0;
  const pendingAmount = stats.pendingAmount ?? 0;
  const approvedCommissions = stats.approvedCommissions ?? 0;

  const exportAllData = () => {
    console.warn('Exporting all commission data...');
  };

  return (
    <Page
      title="Commission Reports"
      subtitle="View commission calculations, payment tracking, and performance statistics."
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <Button onClick={exportAllData} variant="secondary" icon={<Download size={16} />}>
            Export Report
          </Button>
          <Button variant="secondary" icon={<FileText size={16} />}>
            Documentation
          </Button>
        </Stack>
      }
    >
      <Section>
        <MetricCardGrid
          items={[
            { title: 'Total Calculations', value: totalCommissions, detail: 'All commission records', icon: Calculator, tone: 'accent' },
            { title: 'Pending Approval', value: pendingCommissions, detail: `₹${pendingAmount.toLocaleString()} pending`, icon: Clock, tone: 'warning' },
            { title: 'Approved', value: approvedCommissions, detail: 'Ready for payment', icon: CheckCircle, tone: 'positive' },
            { title: 'Total Amount', value: `₹${totalAmount.toLocaleString()}`, detail: 'All commissions', icon: DollarSign, tone: 'neutral' },
            { title: 'Avg Commission', value: `₹${totalCommissions > 0 ? Math.round(totalAmount / totalCommissions).toLocaleString() : 0}`, detail: 'Per calculation', icon: TrendingUp, tone: 'accent' },
          ]}
        />
      </Section>

      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Commission Ops</Badge>
          <Text as="h2" variant="headline">Keep calculations, analytics, and next-step navigation in one shared surface.</Text>
          <Text variant="body-sm" tone="muted">The reporting tabs and quick navigation remain unchanged; only the page structure is normalized.</Text>
        </Stack>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <Stack direction="horizontal" align="center" gap={2}>
              <Calculator size={18} />
              <Text as="h3" variant="title">Commission Reports & Analytics</Text>
            </Stack>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="calculations">
                  <Calculator size={16} />
                  Commission Calculations
                </TabsTrigger>
                <TabsTrigger value="statistics">
                  <BarChart3 size={16} />
                  Statistics & Analytics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calculations">
                <CommissionCalculationsTab />
              </TabsContent>

              <TabsContent value="statistics">
                <CommissionStatsTab />
              </TabsContent>
            </Tabs>
          </Stack>
        </Card>
      </Section>

      <Section>
        <Grid min={280}>
          <Card tone="muted" onClick={() => navigate('/commission-management')} role="button">
            <Stack direction="horizontal" align="center" gap={3}>
              <Badge variant="accent"><Calculator size={14} /> Commission Management</Badge>
              <Stack gap={1}>
                <Text variant="title">Commission Management</Text>
                <Text variant="body-sm" tone="muted">Configure rates and assignments.</Text>
              </Stack>
            </Stack>
          </Card>

          <Card tone="muted" onClick={() => navigate('/billing')} role="button">
            <Stack direction="horizontal" align="center" gap={3}>
              <Badge variant="info"><FileText size={14} /> Billing & Invoices</Badge>
              <Stack gap={1}>
                <Text variant="title">Billing & Invoices</Text>
                <Text variant="body-sm" tone="muted">Manage invoices and payment operations.</Text>
              </Stack>
            </Stack>
          </Card>
        </Grid>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack direction="horizontal" align="flex-start" gap={3}>
            <Badge variant="positive"><HelpCircle size={14} /> Guide</Badge>
            <Stack gap={2}>
              <Text as="h3" variant="title">Commission Reports Guide</Text>
              <Text variant="body-sm" tone="muted">Commission Calculations: view detailed commission records with payment status and case-level context.</Text>
              <Text variant="body-sm" tone="muted">Statistics & Analytics: monitor trends, top performers, and aggregate metrics.</Text>
              <Text variant="body-sm" tone="muted">Payment Tracking: track paid, pending, and overdue commission payouts.</Text>
              <Text variant="body-sm" tone="muted">Performance Insights: review distribution patterns and field-user performance.</Text>
              <Text variant="body-sm" tone="muted">Commission Management: adjust rates and assignments in the management section.</Text>
            </Stack>
          </Stack>
        </Card>
      </Section>
    </Page>
  );
};
