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
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  Histogram
} from 'recharts';
import { useCaseAnalytics } from '@/hooks/useAnalytics';
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Timer
} from 'lucide-react';

const TIME_RANGES = {
  '0-3': { min: 0, max: 3, color: '#10b981', label: '0-3 days' },
  '4-7': { min: 4, max: 7, color: '#3b82f6', label: '4-7 days' },
  '8-14': { min: 8, max: 14, color: '#f59e0b', label: '8-14 days' },
  '15+': { min: 15, max: 999, color: '#ef4444', label: '15+ days' }
};

export const CaseCompletionTimeAnalysis: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState<'distribution' | 'trends' | 'comparison' | 'bottlenecks'>('distribution');
  const [groupBy, setGroupBy] = useState<'agent' | 'client' | 'type' | 'priority'>('agent');

  const { data: analyticsData, isLoading } = useCaseAnalytics({
    dateFrom: getDateFromRange(timeRange),
    dateTo: new Date().toISOString().split('T')[0],
  });

  const cases = analyticsData?.data?.cases || [];
  const summary = analyticsData?.data?.summary;

  // Calculate completion time distribution
  const completionTimeDistribution = calculateTimeDistribution(cases);
  
  // Generate trend data
  const completionTrends = generateCompletionTrends(timeRange);
  
  // Generate comparison data by different groupings
  const comparisonData = generateComparisonData(cases, groupBy);
  
  // Identify bottlenecks
  const bottleneckData = identifyBottlenecks(cases);

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

  function calculateTimeDistribution(cases: any[]) {
    const distribution = {
      '0-3': 0,
      '4-7': 0,
      '8-14': 0,
      '15+': 0
    };

    cases.forEach(caseItem => {
      if (caseItem.completionDays !== null) {
        const days = caseItem.completionDays;
        if (days <= 3) distribution['0-3']++;
        else if (days <= 7) distribution['4-7']++;
        else if (days <= 14) distribution['8-14']++;
        else distribution['15+']++;
      }
    });

    return Object.entries(distribution).map(([range, count]) => ({
      range,
      count,
      percentage: cases.length > 0 ? ((count / cases.length) * 100).toFixed(1) : '0',
      color: TIME_RANGES[range as keyof typeof TIME_RANGES].color,
      label: TIME_RANGES[range as keyof typeof TIME_RANGES].label
    }));
  }

  function generateCompletionTrends(range: string) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
        avgCompletionTime: Math.floor(Math.random() * 8) + 3,
        casesCompleted: Math.floor(Math.random() * 12) + 2,
        target: 7, // Target completion time
        fastest: Math.floor(Math.random() * 3) + 1,
        slowest: Math.floor(Math.random() * 10) + 10
      });
    }
    
    return data;
  }

  function generateComparisonData(cases: any[], groupBy: string) {
    // Mock data generation based on groupBy type
    switch (groupBy) {
      case 'agent':
        return [
          { name: 'John Doe', avgTime: 5.2, casesCompleted: 45, efficiency: 92 },
          { name: 'Jane Smith', avgTime: 6.8, casesCompleted: 38, efficiency: 85 },
          { name: 'Mike Johnson', avgTime: 4.1, casesCompleted: 52, efficiency: 95 },
          { name: 'Sarah Wilson', avgTime: 7.3, casesCompleted: 41, efficiency: 78 },
          { name: 'David Brown', avgTime: 5.9, casesCompleted: 35, efficiency: 88 }
        ];
      case 'client':
        return [
          { name: 'ABC Corp', avgTime: 4.5, casesCompleted: 28, efficiency: 90 },
          { name: 'XYZ Ltd', avgTime: 6.2, casesCompleted: 35, efficiency: 82 },
          { name: 'Tech Solutions', avgTime: 5.8, casesCompleted: 22, efficiency: 85 },
          { name: 'Global Inc', avgTime: 7.1, casesCompleted: 31, efficiency: 75 }
        ];
      case 'type':
        return [
          { name: 'Residence', avgTime: 5.2, casesCompleted: 85, efficiency: 88 },
          { name: 'Office', avgTime: 6.8, casesCompleted: 62, efficiency: 82 },
          { name: 'Business', avgTime: 8.1, casesCompleted: 34, efficiency: 75 }
        ];
      case 'priority':
        return [
          { name: 'High', avgTime: 3.2, casesCompleted: 25, efficiency: 95 },
          { name: 'Medium', avgTime: 6.5, casesCompleted: 98, efficiency: 85 },
          { name: 'Low', avgTime: 9.8, casesCompleted: 58, efficiency: 72 }
        ];
      default:
        return [];
    }
  }

  function identifyBottlenecks(cases: any[]) {
    return [
      { 
        stage: 'Assignment', 
        avgTime: 1.2, 
        impact: 'Medium', 
        cases: 45,
        improvement: 'Automate assignment process'
      },
      { 
        stage: 'Field Visit', 
        avgTime: 3.8, 
        impact: 'High', 
        cases: 78,
        improvement: 'Optimize route planning'
      },
      { 
        stage: 'Form Validation', 
        avgTime: 2.1, 
        impact: 'Low', 
        cases: 32,
        improvement: 'Implement auto-validation'
      },
      { 
        stage: 'Final Approval', 
        avgTime: 1.5, 
        impact: 'Medium', 
        cases: 56,
        improvement: 'Streamline approval workflow'
      }
    ];
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'text-green-600 dark:text-green-400';
    if (efficiency >= 80) return 'text-blue-600 dark:text-blue-400';
    if (efficiency >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 90) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    if (efficiency >= 80) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    if (efficiency >= 70) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Case Completion Time Analysis</h2>
          <p className="mt-1 text-muted-foreground">
            Analyze completion patterns and identify optimization opportunities
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
              <SelectItem value="comparison">Comparison</SelectItem>
              <SelectItem value="bottlenecks">Bottlenecks</SelectItem>
            </SelectContent>
          </Select>
          {viewType === 'comparison' && (
            <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">By Agent</SelectItem>
                <SelectItem value="client">By Client</SelectItem>
                <SelectItem value="type">By Type</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
              </SelectContent>
            </Select>
          )}
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
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avgCompletionDays ? `${summary.avgCompletionDays.toFixed(1)}d` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Average days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fast Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {completionTimeDistribution.find(d => d.range === '0-3')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">0-3 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Standard</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {completionTimeDistribution.find(d => d.range === '4-7')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">4-7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delayed</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {completionTimeDistribution.find(d => d.range === '8-14')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">8-14 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {completionTimeDistribution.find(d => d.range === '15+')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">15+ days</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization */}
      {viewType === 'distribution' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Time Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Completion Time Distribution</CardTitle>
              <CardDescription>Cases grouped by completion time ranges</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={completionTimeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8">
                    {completionTimeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key completion time statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {completionTimeDistribution.map((item) => (
                  <div key={item.range} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-lg font-bold">{item.count}</span>
                      <Badge style={{ backgroundColor: item.color, color: 'white' }}>
                        {item.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewType === 'trends' && (
        <Card>
          <CardHeader>
            <CardTitle>Completion Time Trends</CardTitle>
            <CardDescription>Average completion time over time with targets</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={completionTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgCompletionTime" 
                  stroke="#3b82f6"
                  strokeWidth={3}
                  name="Avg Completion Time"
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  name="Target (7 days)"
                />
                <Line 
                  type="monotone" 
                  dataKey="fastest" 
                  stroke="#10b981"
                  strokeWidth={1}
                  name="Fastest"
                />
                <Line 
                  type="monotone" 
                  dataKey="slowest" 
                  stroke="#f59e0b"
                  strokeWidth={1}
                  name="Slowest"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === 'comparison' && (
        <Card>
          <CardHeader>
            <CardTitle>Completion Time Comparison</CardTitle>
            <CardDescription>Performance comparison {groupBy === 'agent' ? 'by agent' : groupBy === 'client' ? 'by client' : groupBy === 'type' ? 'by case type' : 'by priority'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgTime" fill="#3b82f6" name="Avg Time (days)" />
                <Bar dataKey="casesCompleted" fill="#10b981" name="Cases Completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === 'bottlenecks' && (
        <Card>
          <CardHeader>
            <CardTitle>Process Bottlenecks</CardTitle>
            <CardDescription>Identify stages causing delays in case completion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bottleneckData.map((bottleneck, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Timer className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold">{bottleneck.stage}</h4>
                    </div>
                    <Badge className={getImpactColor(bottleneck.impact)}>
                      {bottleneck.impact} Impact
                    </Badge>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-3 mb-3">
                    <div>
                      <span className="text-sm text-muted-foreground">Avg Time:</span>
                      <div className="font-bold">{bottleneck.avgTime} days</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Cases Affected:</span>
                      <div className="font-bold">{bottleneck.cases}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Impact Level:</span>
                      <div className="font-bold">{bottleneck.impact}</div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-800">Improvement Suggestion:</span>
                    <p className="text-sm text-blue-700 mt-1">{bottleneck.improvement}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
