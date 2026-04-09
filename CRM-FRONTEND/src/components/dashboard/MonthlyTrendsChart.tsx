import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MonthlyTrendData {
  month: string;
  totalCases: number;
  revenue?: number;
  completionRate: number;
}

interface MonthlyTrendsChartProps {
  data: MonthlyTrendData[];
  isLoading?: boolean;
}

// Custom Tooltip Types
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  payload: MonthlyTrendData;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.name === 'Revenue' && entry.value ? `$${entry.value.toLocaleString()}` : entry.value}
            {entry.name === 'Completion Rate' ? '%' : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const MonthlyTrendsChart: React.FC<MonthlyTrendsChartProps> = React.memo(({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
          <CardDescription>Cases and revenue trends over time</CardDescription>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Trends</CardTitle>
        <CardDescription>Cases and revenue trends over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={safeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalCases"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Cases"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="completionRate"
                stroke="#10b981"
                strokeWidth={2}
                name="Completion Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

MonthlyTrendsChart.displayName = 'MonthlyTrendsChart';
