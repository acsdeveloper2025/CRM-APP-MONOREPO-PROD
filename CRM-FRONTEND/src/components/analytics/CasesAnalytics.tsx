import React, { useMemo, useState } from 'react';
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
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useCaseAnalytics } from '@/hooks/useAnalytics';
import { FileText, TrendingUp, CheckCircle2, Clock, XCircle } from 'lucide-react';

// Canonical case-status enum (5 values, locked 2026-05-13 workflow audit).
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  ASSIGNED: '#8b5cf6',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#10b981',
  REVOKED: '#ef4444',
};

// Canonical priority enum (4 values, locked P16 2026-05-15).
const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6b7280',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
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

  // P1 + P7 truthful-sweep 2026-05-27: all 3 distributions come from BE
  // aggregate (Promise.all of 3 GROUP BY queries) — no FE reduce over
  // a paginated `cases[]` row dump.
  // P10 truthful-sweep 2026-05-27: useMemo so the chart `data` prop is
  // referentially stable across viewType-toggle re-renders (recharts
  // bails out of re-layout when the array ref doesn't change).
  const statusDistribution = useMemo(
    () =>
      Object.entries(summary?.statusDistribution || {}).map(([status, count]) => ({
        name: status.replace(/_/g, ' '),
        value: count,
        color: STATUS_COLORS[status] || '#6b7280',
      })),
    [summary?.statusDistribution]
  );

  const clientData = useMemo(
    () =>
      Object.entries(summary?.clientDistribution || {})
        .map(([name, count], index) => ({
          name,
          value: count,
          color: `hsl(${index * 45}, 70%, 50%)`,
        }))
        .sort((a, b) => b.value - a.value),
    [summary?.clientDistribution]
  );

  const priorityData = useMemo(
    () =>
      Object.entries(summary?.priorityDistribution || {}).map(([name, count]) => ({
        name,
        value: count,
        color: PRIORITY_COLORS[name] || '#6b7280',
      })),
    [summary?.priorityDistribution]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted/60 animate-pulse rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted/60 animate-pulse rounded w-16" />
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
          <p className="text-muted-foreground text-center">
            There was an error loading the case analytics. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Time-range selector (page H1 lives in AnalyticsCasesPage wrapper). */}
      <div className="flex justify-end">
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

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalCases || 0}</div>
            <p className="text-xs text-muted-foreground">All cases in selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.completedCases || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.completionRate
                ? `${summary.completionRate.toFixed(1)}% completion rate`
                : '0% completion rate'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avgCompletionDays ? `${summary.avgCompletionDays.toFixed(1)}d` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Average days to complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avgFormCompletion ? `${summary.avgFormCompletion.toFixed(1)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Average task completion</p>
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
          {/* P7 truthful-sweep 2026-05-27: single Bar chart per view-type.
              Previous shape had Pie + Bar plotting identical data +
              a "Status Breakdown" card grid duplicating the same counts —
              three widgets, one dataset. Bar scales to many categories
              (client view can be top-10); pie tooltip already conveys %. */}
          <div className="h-[360px]">
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
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
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
        </CardContent>
      </Card>
    </div>
  );
};
