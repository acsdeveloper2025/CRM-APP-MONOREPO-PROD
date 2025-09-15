import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  BarChart3, 
  FileText, 
  Clock, 
  Target, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Calendar,
  Download,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { MySubmissions } from './MySubmissions';
import { PerformanceMetrics } from './PerformanceMetrics';
import { OfflineReports } from './OfflineReports';

interface AgentStats {
  todaySubmissions: number;
  weekSubmissions: number;
  monthSubmissions: number;
  qualityScore: number;
  completionRate: number;
  avgResponseTime: number;
  pendingTasks: number;
  completedTasks: number;
}

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, connectionQuality } = useNetworkStatus();
  const [activeTab, setActiveTab] = useState('overview');
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    fetchAgentStats();
    const interval = setInterval(fetchAgentStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAgentStats = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call - replace with actual API
      const mockStats: AgentStats = {
        todaySubmissions: Math.floor(Math.random() * 15) + 5,
        weekSubmissions: Math.floor(Math.random() * 50) + 25,
        monthSubmissions: Math.floor(Math.random() * 200) + 100,
        qualityScore: Math.floor(Math.random() * 20) + 80,
        completionRate: Math.floor(Math.random() * 15) + 85,
        avgResponseTime: Math.floor(Math.random() * 30) + 15,
        pendingTasks: Math.floor(Math.random() * 8) + 2,
        completedTasks: Math.floor(Math.random() * 25) + 15
      };

      setAgentStats(mockStats);
      setLastSync(new Date());
    } catch (error) {
      console.error('Error fetching agent stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4 text-red-500" />;
    
    switch (connectionQuality) {
      case 'excellent':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'good':
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'poor':
        return <Wifi className="h-4 w-4 text-yellow-500" />;
      default:
        return <Wifi className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityScoreBadge = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-blue-100 text-blue-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading && !agentStats) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
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
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{user?.name}</h1>
                <p className="text-sm text-muted-foreground">Field Agent</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getConnectionIcon()}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAgentStats}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Connection Status */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={`flex items-center space-x-1 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>{isOnline ? `Online (${connectionQuality})` : 'Offline'}</span>
            </span>
            {lastSync && (
              <span className="text-muted-foreground">
                Last sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Today</p>
                  <p className="text-2xl font-bold">{agentStats?.todaySubmissions || 0}</p>
                  <p className="text-blue-100 text-xs">Submissions</p>
                </div>
                <FileText className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Quality</p>
                  <p className="text-2xl font-bold">{agentStats?.qualityScore || 0}%</p>
                  <p className="text-green-100 text-xs">Score</p>
                </div>
                <Target className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">This Week</p>
                  <p className="text-2xl font-bold">{agentStats?.weekSubmissions || 0}</p>
                  <p className="text-purple-100 text-xs">Submissions</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Completion</p>
                  <p className="text-2xl font-bold">{agentStats?.completionRate || 0}%</p>
                  <p className="text-orange-100 text-xs">Rate</p>
                </div>
                <CheckCircle className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Summary */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Today's Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Completed</span>
              </div>
              <Badge className="bg-green-100 text-green-800">
                {agentStats?.completedTasks || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium">Pending</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">
                {agentStats?.pendingTasks || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="submissions" className="text-xs">
              <FileText className="h-4 w-4 mr-1" />
              Forms
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">
              <TrendingUp className="h-4 w-4 mr-1" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="offline" className="text-xs">
              <Download className="h-4 w-4 mr-1" />
              Offline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Overview</CardTitle>
                <CardDescription>Your key metrics at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Target className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Quality Score</span>
                  </div>
                  <Badge className={getQualityScoreBadge(agentStats?.qualityScore || 0)}>
                    {agentStats?.qualityScore || 0}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Completion Rate</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {agentStats?.completionRate || 0}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Avg Response Time</span>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800">
                    {agentStats?.avgResponseTime || 0}min
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Monthly Total</span>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800">
                    {agentStats?.monthSubmissions || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Submit New Form
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View My Reports
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Offline Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions">
            <MySubmissions />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceMetrics />
          </TabsContent>

          <TabsContent value="offline">
            <OfflineReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
