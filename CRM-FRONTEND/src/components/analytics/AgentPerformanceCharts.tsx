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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAgentPerformance } from '@/hooks/useAnalytics';
import { Users, FileCheck, Target, Clock, XCircle, ListChecks } from 'lucide-react';

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const getDateFromRange = (range: string): string => {
  const now = new Date();
  switch (range) {
    case '7d':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      break;
    default:
      now.setDate(now.getDate() - 30);
  }
  return now.toISOString().split('T')[0];
};

export const AgentPerformanceCharts: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');

  const { data: performanceData, error } = useAgentPerformance({
    dateFrom: getDateFromRange(timeRange),
    dateTo: new Date().toISOString().split('T')[0],
  });

  const agents = useMemo(
    () => performanceData?.data?.agents ?? [],
    [performanceData?.data?.agents]
  );
  const summary = performanceData?.data?.summary;

  const totalAgents = summary?.totalAgents ?? 0;
  const totalTasks = summary?.totalTasks ?? 0;
  const completedTasks = summary?.completedTasks ?? 0;
  const inTat = summary?.inTat ?? 0;
  const outTat = summary?.outTat ?? 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const avgTasksPerAgent = totalAgents > 0 ? totalTasks / totalAgents : 0;
  const tatTotal = inTat + outTat;
  const inTatPct = tatTotal > 0 ? Math.round((inTat / tatTotal) * 100) : 0;

  // Per-agent comparison chart data (real BE fields only).
  // P10 truthful-sweep 2026-05-27: useMemo so chart data ref is stable
  // across timeRange-change re-renders (recharts skips re-layout when
  // data prop ref unchanged).
  const agentComparisonData = useMemo(
    () =>
      agents.map((agent) => ({
        name: agent.name.split(' ')[0],
        fullName: agent.name,
        totalTasks: agent.totalTasks,
        completedTasks: agent.completedTasks,
        pendingTasks: agent.pendingTasks,
        totalAmount: agent.totalAmount,
      })),
    [agents]
  );

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Performance Data</h3>
            <p className="text-muted-foreground text-center">
              There was an error loading agent performance data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Time-range selector (page H1 lives in AnalyticsAgentsPage wrapper). */}
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

      {/* Summary Cards — 5 real-data tiles, no mocks. */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Field Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{INR.format(totalAgents)}</div>
            <p className="text-xs text-muted-foreground">
              Assigned NORMAL / REVISIT tasks in window
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{INR.format(totalTasks)}</div>
            <p className="text-xs text-muted-foreground">Field tasks assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{INR.format(completedTasks)}</div>
            <p className="text-xs text-muted-foreground">{completionRate}% completion rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In TAT</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{INR.format(inTat)}</div>
            <p className="text-xs text-muted-foreground">
              {inTatPct}% in TAT · {INR.format(outTat)} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Tasks / Agent</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{avgTasksPerAgent.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Per field agent</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-agent comparison — real BE fields. */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Comparison</CardTitle>
          <CardDescription>Tasks per agent — assigned vs completed vs pending</CardDescription>
        </CardHeader>
        <CardContent>
          {agentComparisonData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No field-agent activity in the selected window.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={agentComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || ''}
                />
                <Legend />
                <Bar dataKey="totalTasks" fill="#6b7280" name="Total Tasks" />
                <Bar dataKey="completedTasks" fill="#10b981" name="Completed" />
                <Bar dataKey="pendingTasks" fill="#f59e0b" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Per-agent breakdown table. */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Agent Detail</CardTitle>
          <CardDescription>Tasks · TAT · earnings per field agent</CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No field-agent rows.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Emp ID</th>
                    <th className="py-2 pr-4 text-right">Total</th>
                    <th className="py-2 pr-4 text-right">Completed</th>
                    <th className="py-2 pr-4 text-right">Pending</th>
                    <th className="py-2 pr-4 text-right">In TAT</th>
                    <th className="py-2 pr-4 text-right">Out TAT</th>
                    <th className="py-2 pr-4 text-right">Completion</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium">{agent.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground case-sensitive">
                        {agent.employeeId}
                      </td>
                      <td className="py-2 pr-4 text-right">{INR.format(agent.totalTasks)}</td>
                      <td className="py-2 pr-4 text-right text-green-600">
                        {INR.format(agent.completedTasks)}
                      </td>
                      <td className="py-2 pr-4 text-right text-amber-600">
                        {INR.format(agent.pendingTasks)}
                      </td>
                      <td className="py-2 pr-4 text-right">{INR.format(agent.inTat)}</td>
                      <td className="py-2 pr-4 text-right">{INR.format(agent.outTat)}</td>
                      <td className="py-2 pr-4 text-right">{agent.completionRate}%</td>
                      <td className="py-2 pr-4 text-right">₹{INR.format(agent.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
