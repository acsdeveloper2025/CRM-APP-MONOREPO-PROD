import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { CasesAnalytics } from '@/components/analytics/CasesAnalytics';
import { TasksAnalytics } from '@/components/analytics/TasksAnalytics';
import { AgentPerformanceCharts } from '@/components/analytics/AgentPerformanceCharts';
import { MISDashboard } from '@/components/reports/MISDashboard';
import { useCaseAnalytics } from '@/hooks/useAnalytics';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import {
  BarChart3,
  FileText,
  Users,
  CheckSquare,
  TrendingUp,
  Database,
  Clock
} from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Get overview data for the summary cards
  const { data: caseAnalytics } = useCaseAnalytics({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const { data: tasksData } = useQuery({
    queryKey: ['verification-tasks-overview'],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '100',
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0]
      });
      return apiService.get(`/verification-tasks?${params.toString()}`);
    },
    enabled: activeTab === 'overview',
    staleTime: 60 * 1000,
  });

  const caseSummary = caseAnalytics?.data?.summary;
  
  // Extract task statistics and pagination info from backend
  const taskPayload = (tasksData?.data as { 
    data?: { 
      statistics: {
        pending: number;
        assigned: number;
        inProgress: number;
        completed: number;
        highPriority: number;
        totalAgents: number;
      }, 
      pagination: { total: number } 
    } 
  })?.data;
  const taskStats = taskPayload?.statistics;
  const totalTasks = taskPayload?.pagination?.total || 0;
  
  const completedTasks = taskStats?.completed || 0;
  const inProgressTasks = taskStats?.inProgress || 0;
  const pendingTasks = (taskStats?.pending || 0) + (taskStats?.assigned || 0);
  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Use backend aggregated agent count
  const activeAgents = taskStats?.totalAgents || 0;

  const overviewCards = [
    {
      title: 'Total Cases',
      value: caseSummary?.totalCases || 0,
      detail: caseSummary?.completionRate ? `${caseSummary.completionRate.toFixed(1)}% completion` : 'No cases',
      icon: FileText,
      tone: 'accent' as const,
    },
    {
      title: 'Total Tasks',
      value: totalTasks,
      detail: `${taskCompletionRate.toFixed(1)}% complete`,
      icon: CheckSquare,
      tone: 'neutral' as const,
    },
    {
      title: 'Completed',
      value: completedTasks,
      detail: `${inProgressTasks} in progress`,
      icon: TrendingUp,
      tone: 'positive' as const,
    },
    {
      title: 'Active Agents',
      value: activeAgents,
      detail: 'Field agents',
      icon: Users,
      tone: 'warning' as const,
    },
    {
      title: 'Pending',
      value: pendingTasks,
      detail: 'Awaiting action',
      icon: Clock,
      tone: 'danger' as const,
    },
  ];

  return (
    <Page
      title="Analytics & Reporting"
      subtitle="Comprehensive insights into form submissions, case performance, and agent productivity."
      shell
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Insights Hub</Badge>
          <Text as="h2" variant="headline">Move between operational metrics and management reporting without leaving the same shell.</Text>
          <Text variant="body-sm" tone="muted">Overview cards stay visible up front, while deeper analytics remain grouped by cases, tasks, agents, and MIS.</Text>
        </Stack>
      </Section>

      <Section>
      <Tabs value={activeTab} onValueChange={setActiveTab} {...{ className: "space-y-6" }}>
        <div {...{ className: "relative" }}>
          <div {...{ className: "overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0" }}>
            <TabsList {...{ className: "inline-flex w-auto min-w-full sm:w-full sm:grid sm:grid-cols-5 gap-1" }}>
              <TabsTrigger value="overview" {...{ className: "flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4" }}>
                <BarChart3 {...{ className: "h-4 w-4 shrink-0" }} />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="cases" {...{ className: "flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4" }}>
                <FileText {...{ className: "h-4 w-4 shrink-0" }} />
                <span>Cases</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" {...{ className: "flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4" }}>
                <CheckSquare {...{ className: "h-4 w-4 shrink-0" }} />
                <span>Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="agents" {...{ className: "flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4" }}>
                <Users {...{ className: "h-4 w-4 shrink-0" }} />
                <span>Agents</span>
              </TabsTrigger>
              <TabsTrigger value="mis" {...{ className: "flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4" }}>
                <Database {...{ className: "h-4 w-4 shrink-0" }} />
                <span>MIS</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" {...{ className: "space-y-4 sm:space-y-6" }}>
          <MetricCardGrid items={overviewCards} />

          <div {...{ className: "grid gap-4 grid-cols-1 lg:grid-cols-2" }}>
            <Card>
              <Stack gap={3}>
                <Stack gap={1}>
                  <Text as="h3" variant="headline">Case Status Distribution</Text>
                  <Text variant="body-sm" tone="muted">Breakdown of cases by current status</Text>
                </Stack>
                <div {...{ className: "space-y-3" }}>
                  {Object.entries(caseSummary?.statusDistribution || {}).map(([status, count]) => (
                    <div key={status} {...{ className: "flex items-center justify-between" }}>
                      <span {...{ className: "text-sm font-medium" }}>{status.replace(/_/g, ' ')}</span>
                      <span {...{ className: "text-sm text-gray-600" }}>{count as number}</span>
                    </div>
                  ))}
                </div>
              </Stack>
            </Card>

            <Card>
              <Stack gap={3}>
                <Stack gap={1}>
                  <Text as="h3" variant="headline">Quick Insights</Text>
                  <Text variant="body-sm" tone="muted">Key metrics at a glance</Text>
                </Stack>
                <div {...{ className: "space-y-3" }}>
                  <div {...{ className: "flex items-center justify-between" }}>
                    <span {...{ className: "text-sm font-medium" }}>Avg Completion Time</span>
                    <span {...{ className: "text-sm text-gray-600" }}>
                      {caseSummary?.avgCompletionDays ? `${caseSummary.avgCompletionDays.toFixed(1)} days` : 'N/A'}
                    </span>
                  </div>
                  <div {...{ className: "flex items-center justify-between" }}>
                    <span {...{ className: "text-sm font-medium" }}>Task Progress</span>
                    <span {...{ className: "text-sm text-gray-600" }}>
                      {caseSummary?.avgFormCompletion ? `${caseSummary.avgFormCompletion.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div {...{ className: "flex items-center justify-between" }}>
                    <span {...{ className: "text-sm font-medium" }}>Tasks per Case</span>
                    <span {...{ className: "text-sm text-gray-600" }}>
                      {caseSummary?.totalCases && totalTasks ? (totalTasks / caseSummary.totalCases).toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>
              </Stack>
            </Card>
          </div>

          <Card>
            <Stack gap={4}>
              <Stack gap={1}>
                <Text as="h3" variant="headline">Analytics Overview</Text>
                <Text variant="body-sm" tone="muted">Explore detailed insights using the tabs above</Text>
              </Stack>
              <div {...{ className: "grid gap-4 md:grid-cols-2 lg:grid-cols-5" }}>
                <div {...{ className: "text-center p-4 border rounded-lg" }}>
                  <FileText {...{ className: "mx-auto h-8 w-8 text-green-600 mb-2" }} />
                  <h3 {...{ className: "font-semibold" }}>Cases Analytics</h3>
                  <p {...{ className: "text-sm text-gray-600 mt-1" }}>
                    Comprehensive case metrics with distribution by client, product, and status
                  </p>
                </div>
                <div {...{ className: "text-center p-4 border rounded-lg" }}>
                  <CheckSquare {...{ className: "mx-auto h-8 w-8 text-green-600 mb-2" }} />
                  <h3 {...{ className: "font-semibold" }}>Tasks Analytics</h3>
                  <p {...{ className: "text-sm text-gray-600 mt-1" }}>
                    Verification task metrics with status tracking and agent assignment
                  </p>
                </div>
                <div {...{ className: "text-center p-4 border rounded-lg" }}>
                  <Users {...{ className: "mx-auto h-8 w-8 text-green-600 mb-2" }} />
                  <h3 {...{ className: "font-semibold" }}>Agent Performance</h3>
                  <p {...{ className: "text-sm text-gray-600 mt-1" }}>
                    Comprehensive agent analytics with productivity metrics and trends
                  </p>
                </div>
                <div {...{ className: "text-center p-4 border rounded-lg" }}>
                  <Database {...{ className: "mx-auto h-8 w-8 text-green-600 mb-2" }} />
                  <h3 {...{ className: "font-semibold" }}>MIS Dashboard</h3>
                  <p {...{ className: "text-sm text-gray-600 mt-1" }}>
                    Management Information System with detailed case and task data
                  </p>
                </div>
                <div {...{ className: "text-center p-4 border rounded-lg" }}>
                  <TrendingUp {...{ className: "mx-auto h-8 w-8 text-yellow-600 mb-2" }} />
                  <h3 {...{ className: "font-semibold" }}>Interactive Charts</h3>
                  <p {...{ className: "text-sm text-gray-600 mt-1" }}>
                    Rich visualizations with filters, trends, and comparative analysis
                  </p>
                </div>
              </div>
            </Stack>
          </Card>
        </TabsContent>

        <TabsContent value="cases">
          <CasesAnalytics />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksAnalytics />
        </TabsContent>

        <TabsContent value="agents">
          <AgentPerformanceCharts />
        </TabsContent>

        <TabsContent value="mis">
          <MISDashboard />
        </TabsContent>
      </Tabs>
      </Section>
    </Page>
  );
};
