import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Plus, TrendingUp } from 'lucide-react';
import { CompletionRateChart } from '@/components/reports/CompletionRateChart';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';
import { MISDashboard } from '@/components/reports/MISDashboard';
import { MISReportsTable } from '@/components/reports/MISReportsTable';
import { ReportSummaryCards } from '@/components/reports/ReportSummaryCards';
import { TurnaroundTimeChart } from '@/components/reports/TurnaroundTimeChart';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { reportsService } from '@/services/reports';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showGenerateReport, setShowGenerateReport] = useState(false);
  const [misReportsPage, setMisReportsPage] = useState(1);
  const pageSize = 20;

  React.useEffect(() => {
    setMisReportsPage(1);
  }, [activeTab]);

  const { data: misReportsData, isLoading: misReportsLoading } = useQuery({
    queryKey: ['mis-reports', misReportsPage, pageSize],
    queryFn: () => reportsService.getMISReports({ page: misReportsPage, limit: pageSize }),
    enabled: activeTab === 'mis-reports',
  });

  const { data: reportSummariesData } = useQuery({
    queryKey: ['report-summaries'],
    queryFn: () => reportsService.getReportSummaries(),
    enabled: activeTab === 'overview',
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => reportsService.getReportsDashboardData({}),
    enabled: activeTab === 'overview',
  });

  const { data: turnaroundData } = useQuery({
    queryKey: ['turnaround-time'],
    queryFn: () => reportsService.getTurnaroundTimeReport({}),
    enabled: activeTab === 'analytics',
  });

  const { data: completionData } = useQuery({
    queryKey: ['completion-rate'],
    queryFn: () => reportsService.getCompletionRateReport({}),
    enabled: activeTab === 'analytics',
  });

  const handleExportData = async (format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL') => {
    try {
      const blob = await reportsService.exportMISReports({}, format);
      const filename = `mis_reports_${format.toLowerCase()}_${new Date().toISOString().split('T')[0]}.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const stats = useMemo(() => {
    const misReports = misReportsData?.data || [];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      misReports: {
        total: misReports.length,
        recent: misReports.filter((report) => new Date(report.generatedAt) >= weekAgo).length,
      },
    };
  }, [misReportsData]);

  const overviewCards = [
    {
      title: 'Generated Reports',
      value: dashboardData?.data?.totalReports || 0,
      detail: `${dashboardData?.data?.recentReports || 0} this week`,
      icon: BarChart3,
      tone: 'accent' as const,
    },
    {
      title: 'MIS Reports',
      value: stats.misReports.total,
      detail: `${stats.misReports.recent} generated in the last 7 days`,
      icon: TrendingUp,
      tone: 'neutral' as const,
    },
    {
      title: 'Avg Turnaround',
      value: `${dashboardData?.data?.averageTurnaround || 0}h`,
      detail: 'Target: 24h',
      icon: TrendingUp,
      tone: 'warning' as const,
    },
    {
      title: 'Completion Rate',
      value: `${completionData?.data?.completionRate || 0}%`,
      detail: `${completionData?.data?.completedCases || 0} completed cases`,
      icon: BarChart3,
      tone: 'positive' as const,
    },
  ];

  return (
    <Page
      title="MIS Reports"
      subtitle="Generate MIS reports and analyze operational performance metrics."
      shell
      actions={
        activeTab === 'mis-reports' ? (
          <Stack direction="horizontal" gap={2} wrap="wrap">
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => handleExportData('EXCEL')}>
              Export
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setShowGenerateReport(true)}>
              Generate Report
            </Button>
          </Stack>
        ) : undefined
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="secondary">Reporting Hub</Badge>
          <Text as="h2" variant="headline">Keep reporting, analytics, and MIS dashboards in one operational surface.</Text>
          <Text variant="body-sm" tone="muted">
            The page now follows the shared shell while preserving existing tables, charts, and report-generation behavior.
          </Text>
        </Stack>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <Stack gap={4}>
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="mis-reports">
                    <Stack direction="horizontal" gap={2} align="center">
                      <span>MIS Reports</span>
                      {stats.misReports.total > 0 ? <Badge variant="secondary">{stats.misReports.total}</Badge> : null}
                    </Stack>
                  </TabsTrigger>
                  <TabsTrigger value="mis-dashboard">MIS Dashboard</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>
                <Badge variant="neutral">{activeTab.replace('-', ' ')}</Badge>
              </Box>

              <TabsContent value="overview">
                <Stack gap={4}>
                  <ReportSummaryCards summaries={reportSummariesData?.data || []} />
                  <MetricCardGrid items={overviewCards} min={220} />
                </Stack>
              </TabsContent>

              <TabsContent value="mis-reports">
                <Stack gap={4}>
                  <MISReportsTable data={misReportsData?.data || []} isLoading={misReportsLoading} />
                  {misReportsData?.pagination ? (
                    <PaginationStatusCard
                      page={misReportsPage}
                      limit={pageSize}
                      total={misReportsData.pagination.total}
                      totalPages={misReportsData.pagination.totalPages || 1}
                      onPrevious={() => setMisReportsPage((prev) => Math.max(1, prev - 1))}
                      onNext={() => setMisReportsPage((prev) => prev + 1)}
                    />
                  ) : null}
                </Stack>
              </TabsContent>

              <TabsContent value="mis-dashboard">
                <MISDashboard />
              </TabsContent>

              <TabsContent value="analytics">
                <Box style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                  <TurnaroundTimeChart data={turnaroundData?.data} />
                  <CompletionRateChart data={completionData?.data} />
                </Box>
              </TabsContent>
            </Stack>
          </Tabs>
        </Card>
      </Section>

      <GenerateReportDialog open={showGenerateReport} onOpenChange={setShowGenerateReport} />
    </Page>
  );
}
