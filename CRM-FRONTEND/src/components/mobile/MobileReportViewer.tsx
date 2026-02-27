import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Target,
  CheckCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { MobileReportsService } from '@/services/mobileReports';

interface MobileReportViewerProps {
  reportId?: string;
  reportType: 'performance' | 'submissions' | 'analytics';
  onBack: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface PerformanceData {
  qualityScore: number;
  completionRate: number;
  avgResponseTime: number;
  submissions: number;
  trends: Array<{ date: string; score: number; submissions: number }>;
  breakdown: Array<{ metric: string; value: number }>;
}

interface SubmissionItem {
  id: string;
  customer: string;
  type: string;
  status: string;
  date: string;
}

interface SubmissionsData {
  total: number;
  recent: SubmissionItem[];
  byType: Array<{ type: string; count: number; percentage: number }>;
  byStatus: Array<{ status: string; count: number; percentage: number }>;
}

interface AnalyticsData {
  overview: {
    totalForms: number;
    validationRate: number;
    avgQuality: number;
    totalTime: number;
  };
  daily: Array<{ date: string; submissions: number; quality: number }>;
  hourly: Array<{ hour: string; count: number }>;
}

type ReportData = PerformanceData | SubmissionsData | AnalyticsData | null;

export const MobileReportViewer: React.FC<MobileReportViewerProps> = ({
  reportId,
  reportType,
  onBack
}) => {
  const { isOnline } = useNetworkStatus();
  const { getReport, updateLastAccessed } = useOfflineStorage();
  const [reportData, setReportData] = useState<ReportData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_activeTab, _setActiveTab] = useState('overview');

  useEffect(() => {
    loadReportData();
    if (reportId) {
      updateLastAccessed(reportId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, reportType]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      
      setIsLoading(true);
      
      let data: ReportData = null;
      if (reportId) {
        // Load from offline storage
        const offlineReport = getReport(reportId);
        data = offlineReport?.data as ReportData;
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

  const fetchFreshReportData = async (type: string): Promise<ReportData> => {
    switch (type) {
      case 'performance':
        return MobileReportsService.getPerformanceReportData();
      
      case 'submissions':
        return MobileReportsService.getSubmissionsReportData();
      
      case 'analytics':
        return MobileReportsService.getAnalyticsReportData();
      
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
        console.warn('Error sharing:', error);
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
      <div className="min-h-screen bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!reportData && !isOnline) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-800/60">
        <div className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">{getReportTitle()}</h1>
          </div>
        </div>
        
        <div className="p-4 text-center py-16">
          <WifiOff className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Offline Mode</h3>
          <p className="text-gray-600 mb-4">
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800/60">
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
                <p className="text-sm text-gray-600">
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
          <PerformanceReportContent data={reportData as PerformanceData} />
        )}
        {reportType === 'submissions' && (
          <SubmissionsReportContent data={reportData as SubmissionsData} />
        )}
        {reportType === 'analytics' && (
          <AnalyticsReportContent data={reportData as AnalyticsData} />
        )}
      </div>
    </div>
  );
};

// Performance Report Component
const PerformanceReportContent: React.FC<{ data: PerformanceData }> = ({ data }) => (
  <div className="space-y-4">
    {/* Key Metrics */}
    <div className="grid grid-cols-2 gap-3">
      <Card className="bg-linear-to-r from-blue-500 to-blue-600 text-white">
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



      <Card className="bg-linear-to-r from-green-500 to-green-600 text-white">
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
          {data.breakdown.map((item) => (
            <div key={item.metric} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
              <span className="font-medium">{item.metric}</span>
              <Badge className={
                item.value >= 90 ? 'bg-green-100 text-green-800' :
                item.value >= 80 ? 'bg-green-100 text-green-800' :
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
const SubmissionsReportContent: React.FC<{ data: SubmissionsData }> = ({ data }) => (
  <div className="space-y-4">
    {/* Summary */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submissions Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-3xl font-bold text-green-600">{data.total}</p>
          <p className="text-gray-600">Total Submissions</p>
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
                {data.byType.map((_entry, index) => (
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
          {data.recent.map((submission) => (
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
              <div className="flex items-center justify-between text-sm text-gray-600">
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
const AnalyticsReportContent: React.FC<{ data: AnalyticsData }> = ({ data }) => (
  <div className="space-y-4">
    {/* Overview Cards */}
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{data.overview.totalForms}</p>
          <p className="text-xs text-gray-600">Total Forms</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{data.overview.validationRate}%</p>
          <p className="text-xs text-gray-600">Validation Rate</p>
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
