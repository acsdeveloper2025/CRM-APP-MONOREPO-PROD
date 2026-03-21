import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card as LegacyCard, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Button as LegacyButton } from '@/ui/components/button';
import {
  Users,
  FileText,
  Download,
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp
} from 'lucide-react';
import { FieldUserAssignmentsTab } from '@/components/commission/FieldUserAssignmentsTab';
import { commissionManagementService } from '@/services/commissionManagement';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const CommissionManagementPage: React.FC = () => {
  const { data: statsData } = useQuery({
    queryKey: ['commission-stats'],
    queryFn: () => commissionManagementService.getCommissionStats(),
  });

  const stats = statsData?.data || {
    totalCommissions: 0,
    totalAmount: 0,
    pendingCommissions: 0,
    pendingAmount: 0,
    paidCommissions: 0,
    paidAmount: 0,
    activeFieldUsers: 0,
    averageCommissionPerCase: 0,
  };

  return (
    <Page
      title="Commission Management"
      subtitle="Manage field employee commissions, rate assignments, and payments."
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <LegacyButton variant="outline" size="sm">
            <Download {...{ className: "h-4 w-4 mr-2" }} />
            Export Report
          </LegacyButton>
          <LegacyButton variant="outline" size="sm">
            <FileText {...{ className: "h-4 w-4 mr-2" }} />
            Documentation
          </LegacyButton>
        </Stack>
      }
    >
      <Section>
        <MetricCardGrid
          items={[
            { title: 'Total Paid', value: `₹${stats.paidAmount?.toLocaleString() || 0}`, detail: `${stats.paidCommissions || 0} commissions paid`, icon: DollarSign, tone: 'positive' },
            { title: 'Pending', value: `₹${stats.pendingAmount?.toLocaleString() || 0}`, detail: `${stats.pendingCommissions || 0} awaiting payment`, icon: Clock, tone: 'warning' },
            { title: 'Active Agents', value: stats.activeFieldUsers || 0, detail: 'Field agents with assignments', icon: Users, tone: 'accent' },
            { title: 'Avg Commission', value: `₹${stats.averageCommissionPerCase?.toLocaleString() || 0}`, detail: 'Per completed task', icon: TrendingUp, tone: 'neutral' },
            { title: 'This Month', value: `₹${stats.totalAmount?.toLocaleString() || 0}`, detail: 'Total commissions', icon: CheckCircle, tone: 'accent' },
          ]}
        />
      </Section>

      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Assignment Control</Badge>
          <Text as="h2" variant="headline">Keep rate assignment and payment visibility inside the shared shell.</Text>
          <Text variant="body-sm" tone="muted">Assignment workflows stay intact; only the page composition and summary layer change.</Text>
        </Stack>
      </Section>

      <Section>
        <LegacyCard>
          <CardHeader>
            <CardTitle {...{ className: "flex items-center gap-2" }}>
              <Users {...{ className: "h-5 w-5" }} />
              Commission Rate Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldUserAssignmentsTab />
          </CardContent>
        </LegacyCard>
      </Section>

      <Section>
        <LegacyCard {...{ className: "bg-slate-100/70 dark:bg-slate-800/50" }}>
          <CardContent {...{ className: "p-4" }}>
            <div {...{ className: "flex items-start gap-3" }}>
              <div {...{ className: "p-2 bg-green-100 rounded-lg" }}>
                <FileText {...{ className: "h-5 w-5 text-green-600" }} />
              </div>
              <div>
                <h3 {...{ className: "font-semibold text-gray-900 mb-2" }}>Commission Management Guide</h3>
                <div {...{ className: "space-y-1 text-sm text-gray-600" }}>
                  <p>• <strong>Rate Assignments:</strong> Assign commission rates to field users using existing rate types from the rate management system</p>
                  <p>• <strong>Rate Selection:</strong> Choose from available rate types when creating assignments</p>
                  <p>• <strong>Auto-Calculation:</strong> Commissions are automatically calculated when field users complete cases</p>
                  <p>• <strong>Commission Reports:</strong> View calculated commissions and payment tracking in Billing & Commission → Commissions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </LegacyCard>
      </Section>
    </Page>
  );
};
