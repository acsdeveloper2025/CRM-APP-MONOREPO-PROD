import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
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
  ResponsiveContainer 
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import {
  CheckSquare,
  Clock,
  DollarSign,
  FileCheck,
  XCircle
} from 'lucide-react';

interface VerificationTask {
  id: string;
  status: string;
  verification_type_name: string;
  assigned_to_name: string | null;
  estimated_amount: string;
  actual_amount: string;
}

interface VerificationTasksResponse {
  tasks: VerificationTask[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  statistics: {
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    revoked: number;
    onHold: number;
    urgent: number;
    highPriority: number;
    totalAgents: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#8b5cf6',
  COMPLETED: '#10b981',
  REVOKED: '#ef4444',
  ON_HOLD: '#6b7280'
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

export const TasksAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState<'status' | 'type' | 'agent'>('status');

  // Fetch verification tasks (backend max limit is 100)
  const { data: tasksData, isLoading, error } = useQuery<ApiResponse<VerificationTasksResponse>>({
    queryKey: ['verification-tasks', timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '100',
        dateFrom: getDateFromRange(timeRange),
        dateTo: new Date().toISOString().split('T')[0]
      });
      return apiService.get<VerificationTasksResponse>(`/verification-tasks?${params.toString()}`);
    }
  });

  // Extract backend statistics
  const payload = tasksData?.data;
  const taskStats = payload?.statistics;
  const totalTasks = payload?.pagination?.total || 0;

  // Calculate metrics using backend stats
  const completedTasks = taskStats?.completed || 0;
  const inProgressTasks = taskStats?.inProgress || 0;
  const pendingTasks = (taskStats?.pending || 0) + (taskStats?.assigned || 0);
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Status distribution from backend
  const statusData = [
    { name: 'Pending', value: taskStats?.pending || 0, color: STATUS_COLORS.PENDING },
    { name: 'Assigned', value: taskStats?.assigned || 0, color: STATUS_COLORS.ASSIGNED },
    { name: 'In Progress', value: taskStats?.inProgress || 0, color: STATUS_COLORS.IN_PROGRESS },
    { name: 'Completed', value: taskStats?.completed || 0, color: STATUS_COLORS.COMPLETED },
    { name: 'Revoked', value: taskStats?.revoked || 0, color: STATUS_COLORS.REVOKED },
    { name: 'On Hold', value: taskStats?.onHold || 0, color: STATUS_COLORS.ON_HOLD },
  ].filter(d => d.value > 0);

  // Still need to use the tasks array for type and agent distribution as backend doesn't aggregate them yet
  const tasks: VerificationTask[] = payload?.tasks || [];

  // Calculate total amounts (ideally these should also come from backend statistics)
  const totalEstimatedAmount = tasks.reduce((sum: number, t: VerificationTask) => sum + (parseFloat(t.estimated_amount) || 0), 0);
  const totalActualAmount = tasks.reduce((sum: number, t: VerificationTask) => sum + (parseFloat(t.actual_amount) || 0), 0);

