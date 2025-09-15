import React, { useState, useEffect } from 'react';
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
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  TrendingUp, 
  Target, 
  Clock, 
  CheckCircle,
  Star,
  Award,
  Calendar,
  BarChart3,
  RefreshCw,
  Download
} from 'lucide-react';

interface PerformanceData {
  daily: Array<{
    date: string;
    submissions: number;
    quality: number;
    completionTime: number;
  }>;
  weekly: Array<{
    week: string;
    submissions: number;
    quality: number;
    completionRate: number;
  }>;
  monthly: Array<{
    month: string;
    submissions: number;
    quality: number;
    completionRate: number;
  }>;
  formTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  radarData: Array<{
    metric: string;
    value: number;
    fullMark: 100;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const PerformanceMetrics: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [selectedMetric, setSelectedMetric] = useState('submissions');

  useEffect(() => {
    fetchPerformanceData();
  }, [timeRange]);

  const fetchPerformanceData = async () => {
    try {
      setIsLoading(true);
      
      // Mock data - replace with actual API call
      const mockData: PerformanceData = {
        daily: [
          { date: '2024-01-08', submissions: 8, quality: 85, completionTime: 25 },
          { date: '2024-01-09', submissions: 12, quality: 88, completionTime: 22 },
          { date: '2024-01-10', submissions: 6, quality: 92, completionTime: 28 },
          { date: '2024-01-11', submissions: 15, quality: 87, completionTime: 20 },
          { date: '2024-01-12', submissions: 10, quality: 90, completionTime: 24 },
          { date: '2024-01-13', submissions: 9, quality: 89, completionTime: 26 },
          { date: '2024-01-14', submissions: 11, quality: 91, completionTime: 23 }
        ],
        weekly: [
          { week: 'Week 1', submissions: 45, quality: 87, completionRate: 92 },
          { week: 'Week 2', submissions: 52, quality: 89, completionRate: 94 },
          { week: 'Week 3', submissions: 48, quality: 91, completionRate: 96 },
          { week: 'Week 4', submissions: 55, quality: 88, completionRate: 93 }
        ],
        monthly: [
          { month: 'Oct', submissions: 180, quality: 86, completionRate: 91 },
          { month: 'Nov', submissions: 195, quality: 88, completionRate: 93 },
          { month: 'Dec', submissions: 210, quality: 90, completionRate: 95 },
          { month: 'Jan', submissions: 200, quality: 89, completionRate: 94 }
        ],
        formTypes: [
          { type: 'Residence', count: 120, percentage: 60 },
          { type: 'Office', count: 50, percentage: 25 },
          { type: 'Business', count: 30, percentage: 15 }
        ],
        radarData: [
          { metric: 'Quality', value: 89, fullMark: 100 },
          { metric: 'Speed', value: 85, fullMark: 100 },
          { metric: 'Accuracy', value: 92, fullMark: 100 },
          { metric: 'Consistency', value: 87, fullMark: 100 },
          { metric: 'Completeness', value: 94, fullMark: 100 }
        ]
      };

      setPerformanceData(mockData);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentData = () => {
    if (!performanceData) return [];
    
    switch (timeRange) {
      case 'day':
        return performanceData.daily;
      case 'week':
        return performanceData.weekly;
      case 'month':
        return performanceData.monthly;
      default:
        return performanceData.weekly;
    }
  };

  const getMetricValue = (item: any) => {
    switch (selectedMetric) {
      case 'submissions':
        return item.submissions;
      case 'quality':
        return item.quality;
      case 'completionTime':
        return item.completionTime;
      case 'completionRate':
        return item.completionRate;
      default:
        return item.submissions;
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'submissions':
        return '#0088FE';
      case 'quality':
        return '#00C49F';
      case 'completionTime':
        return '#FFBB28';
      case 'completionRate':
        return '#FF8042';
      default:
        return '#0088FE';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-muted-foreground">Loading performance data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">Avg Quality</p>
                <p className="text-xl font-bold">89%</p>
              </div>
              <Star className="h-6 w-6 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">Completion</p>
                <p className="text-xl font-bold">94%</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs">Avg Time</p>
                <p className="text-xl font-bold">24min</p>
              </div>
              <Clock className="h-6 w-6 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs">Rank</p>
                <p className="text-xl font-bold">#3</p>
              </div>
              <Award className="h-6 w-6 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Performance Trends</CardTitle>
          <div className="flex space-x-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submissions">Submissions</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="completionTime">Time</SelectItem>
                <SelectItem value="completionRate">Completion</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getCurrentData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={timeRange === 'day' ? 'date' : timeRange === 'week' ? 'week' : 'month'}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey={selectedMetric}
                  stroke={getMetricColor()}
                  strokeWidth={2}
                  dot={{ fill: getMetricColor(), strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Form Type Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Form Type Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={performanceData?.formTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {performanceData?.formTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            {performanceData?.formTypes.map((entry, index) => (
              <div key={entry.type} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground">
                  {entry.type} ({entry.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Radar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Performance Radar</CardTitle>
          <CardDescription>Your performance across key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={performanceData?.radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 100]} 
                  tick={{ fontSize: 8 }}
                />
                <Radar
                  name="Performance"
                  dataKey="value"
                  stroke="#0088FE"
                  fill="#0088FE"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Performance Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Quality Improving</p>
              <p className="text-xs text-green-600">+5% increase this week</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <Target className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Above Target</p>
              <p className="text-xs text-blue-600">Exceeding monthly goals by 12%</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
            <Clock className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-orange-800">Time Optimization</p>
              <p className="text-xs text-orange-600">Consider reducing form completion time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={fetchPerformanceData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
};
