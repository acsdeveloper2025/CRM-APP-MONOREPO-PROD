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
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { useFormValidationStatus } from '@/hooks/useAnalytics';
import { CheckCircle, Clock, XCircle, TrendingUp, Filter } from 'lucide-react';

const VALIDATION_COLORS = {
  valid: '#10b981',
  pending: '#f59e0b',
  invalid: '#ef4444',
  total: '#6b7280'
};

export const FormValidationStatus: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedFormType, setSelectedFormType] = useState('all');

  const { data: validationData, isLoading } = useFormValidationStatus({
    dateFrom: getDateFromRange(timeRange),
    dateTo: new Date().toISOString().split('T')[0],
  });

  const summary = validationData?.data?.summary;
  const byFormType = validationData?.data?.byFormType || [];

  // Generate trend data (mock data for demonstration)
  const trendData = generateTrendData(timeRange);

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
        now.setDate(now.getDate() - 7);
    }
    return now.toISOString().split('T')[0];
  }

  function generateTrendData(range: string) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate realistic mock data
      const total = Math.floor(Math.random() * 20) + 5;
      const valid = Math.floor(total * (0.7 + Math.random() * 0.2));
      const pending = Math.floor((total - valid) * (0.6 + Math.random() * 0.3));
      const invalid = total - valid - pending;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
        total,
        valid,
        pending,
        invalid,
        validationRate: ((valid / total) * 100).toFixed(1)
      });
    }
    
    return data;
  }

  const getValidationRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getValidationRateBadge = (rate: number) => {
    if (rate >= 90) return 'bg-green-100 text-green-800';
    if (rate >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Form Validation Status</h2>
          <p className="mt-1 text-muted-foreground">
            Track validation performance and identify quality trends
          </p>
        </div>
        <div className="flex items-center space-x-4">
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
          <Select value={selectedFormType} onValueChange={setSelectedFormType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Form Types</SelectItem>
              <SelectItem value="RESIDENCE">Residence</SelectItem>
              <SelectItem value="OFFICE">Office</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Forms</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalForms || 0}</div>
            <p className="text-xs text-muted-foreground">
              Submitted for validation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validated</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.validatedForms || 0}</div>
            <p className="text-xs text-muted-foreground">
              Successfully validated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary?.pendingForms || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validation Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getValidationRateColor(summary?.validationRate || 0)}`}>
              {summary?.validationRate ? `${summary.validationRate.toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Validation Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Trends</CardTitle>
          <CardDescription>Daily validation performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${label} (${item.fullDate})` : label;
                }}
                formatter={(value, name) => [value, name === 'valid' ? 'Valid' : name === 'pending' ? 'Pending' : 'Invalid']}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="valid" 
                stackId="1" 
                stroke={VALIDATION_COLORS.valid} 
                fill={VALIDATION_COLORS.valid}
                fillOpacity={0.8}
              />
              <Area 
                type="monotone" 
                dataKey="pending" 
                stackId="1" 
                stroke={VALIDATION_COLORS.pending} 
                fill={VALIDATION_COLORS.pending}
                fillOpacity={0.8}
              />
              <Area 
                type="monotone" 
                dataKey="invalid" 
                stackId="1" 
                stroke={VALIDATION_COLORS.invalid} 
                fill={VALIDATION_COLORS.invalid}
                fillOpacity={0.8}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Validation Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Rate Trend</CardTitle>
          <CardDescription>Success rate percentage over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                formatter={(value) => [`${value}%`, 'Validation Rate']}
              />
              <Line 
                type="monotone" 
                dataKey="validationRate" 
                stroke={VALIDATION_COLORS.valid}
                strokeWidth={3}
                dot={{ fill: VALIDATION_COLORS.valid, strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Form Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Validation by Form Type</CardTitle>
          <CardDescription>Performance breakdown by form categories</CardDescription>
        </CardHeader>
        <CardContent>
          {byFormType.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byFormType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="form_type" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="validated_forms" fill={VALIDATION_COLORS.valid} name="Validated" />
                  <Bar dataKey="pending_forms" fill={VALIDATION_COLORS.pending} name="Pending" />
                </BarChart>
              </ResponsiveContainer>
              
              <div className="grid gap-4 md:grid-cols-3">
                {byFormType.map((formType) => {
                  const validationRate = formType.total_forms > 0 
                    ? (formType.validated_forms / formType.total_forms) * 100 
                    : 0;
                  
                  return (
                    <div key={formType.form_type} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{formType.form_type}</h4>
                        <Badge className={getValidationRateBadge(validationRate)}>
                          {validationRate.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>Total: {formType.total_forms}</div>
                        <div>Validated: {formType.validated_forms}</div>
                        <div>Pending: {formType.pending_forms}</div>
                        <div>Avg Time: {formType.avg_validation_time_hours.toFixed(1)}h</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <XCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No validation data</h3>
              <p className="text-muted-foreground">
                Form validation data will appear here once forms are submitted.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