  // Verification type distribution
  const typeDistribution = tasks.reduce((acc: Record<string, number>, t: VerificationTask) => {
    const type = t.verification_type_name || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const typeData = Object.entries(typeDistribution).map(([name, count], index) => ({
    name,
    value: count as number,
    color: `hsl(${index * 45}, 70%, 50%)`
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Agent distribution
  const agentDistribution = tasks.reduce((acc: Record<string, number>, t: VerificationTask) => {
    const agent = t.assigned_to_name || 'Unassigned';
    acc[agent] = (acc[agent] || 0) + 1;
    return acc;
  }, {});

  const agentData = Object.entries(agentDistribution).map(([name, count], index) => ({
    name,
    value: count as number,
    color: `hsl(${index * 45}, 70%, 50%)`
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Loading state
  if (isLoading) {
    return (
      <div {...{ className: "space-y-4 sm:space-y-6" }}>
        <div {...{ className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader {...{ className: "pb-2" }}>
                <div {...{ className: "h-4 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded w-24" }} />
              </CardHeader>
              <CardContent>
                <div {...{ className: "h-8 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded w-16" }} />
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
        <CardContent {...{ className: "flex flex-col items-center justify-center py-12" }}>
          <XCircle {...{ className: "h-12 w-12 text-red-500 mb-4" }} />
          <h3 {...{ className: "text-lg font-semibold mb-2" }}>Failed to Load Task Analytics</h3>
          <p {...{ className: "text-gray-600 text-center" }}>
            There was an error loading the task analytics. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div {...{ className: "space-y-4 sm:space-y-6" }}>
      {/* Header */}
      <div {...{ className: "flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between" }}>
        <div {...{ className: "min-w-0 flex-1" }}>
          <h2 {...{ className: "text-xl sm:text-2xl font-bold text-gray-900 truncate" }}>Verification Tasks Analytics</h2>
          <p {...{ className: "mt-1 text-sm sm:text-base text-gray-600" }}>
            Task-level metrics and performance analysis
          </p>
        </div>
        <div {...{ className: "flex flex-col sm:flex-row gap-2" }}>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger {...{ className: "w-full sm:w-[140px]" }}>
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
      <div {...{ className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" }}>
        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>Total Tasks</CardTitle>
            <CheckSquare {...{ className: "h-4 w-4 text-gray-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold" }}>{totalTasks}</div>
            <p {...{ className: "text-xs text-gray-600" }}>
              All verification tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>Completed</CardTitle>
            <FileCheck {...{ className: "h-4 w-4 text-green-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold" }}>{completedTasks}</div>
            <p {...{ className: "text-xs text-gray-600" }}>
              {completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>In Progress</CardTitle>
            <Clock {...{ className: "h-4 w-4 text-green-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold" }}>{inProgressTasks}</div>
            <p {...{ className: "text-xs text-gray-600" }}>
              {pendingTasks} pending assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>Total Value</CardTitle>
            <DollarSign {...{ className: "h-4 w-4 text-gray-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold" }}>₹{totalActualAmount.toLocaleString()}</div>
            <p {...{ className: "text-xs text-gray-600" }}>
              Est: ₹{totalEstimatedAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Charts */}
      <Card>
        <CardHeader>
          <div {...{ className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" }}>
            <div>
              <CardTitle>Task Distribution</CardTitle>
              <CardDescription>Breakdown by different dimensions</CardDescription>
            </div>
            <Select value={viewType} onValueChange={(v) => setViewType(v as 'status' | 'type' | 'agent')}>
              <SelectTrigger {...{ className: "w-full sm:w-[180px]" }}>
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
          <div {...{ className: "grid gap-6 grid-cols-1 lg:grid-cols-2" }}>
            {/* Pie Chart */}
            <div {...{ className: "h-[300px]" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={viewType === 'status' ? statusData : viewType === 'type' ? typeData : agentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: { name?: string; percent?: number }) => `${props.name || ''}: ${((props.percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(viewType === 'status' ? statusData : viewType === 'type' ? typeData : agentData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div {...{ className: "h-[300px]" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viewType === 'status' ? statusData : viewType === 'type' ? typeData : agentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6">
                    {(viewType === 'status' ? statusData : viewType === 'type' ? typeData : agentData).map((entry, index) => (
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
          <CardDescription>Detailed view of tasks by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div {...{ className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }}>
            {statusData.map((status) => (
              <div key={status.name} {...{ className: "flex items-center justify-between p-4 border rounded-lg" }}>
                <div {...{ className: "flex items-center space-x-3" }}>
                  <div {...{ className: "w-3 h-3 rounded-full" }} style={{ backgroundColor: status.color }} />
                  <div>
                    <p {...{ className: "font-medium" }}>{status.name}</p>
                    <p {...{ className: "text-sm text-gray-600" }}>
                      {totalTasks > 0 ? ((status.value / totalTasks) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
                <div {...{ className: "text-2xl font-bold" }}>{status.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

