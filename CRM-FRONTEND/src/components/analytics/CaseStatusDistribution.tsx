import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { useCaseAnalytics } from '@/hooks/useAnalytics';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  PlayCircle, 
  PauseCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react';

const STATUS_COLORS = {
  PENDING: '#6b7280',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#10b981',
  APPROVED: '#059669',
  REJECTED: '#ef4444',
  ON_HOLD: '#8b5cf6'
};

const STATUS_ICONS = {
  PENDING: Clock,
  ASSIGNED: AlertCircle,
  IN_PROGRESS: PlayCircle,
  COMPLETED: CheckCircle,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  ON_HOLD: PauseCircle
};

export const CaseStatusDistribution: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState<'distribution' | 'trends' | 'flow'>('distribution');

  const { data: analyticsData, isLoading } = useCaseAnalytics({
    dateFrom: getDateFromRange(timeRange),
    dateTo: new Date().toISOString().split('T')[0],
  });

  const cases = analyticsData?.data?.cases || [];
  const summary = analyticsData?.data?.summary;
  const statusDistribution = summary?.statusDistribution || {};

  // Convert status distribution to chart data
  const distributionData = Object.entries(statusDistribution).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
    color: STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#6b7280',
    percentage: summary?.totalCases ? ((count / summary.totalCases) * 100).toFixed(1) : '0'
  }));

  // Generate trend data
  const trendData = generateStatusTrendData(timeRange);

  // Generate flow data (status transitions)
  const flowData = generateStatusFlowData();

  function getDateFromRange(range: string): string {
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
  }

  function generateStatusTrendData(range: string) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
        PENDING: Math.floor(Math.random() * 8) + 2,
        ASSIGNED: Math.floor(Math.random() * 12) + 3,
        IN_PROGRESS: Math.floor(Math.random() * 15) + 5,
        COMPLETED: Math.floor(Math.random() * 10) + 2,
        APPROVED: Math.floor(Math.random() * 6) + 1,
      });
    }
    
    return data;
  }

  function generateStatusFlowData() {
    return [
      { from: 'PENDING', to: 'ASSIGNED', count: 45, percentage: 85 },
      { from: 'ASSIGNED', to: 'IN_PROGRESS', count: 38, percentage: 78 },
      { from: 'IN_PROGRESS', to: 'COMPLETED', count: 32, percentage: 72 },
      { from: 'COMPLETED', to: 'APPROVED', count: 28, percentage: 88 },
      { from: 'IN_PROGRESS', to: 'ON_HOLD', count: 6, percentage: 13 },
      { from: 'COMPLETED', to: 'REJECTED', count: 4, percentage: 12 }
    ];
  }

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status.replace(' ', '_') as keyof typeof STATUS_COLORS] || '#6b7280';
  };

  const getStatusIcon = (status: string) => {
    return STATUS_ICONS[status.replace(' ', '_') as keyof typeof STATUS_ICONS] || Clock;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Case Status Distribution</h2>
          <p className="mt-1 text-muted-foreground">
            Monitor case progress and identify bottlenecks in the workflow
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distribution">Distribution</SelectItem>
              <SelectItem value="trends">Trends</SelectItem>
              <SelectItem value="flow">Status Flow</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
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
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalCases || 0}</div>
            <p className="text-xs text-muted-foreground">All statuses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PlayCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statusDistribution.IN_PROGRESS || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.completedCases || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.completionRate ? `${summary.completionRate.toFixed(1)}% rate` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {statusDistribution.PENDING || 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.avgCompletionDays ? `${summary.avgCompletionDays.toFixed(1)}d` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Days to complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization */}
      {viewType === 'distribution' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Current case status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, `${name} Cases`]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Status Volumes</CardTitle>
              <CardDescription>Case counts by status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8">
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {viewType === 'trends' && (
        <Card>
          <CardHeader>
            <CardTitle>Status Trends Over Time</CardTitle>
            <CardDescription>Daily case status changes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="PENDING" 
                  stackId="1" 
                  stroke={STATUS_COLORS.PENDING} 
                  fill={STATUS_COLORS.PENDING}
                  fillOpacity={0.8}
                />
                <Area 
                  type="monotone" 
                  dataKey="ASSIGNED" 
                  stackId="1" 
                  stroke={STATUS_COLORS.ASSIGNED} 
                  fill={STATUS_COLORS.ASSIGNED}
                  fillOpacity={0.8}
                />
                <Area 
                  type="monotone" 
                  dataKey="IN_PROGRESS" 
                  stackId="1" 
                  stroke={STATUS_COLORS.IN_PROGRESS} 
                  fill={STATUS_COLORS.IN_PROGRESS}
                  fillOpacity={0.8}
                />
                <Area 
                  type="monotone" 
                  dataKey="COMPLETED" 
                  stackId="1" 
                  stroke={STATUS_COLORS.COMPLETED} 
                  fill={STATUS_COLORS.COMPLETED}
                  fillOpacity={0.8}
                />
                <Area 
                  type="monotone" 
                  dataKey="APPROVED" 
                  stackId="1" 
                  stroke={STATUS_COLORS.APPROVED} 
                  fill={STATUS_COLORS.APPROVED}
                  fillOpacity={0.8}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === 'flow' && (
        <Card>
          <CardHeader>
            <CardTitle>Status Flow Analysis</CardTitle>
            <CardDescription>Case transitions between statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {flowData.map((flow, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Badge style={{ backgroundColor: getStatusColor(flow.from), color: 'white' }}>
                      {flow.from.replace('_', ' ')}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge style={{ backgroundColor: getStatusColor(flow.to), color: 'white' }}>
                      {flow.to.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-muted-foreground">{flow.count} cases</span>
                    <Badge variant="outline">{flow.percentage}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status Details</CardTitle>
          <CardDescription>Comprehensive breakdown with statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {distributionData.map((status) => {
              const IconComponent = getStatusIcon(status.name);
              
              return (
                <div key={status.name} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="h-5 w-5" style={{ color: status.color }} />
                      <h4 className="font-medium">{status.name}</h4>
                    </div>
                    <Badge style={{ backgroundColor: status.color, color: 'white' }}>
                      {status.percentage}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Count:</span>
                      <span className="font-medium">{status.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Percentage:</span>
                      <span className="font-medium">{status.percentage}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
