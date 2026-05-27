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
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import { CheckSquare, Clock, DollarSign, FileCheck, XCircle } from 'lucide-react';

// P2 + P6 + P7 truthful-sweep 2026-05-27: page now reads ONLY from
// /verification-tasks/stats (aggregate-only endpoint). Previous shape
// fetched /verification-tasks?limit=100 (144 KB at 113 tasks; 12+ MB
// at 10k) and FE-reduced over `tasks[]` to build type + agent
// distributions, silently truncating above 100. BE now ships
// verificationTypeDistribution + agentDistribution + total{Estimated,
// Actual}Amount in /stats — single small payload.
//
// Chart shape simplified: ONE Bar chart per viewType (status / type /
// agent). Was Pie + Bar + Status-Breakdown grid (3 widgets, identical
// data). Bar scales to top-10 type/agent views.

interface TasksStatsResponse {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  revoked: number;
  urgent: number;
  highPriority: number;
  agingOver3Days: number;
  completedToday: number;
  completedThisWeek: number;
  avgTurnaroundDays: number;
  // P2 add: money totals from BE SUM (added to /stats 2026-05-27;
  // already present on the list `statistics` block).
  totalEstimatedAmount?: number;
  totalActualAmount?: number;
  // P6 add: distribution Maps.
  verificationTypeDistribution: Record<string, number>;
  agentDistribution: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#8b5cf6',
  COMPLETED: '#10b981',
  REVOKED: '#ef4444',
};

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

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

export const TasksAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState<'status' | 'type' | 'agent'>('status');

  const {
    data: statsRes,
    isLoading,
    error,
  } = useQuery<ApiResponse<TasksStatsResponse>>({
    queryKey: ['verification-tasks-stats', timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: getDateFromRange(timeRange),
        dateTo: new Date().toISOString().split('T')[0],
      });
      return apiService.get<TasksStatsResponse>(`/verification-tasks/stats?${params.toString()}`);
    },
  });

  const stats = statsRes?.data;

  const totalTasks = stats?.total ?? 0;
  const completedTasks = stats?.completed ?? 0;
  const inProgressTasks = stats?.inProgress ?? 0;
  const pendingTasks = (stats?.pending ?? 0) + (stats?.assigned ?? 0);
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const totalActualAmount = stats?.totalActualAmount ?? 0;
  const totalEstimatedAmount = stats?.totalEstimatedAmount ?? 0;

  // P10 truthful-sweep 2026-05-27: memoize chart data so viewType
  // toggle doesn't rebuild every array on every render.
  const statusData = useMemo(
    () =>
      [
        { name: 'Pending', value: stats?.pending ?? 0, color: STATUS_COLORS.PENDING },
        { name: 'Assigned', value: stats?.assigned ?? 0, color: STATUS_COLORS.ASSIGNED },
        { name: 'In Progress', value: stats?.inProgress ?? 0, color: STATUS_COLORS.IN_PROGRESS },
        { name: 'Completed', value: stats?.completed ?? 0, color: STATUS_COLORS.COMPLETED },
        { name: 'Revoked', value: stats?.revoked ?? 0, color: STATUS_COLORS.REVOKED },
      ].filter((d) => d.value > 0),
    [stats?.pending, stats?.assigned, stats?.inProgress, stats?.completed, stats?.revoked]
  );

  const typeData = useMemo(
    () =>
      Object.entries(stats?.verificationTypeDistribution ?? {})
        .map(([name, value], index) => ({
          name,
          value,
          color: `hsl(${index * 45}, 70%, 50%)`,
        }))
        .sort((a, b) => b.value - a.value),
    [stats?.verificationTypeDistribution]
  );

  const agentData = useMemo(
    () =>
      Object.entries(stats?.agentDistribution ?? {})
        .map(([name, value], index) => ({
          name,
          value,
          color: `hsl(${index * 45}, 70%, 50%)`,
        }))
        .sort((a, b) => b.value - a.value),
    [stats?.agentDistribution]
  );

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

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Task Analytics</h3>
          <p className="text-muted-foreground text-center">
            There was an error loading the task analytics. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Time-range selector (page H1 lives in AnalyticsTasksPage wrapper). */}
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
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{INR.format(totalTasks)}</div>
            <p className="text-xs text-muted-foreground">All verification tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{INR.format(completedTasks)}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{INR.format(inProgressTasks)}</div>
            <p className="text-xs text-muted-foreground">
              {INR.format(pendingTasks)} pending assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{INR.format(totalActualAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Est: ₹{INR.format(totalEstimatedAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Chart — single Bar per viewType. */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Task Distribution</CardTitle>
              <CardDescription>Breakdown by different dimensions</CardDescription>
            </div>
            <Select
              value={viewType}
              onValueChange={(v) => setViewType(v as 'status' | 'type' | 'agent')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="type">By Verification Type</SelectItem>
                <SelectItem value="agent">By Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  viewType === 'status' ? statusData : viewType === 'type' ? typeData : agentData
                }
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6">
                  {(viewType === 'status'
                    ? statusData
                    : viewType === 'type'
                      ? typeData
                      : agentData
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
