import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CasesAnalytics } from '@/components/analytics/CasesAnalytics';
import { TasksAnalytics } from '@/components/analytics/TasksAnalytics';
import { AgentPerformanceCharts } from '@/components/analytics/AgentPerformanceCharts';
import { MISDashboard } from '@/components/reports/MISDashboard';
import { useCaseAnalytics } from '@/hooks/useAnalytics';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import {
  BarChart3,
  FileText,
  Users,
  CheckSquare,
  TrendingUp,
  Database,
  Clock
} from 'lucide-react';

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
    }
  });

  const caseSummary = caseAnalytics?.data?.summary;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = (tasksData?.data as any)?.data || [];

  // Calculate task metrics
  const totalTasks = tasks.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED').length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inProgressTasks = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingTasks = tasks.filter((t: any) => t.status === 'PENDING' || t.status === 'ASSIGNED').length;
  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Calculate active agents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeAgents = new Set(tasks.filter((t: any) => t.assigned_to).map((t: any) => t.assigned_to)).size;

  return (
    <div className="space-y-6">
      {/* Page Header Card */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics & Reporting</CardTitle>
          <CardDescription>
            Comprehensive insights into form submissions, case performance, and agent productivity
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Responsive Tab Navigation */}
        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:w-full sm:grid sm:grid-cols-5 gap-1">
              <TabsTrigger value="overview" className="flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4">
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="cases" className="flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4">
                <FileText className="h-4 w-4 shrink-0" />
                <span>Cases</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4">
                <CheckSquare className="h-4 w-4 shrink-0" />
                <span>Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4">
                <Users className="h-4 w-4 shrink-0" />
                <span>Agents</span>
              </TabsTrigger>
              <TabsTrigger value="mis" className="flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4">
                <Database className="h-4 w-4 shrink-0" />
                <span>MIS</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          {/* Overview Dashboard */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {/* Total Cases */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                <FileText className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{caseSummary?.totalCases || 0}</div>
                <p className="text-xs text-gray-600">
                  {caseSummary?.completionRate
                    ? `${caseSummary.completionRate.toFixed(1)}%`
                    : 'No cases'
                  }
                </p>
              </CardContent>
            </Card>

            {/* Total Tasks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <CheckSquare className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTasks}</div>
                <p className="text-xs text-gray-600">
                  {taskCompletionRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            {/* Completed Tasks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                <p className="text-xs text-gray-600">
                  {inProgressTasks} in progress
                </p>
              </CardContent>
            </Card>

            {/* Active Agents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeAgents}</div>
                <p className="text-xs text-gray-600">
                  Field agents
                </p>
              </CardContent>
            </Card>

            {/* Pending Tasks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingTasks}</div>
                <p className="text-xs text-gray-600">
                  Awaiting action
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status Distribution */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Case Status Distribution</CardTitle>
                <CardDescription>Breakdown of cases by current status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(caseSummary?.statusDistribution || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{status.replace(/_/g, ' ')}</span>
                      <span className="text-sm text-gray-600">{count as number}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Insights</CardTitle>
                <CardDescription>Key metrics at a glance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Completion Time</span>
                    <span className="text-sm text-gray-600">
                      {caseSummary?.avgCompletionDays ? `${caseSummary.avgCompletionDays.toFixed(1)} days` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Task Progress</span>
                    <span className="text-sm text-gray-600">
                      {caseSummary?.avgFormCompletion ? `${caseSummary.avgFormCompletion.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Tasks per Case</span>
                    <span className="text-sm text-gray-600">
                      {caseSummary?.totalCases && totalTasks ? (totalTasks / caseSummary.totalCases).toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle>Analytics Overview</CardTitle>
              <CardDescription>
                Explore detailed insights using the tabs above
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="text-center p-4 border rounded-lg">
                  <FileText className="mx-auto h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-semibold">Cases Analytics</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Comprehensive case metrics with distribution by client, product, and status
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <CheckSquare className="mx-auto h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-semibold">Tasks Analytics</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Verification task metrics with status tracking and agent assignment
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Users className="mx-auto h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-semibold">Agent Performance</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Comprehensive agent analytics with productivity metrics and trends
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Database className="mx-auto h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-semibold">MIS Dashboard</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Management Information System with detailed case and task data
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <TrendingUp className="mx-auto h-8 w-8 text-yellow-600 mb-2" />
                  <h3 className="font-semibold">Interactive Charts</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Rich visualizations with filters, trends, and comparative analysis
                  </p>
                </div>
              </div>
            </CardContent>
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
    </div>
  );
};
