import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useCaseAnalytics } from '@/hooks/useAnalytics';
import type { CaseAnalytics } from '@/services/analytics';
import { FileText, TrendingUp, CheckCircle2, Clock, XCircle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#10b981',
  APPROVED: '#059669',
  REJECTED: '#ef4444',
  REWORK_REQUIRED: '#f97316',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6b7280',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
  CRITICAL: '#dc2626',
};

const getDateFromRange = (range: string): string => {
  const now = new Date();
  switch (range) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
    case '30d':
      return new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
    case '90d':
      return new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0];
    default:
      return '';
  }
};

export const CasesAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState<'status' | 'client' | 'priority'>('status');

  const {
    data: analyticsData,
    isLoading,
    error,
  } = useCaseAnalytics({
    dateFrom: getDateFromRange(timeRange),
    dateTo: new Date().toISOString().split('T')[0],
  });

  const summary = analyticsData?.data?.summary;
  const cases = analyticsData?.data?.cases || [];

  // Calculate distributions
  const statusDistribution = Object.entries(summary?.statusDistribution || {}).map(
    ([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
      color: STATUS_COLORS[status] || '#6b7280',
    })
  );

  const clientDistribution = cases.reduce((acc: Record<string, number>, c: CaseAnalytics) => {
    const client = c.clientName || 'Unknown';
    acc[client] = (acc[client] || 0) + 1;
    return acc;
  }, {});

  const clientData = Object.entries(clientDistribution)
    .map(([name, count], index) => ({
      name,
      value: count,
      color: `hsl(${index * 45}, 70%, 50%)`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const priorityDistribution = cases.reduce((acc: Record<string, number>, c: CaseAnalytics) => {
    const priority = c.priority || 'MEDIUM';
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});

  const priorityData = Object.entries(priorityDistribution).map(([name, count]) => ({
    name,
    value: count,
    color: PRIORITY_COLORS[name] || '#6b7280',
  }));

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Case Analytics</h3>
          <p className="text-gray-600 text-center">
            There was an error loading the case analytics. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Cases Analytics</h2>
          <p className="mt-1 text-sm sm:text-base text-gray-600">
            Comprehensive case metrics and distribution analysis
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalCases || 0}</div>
            <p className="text-xs text-gray-600">All cases in selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.completedCases || 0}</div>
            <p className="text-xs text-gray-600">
              {summary?.completionRate
                ? `${summary.completionRate.toFixed(1)}% completion rate`
                : '0% completion rate'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avgCompletionDays ? `${summary.avgCompletionDays.toFixed(1)}d` : 'N/A'}
            </div>
            <p className="text-xs text-gray-600">Average days to complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avgFormCompletion ? `${summary.avgFormCompletion.toFixed(1)}%` : 'N/A'}
            </div>
            <p className="text-xs text-gray-600">Average task completion</p>
          </CardContent>
        </Card>
      </div>

      {/* View Type Selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Case Distribution</CardTitle>
              <CardDescription>Breakdown by different dimensions</CardDescription>
            </div>
            <Select
              value={viewType}
              onValueChange={(v) => setViewType(v as 'status' | 'client' | 'priority')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="client">By Client</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Pie Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      viewType === 'status'
                        ? statusDistribution
                        : viewType === 'priority'
                          ? priorityData
                          : clientData
                    }
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: { name?: string; percent?: number }) =>
                      `${props.name || ''}: ${((props.percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(viewType === 'status'
                      ? statusDistribution
                      : viewType === 'priority'
                        ? priorityData
                        : clientData
                    ).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={
                    viewType === 'status'
                      ? statusDistribution
                      : viewType === 'priority'
                        ? priorityData
                        : clientData
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6">
                    {(viewType === 'status'
                      ? statusDistribution
                      : viewType === 'priority'
                        ? priorityData
                        : clientData
                    ).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status Breakdown</CardTitle>
          <CardDescription>Detailed view of cases by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {statusDistribution.map((status) => (
              <div
                key={status.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                  <div>
                    <p className="font-medium">{status.name}</p>
                    <p className="text-sm text-gray-600">
                      {summary?.totalCases
                        ? ((status.value / summary.totalCases) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-bold">{status.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
