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
  Line
} from 'recharts';
import { useFormSubmissions } from '@/hooks/useAnalytics';
import { FileText, Home, Building, Briefcase, TrendingUp, Calendar } from 'lucide-react';

const FORM_TYPE_COLORS = {
  RESIDENCE: '#3b82f6',
  OFFICE: '#8b5cf6',
  BUSINESS: '#f97316',
  OTHER: '#6b7280'
};

const FORM_TYPE_ICONS = {
  RESIDENCE: Home,
  OFFICE: Building,
  BUSINESS: Briefcase,
  OTHER: FileText
};

export const FormTypeDistribution: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState<'distribution' | 'trends' | 'comparison'>('distribution');

  const { data: submissionsData, isLoading } = useFormSubmissions({
    limit: 1000,
    dateFrom: getDateFromRange(timeRange),
    dateTo: new Date().toISOString().split('T')[0],
  });

  const submissions = submissionsData?.data?.submissions || [];
  const summary = submissionsData?.data?.summary;

  // Calculate form type distribution
  const distributionData = [
    { 
      name: 'Residence', 
      value: summary?.residenceForms || 0, 
      color: FORM_TYPE_COLORS.RESIDENCE,
      percentage: summary?.totalSubmissions ? ((summary.residenceForms || 0) / summary.totalSubmissions * 100).toFixed(1) : '0'
    },
    { 
      name: 'Office', 
      value: summary?.officeForms || 0, 
      color: FORM_TYPE_COLORS.OFFICE,
      percentage: summary?.totalSubmissions ? ((summary.officeForms || 0) / summary.totalSubmissions * 100).toFixed(1) : '0'
    },
    { 
      name: 'Business', 
      value: (summary?.totalSubmissions || 0) - (summary?.residenceForms || 0) - (summary?.officeForms || 0), 
      color: FORM_TYPE_COLORS.BUSINESS,
      percentage: summary?.totalSubmissions ? (((summary.totalSubmissions - (summary.residenceForms || 0) - (summary.officeForms || 0)) / summary.totalSubmissions) * 100).toFixed(1) : '0'
    }
  ].filter(item => item.value > 0);

  // Generate trend data
  const trendData = generateTrendData(timeRange);

  // Generate comparison data by agent
  const agentComparisonData = generateAgentComparisonData();

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

  function generateTrendData(range: string) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
        RESIDENCE: Math.floor(Math.random() * 15) + 2,
        OFFICE: Math.floor(Math.random() * 10) + 1,
        BUSINESS: Math.floor(Math.random() * 8) + 1,
      });
    }
    
    return data;
  }

  function generateAgentComparisonData() {
    return [
      { agent: 'John Doe', RESIDENCE: 45, OFFICE: 23, BUSINESS: 12, total: 80 },
      { agent: 'Jane Smith', RESIDENCE: 38, OFFICE: 31, BUSINESS: 18, total: 87 },
      { agent: 'Mike Johnson', RESIDENCE: 52, OFFICE: 19, BUSINESS: 8, total: 79 },
      { agent: 'Sarah Wilson', RESIDENCE: 41, OFFICE: 27, BUSINESS: 15, total: 83 },
      { agent: 'David Brown', RESIDENCE: 35, OFFICE: 22, BUSINESS: 11, total: 68 }
    ];
  }

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
          <h2 className="text-2xl font-bold text-foreground">Form Type Distribution</h2>
          <p className="mt-1 text-muted-foreground">
            Analyze form submission patterns by type and trends
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
              <SelectItem value="comparison">Agent Comparison</SelectItem>
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Forms</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalSubmissions || 0}</div>
            <p className="text-xs text-muted-foreground">All form types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Residence Forms</CardTitle>
            <Home className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.residenceForms || 0}</div>
            <p className="text-xs text-muted-foreground">
              {distributionData.find(d => d.name === 'Residence')?.percentage || '0'}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Office Forms</CardTitle>
            <Building className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{summary?.officeForms || 0}</div>
            <p className="text-xs text-muted-foreground">
              {distributionData.find(d => d.name === 'Office')?.percentage || '0'}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Forms</CardTitle>
            <Briefcase className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {distributionData.find(d => d.name === 'Business')?.value || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {distributionData.find(d => d.name === 'Business')?.percentage || '0'}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization */}
      {viewType === 'distribution' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Form Type Distribution</CardTitle>
              <CardDescription>Percentage breakdown by form type</CardDescription>
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
                  <Tooltip formatter={(value, name) => [value, `${name} Forms`]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Form Type Volumes</CardTitle>
              <CardDescription>Absolute numbers by form type</CardDescription>
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
            <CardTitle>Form Type Trends</CardTitle>
            <CardDescription>Daily submission trends by form type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="RESIDENCE" 
                  stroke={FORM_TYPE_COLORS.RESIDENCE}
                  strokeWidth={2}
                  dot={{ fill: FORM_TYPE_COLORS.RESIDENCE, strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="OFFICE" 
                  stroke={FORM_TYPE_COLORS.OFFICE}
                  strokeWidth={2}
                  dot={{ fill: FORM_TYPE_COLORS.OFFICE, strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="BUSINESS" 
                  stroke={FORM_TYPE_COLORS.BUSINESS}
                  strokeWidth={2}
                  dot={{ fill: FORM_TYPE_COLORS.BUSINESS, strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === 'comparison' && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Form Type Comparison</CardTitle>
            <CardDescription>Form submission breakdown by agent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={agentComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="agent" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="RESIDENCE" stackId="a" fill={FORM_TYPE_COLORS.RESIDENCE} />
                <Bar dataKey="OFFICE" stackId="a" fill={FORM_TYPE_COLORS.OFFICE} />
                <Bar dataKey="BUSINESS" stackId="a" fill={FORM_TYPE_COLORS.BUSINESS} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Form Type Details</CardTitle>
          <CardDescription>Comprehensive breakdown with statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {distributionData.map((formType) => {
              const IconComponent = FORM_TYPE_ICONS[formType.name.toUpperCase() as keyof typeof FORM_TYPE_ICONS] || FileText;
              
              return (
                <div key={formType.name} className="p-6 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg`} style={{ backgroundColor: `${formType.color}20` }}>
                        <IconComponent className="h-6 w-6" style={{ color: formType.color }} />
                      </div>
                      <h3 className="font-semibold text-lg">{formType.name}</h3>
                    </div>
                    <Badge style={{ backgroundColor: formType.color, color: 'white' }}>
                      {formType.percentage}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Submissions:</span>
                      <span className="font-medium">{formType.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Percentage:</span>
                      <span className="font-medium">{formType.percentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Avg per Day:</span>
                      <span className="font-medium">
                        {timeRange === '7d' ? (formType.value / 7).toFixed(1) : 
                         timeRange === '30d' ? (formType.value / 30).toFixed(1) : 
                         (formType.value / 90).toFixed(1)}
                      </span>
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
