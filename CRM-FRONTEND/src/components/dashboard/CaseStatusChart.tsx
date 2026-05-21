import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CaseStatusData {
  status: string;
  count: number;
  percentage: number;
}

interface CaseStatusChartProps {
  data: CaseStatusData[];
  isLoading?: boolean;
}

// 2026-05-14: PENDING is red (urgency — agents must clear pending work),
// per user spec. Keys are matched after `item.status.replace('_', ' ')`,
// so use the rendered name (space-separated, upper-case) as the key.
const COLORS: Record<string, string> = {
  PENDING: '#ef4444',
  ASSIGNED: '#3b82f6',
  'IN PROGRESS': '#f59e0b',
  COMPLETED: '#10b981',
  REVOKED: '#8b5cf6',
  'PENDING REVIEW': '#a855f7',
};
const DEFAULT_COLOR = '#94a3b8';

const colorFor = (name: string) => COLORS[name] ?? DEFAULT_COLOR;

// Custom Tooltip Types
interface TooltipPayload {
  name: string;
  value: number;
  payload: {
    percentage: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-muted-foreground">Count: {data.value}</p>
        <p className="text-sm text-muted-foreground">Percentage: {data.payload.percentage}%</p>
      </div>
    );
  }
  return null;
};

export const CaseStatusChart: React.FC<CaseStatusChartProps> = React.memo(({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case Status Distribution</CardTitle>
          <CardDescription>Current status breakdown of all cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];

  const chartData = safeData.map((item) => ({
    name: item.status.replace('_', ' '),
    value: item.count,
    percentage: item.percentage,
  }));

  // Sort so larger slices appear first in the data list — easier to scan.
  const sortedList = [...chartData].sort((a, b) => b.value - a.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case Status Distribution</CardTitle>
        <CardDescription>Current status breakdown of all cases</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 2026-05-14: split into pie (left) + data list with explicit
            counts + percentages (right). Inline pie labels removed —
            when one slice dominates (e.g., 99% COMPLETED) the tiny
            slice labels collided. Data list is the source of truth for
            exact numbers; pie is the visual quick-scan. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-[300px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 1, height: 1 }}
            >
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colorFor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col justify-center gap-3 px-1">
            {sortedList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              sortedList.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: colorFor(entry.name) }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {entry.name}
                  </span>
                  <span className="tabular-nums text-sm text-muted-foreground">{entry.value}</span>
                  <span className="w-12 text-right tabular-nums text-sm font-semibold text-foreground">
                    {entry.percentage}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CaseStatusChart.displayName = 'CaseStatusChart';
