import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Cell
} from 'recharts';
import { 
  ArrowLeft,
  Download,
  Share2,
  RefreshCw,
  Calendar,
  TrendingUp,
  Target,
  CheckCircle,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

interface MobileReportViewerProps {
  reportId?: string;
  reportType: 'performance' | 'submissions' | 'analytics';
  onBack: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const MobileReportViewer: React.FC<MobileReportViewerProps> = ({
  reportId,
  reportType,
  onBack
}) => {
  const { isOnline } = useNetworkStatus();
  const { getReport, updateLastAccessed } = useOfflineStorage();
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadReportData();
    if (reportId) {
      updateLastAccessed(reportId);
    }
  }, [reportId, reportType]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      
      let data;
      if (reportId) {
        // Load from offline storage
        const offlineReport = getReport(reportId);
        data = offlineReport?.data;
      } else {
        // Load fresh data (if online)
        if (isOnline) {
          data = await fetchFreshReportData(reportType);
        } else {
          // Show message about offline mode
          data = null;
        }
      }
      
      setReportData(data);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFreshReportData = async (type: string): Promise<any> => {
    // Mock API call - replace with actual API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    switch (type) {
      case 'performance':
        return {
          qualityScore: 89,
          completionRate: 94,
          avgResponseTime: 24,
          submissions: 156,
          trends: [
            { date: '2024-01-08', score: 85, submissions: 8 },
            { date: '2024-01-09', score: 88, submissions: 12 },
            { date: '2024-01-10', score: 92, submissions: 6 },
            { date: '2024-01-11', score: 87, submissions: 15 },
            { date: '2024-01-12', score: 90, submissions: 10 }
          ],
          breakdown: [
            { metric: 'Accuracy', value: 92 },
            { metric: 'Completeness', value: 94 },
            { metric: 'Timeliness', value: 87 },
            { metric: 'Quality', value: 89 }
          ]
        };
      
      case 'submissions':
        return {
          total: 156,
          recent: [
            { id: '1', customer: 'John Doe', type: 'RESIDENCE', status: 'VALID', date: '2024-01-15' },
            { id: '2', customer: 'Jane Smith', type: 'OFFICE', status: 'PENDING', date: '2024-01-15' },
            { id: '3', customer: 'Mike Johnson', type: 'BUSINESS', status: 'VALID', date: '2024-01-14' },
            { id: '4', customer: 'Sarah Wilson', type: 'RESIDENCE', status: 'INVALID', date: '2024-01-14' }
          ],
          byType: [
            { type: 'RESIDENCE', count: 95, percentage: 61 },
            { type: 'OFFICE', count: 38, percentage: 24 },
            { type: 'BUSINESS', count: 23, percentage: 15 }
          ],
          byStatus: [
            { status: 'VALID', count: 142, percentage: 91 },
            { status: 'PENDING', count: 8, percentage: 5 },
            { status: 'INVALID', count: 6, percentage: 4 }
          ]
        };
      
      case 'analytics':
        return {
          overview: {
            totalForms: 156,
            validationRate: 94,
            avgQuality: 89,
            totalTime: 3744 // minutes
          },
          daily: [
            { date: '2024-01-08', submissions: 8, quality: 85 },
            { date: '2024-01-09', submissions: 12, quality: 88 },
            { date: '2024-01-10', submissions: 6, quality: 92 },
            { date: '2024-01-11', submissions: 15, quality: 87 },
            { date: '2024-01-12', submissions: 10, quality: 90 }
          ],
          hourly: [
            { hour: '9AM', count: 12 },
            { hour: '10AM', count: 18 },
            { hour: '11AM', count: 25 },
            { hour: '12PM', count: 22 },
            { hour: '1PM', count: 15 },
            { hour: '2PM', count: 28 },
            { hour: '3PM', count: 20 },
            { hour: '4PM', count: 16 }
          ]
        };
      
      default:
        return null;
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CRM ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
          text: 'Check out my CRM performance report',
          url: window.location.href
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'performance':
        return 'Performance Report';
      case 'submissions':
        return 'Submissions Report';
      case 'analytics':
        return 'Analytics Report';
      default:
        return 'Report';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!reportData && !isOnline) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">{getReportTitle()}</h1>
          </div>
        </div>
        
        <div className="p-4 text-center py-16">
          <WifiOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Offline Mode</h3>
          <p className="text-muted-foreground mb-4">
            This report is not available offline. Please connect to the internet to view fresh data.
          </p>
          <Button onClick={loadReportData} disabled={!isOnline}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{getReportTitle()}</h1>
                <p className="text-sm text-muted-foreground">
                  {reportId ? 'Offline Report' : 'Live Data'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="p-4">
        {reportType === 'performance' && (
          <PerformanceReportContent data={reportData} />
        )}
        {reportType === 'submissions' && (
          <SubmissionsReportContent data={reportData} />
        )}
        {reportType === 'analytics' && (
          <AnalyticsReportContent data={reportData} />
        )}
      </div>
    </div>
  );
};

// Performance Report Component
const PerformanceReportContent: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    {/* Key Metrics */}
    <div className="grid grid-cols-2 gap-3">
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs">Quality Score</p>
              <p className="text-2xl font-bold">{data.qualityScore}%</p>
            </div>
            <Target className="h-8 w-8 text-blue-200" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-xs">Completion</p>
              <p className="text-2xl font-bold">{data.completionRate}%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-200" />
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Trends Chart */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Performance Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#0088FE" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>

    {/* Breakdown */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Performance Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.breakdown.map((item: any, index: number) => (
            <div key={item.metric} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">{item.metric}</span>
              <Badge className={
                item.value >= 90 ? 'bg-green-100 text-green-800' :
                item.value >= 80 ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }>
                {item.value}%
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

// Submissions Report Component
const SubmissionsReportContent: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    {/* Summary */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submissions Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-3xl font-bold text-blue-600">{data.total}</p>
          <p className="text-muted-foreground">Total Submissions</p>
        </div>
      </CardContent>
    </Card>

    {/* By Type Chart */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">By Form Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.byType}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="count"
                label={({ type, percentage }) => `${type} (${percentage}%)`}
              >
                {data.byType.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>

    {/* Recent Submissions */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Submissions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.recent.map((submission: any) => (
            <div key={submission.id} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{submission.customer}</h4>
                <Badge className={
                  submission.status === 'VALID' ? 'bg-green-100 text-green-800' :
                  submission.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {submission.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{submission.type}</span>
                <span>{submission.date}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

// Analytics Report Component
const AnalyticsReportContent: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    {/* Overview Cards */}
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{data.overview.totalForms}</p>
          <p className="text-xs text-muted-foreground">Total Forms</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{data.overview.validationRate}%</p>
          <p className="text-xs text-muted-foreground">Validation Rate</p>
        </CardContent>
      </Card>
    </div>

    {/* Daily Trends */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Daily Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="submissions" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>

    {/* Hourly Distribution */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Hourly Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  </div>
);
