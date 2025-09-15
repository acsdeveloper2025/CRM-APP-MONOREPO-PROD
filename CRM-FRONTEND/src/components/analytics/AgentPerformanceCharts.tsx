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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter
} from 'recharts';
import { useAgentPerformance } from '@/hooks/useAnalytics';
import { 
  Users, 
  TrendingUp, 
  Award, 
  Target, 
  Clock, 
  Star,
  BarChart3,
  Activity
} from 'lucide-react';

const PERFORMANCE_COLORS = {
  excellent: '#10b981',
  good: '#3b82f6',
  average: '#f59e0b',
  poor: '#ef4444'
};

export const AgentPerformanceCharts: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState<'overview' | 'individual' | 'comparison' | 'trends'>('overview');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const { data: performanceData, isLoading } = useAgentPerformance({
    dateFrom: getDateFromRange(timeRange),
    dateTo: new Date().toISOString().split('T')[0],
    agentId: selectedAgent !== 'all' ? selectedAgent : undefined,
  });

  const agents = performanceData?.data?.agents || [];
  const summary = performanceData?.data?.summary;
  const topPerformers = performanceData?.data?.topPerformers || [];

  // Prepare chart data
  const agentComparisonData = agents.map(agent => ({
    name: agent.name.split(' ')[0], // First name only for chart
    fullName: agent.name,
    casesAssigned: agent.totalCasesAssigned,
    casesCompleted: agent.casesCompleted,
    completionRate: agent.totalCasesAssigned > 0 ? (agent.casesCompleted / agent.totalCasesAssigned) * 100 : 0,
    qualityScore: agent.formQualityScore,
    avgDays: agent.avgCompletionDays || 0,
    formsSubmitted: agent.residenceFormsSubmitted + agent.officeFormsSubmitted,
    performance: getPerformanceLevel(agent.formQualityScore, agent.totalCasesAssigned > 0 ? (agent.casesCompleted / agent.totalCasesAssigned) * 100 : 0)
  }));

  // Generate productivity trends
  const productivityTrends = generateProductivityTrends(timeRange);

  // Generate radar chart data for selected agent
  const radarData = selectedAgent !== 'all' && agents.length > 0 
    ? generateRadarData(agents.find(a => a.id === selectedAgent) || agents[0])
    : generateRadarData(agents[0]);

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

  function getPerformanceLevel(qualityScore: number, completionRate: number): string {
    const avgScore = (qualityScore + completionRate) / 2;
    if (avgScore >= 90) return 'excellent';
    if (avgScore >= 75) return 'good';
    if (avgScore >= 60) return 'average';
    return 'poor';
  }

  function generateProductivityTrends(range: string) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
        casesCompleted: Math.floor(Math.random() * 15) + 5,
        formsSubmitted: Math.floor(Math.random() * 25) + 10,
        qualityScore: Math.floor(Math.random() * 20) + 75,
        avgCompletionTime: Math.floor(Math.random() * 5) + 3
      });
    }
    
    return data;
  }

  function generateRadarData(agent: any) {
    if (!agent) return [];
    
    const completionRate = agent.totalCasesAssigned > 0 ? (agent.casesCompleted / agent.totalCasesAssigned) * 100 : 0;
    
    return [
      {
        subject: 'Quality Score',
        A: agent.formQualityScore,
        fullMark: 100
      },
      {
        subject: 'Completion Rate',
        A: completionRate,
        fullMark: 100
      },
      {
        subject: 'Productivity',
        A: Math.min((agent.residenceFormsSubmitted + agent.officeFormsSubmitted) * 2, 100),
        fullMark: 100
      },
      {
        subject: 'Speed',
        A: agent.avgCompletionDays ? Math.max(100 - (agent.avgCompletionDays * 10), 0) : 50,
        fullMark: 100
      },
      {
        subject: 'Consistency',
        A: Math.floor(Math.random() * 30) + 70, // Mock data
        fullMark: 100
      },
      {
        subject: 'Reliability',
        A: Math.floor(Math.random() * 25) + 75, // Mock data
        fullMark: 100
      }
    ];
  }

  const getPerformanceColor = (performance: string) => {
    return PERFORMANCE_COLORS[performance as keyof typeof PERFORMANCE_COLORS] || '#6b7280';
  };

  const getPerformanceBadge = (performance: string) => {
    const colors = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      average: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-red-100 text-red-800'
    };
    return colors[performance as keyof typeof colors] || 'bg-muted text-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Agent Performance Analytics</h2>
          <p className="mt-1 text-muted-foreground">
            Comprehensive performance metrics and productivity analysis
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="comparison">Comparison</SelectItem>
              <SelectItem value="trends">Trends</SelectItem>
            </SelectContent>
          </Select>
          {viewType === 'individual' && (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
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
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalAgents || 0}</div>
            <p className="text-xs text-muted-foreground">Active agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cases</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.avgCasesPerAgent ? summary.avgCasesPerAgent.toFixed(1) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Per agent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.avgCompletionRate ? `${summary.avgCompletionRate.toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">Average rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{topPerformers.length}</div>
            <p className="text-xs text-muted-foreground">High achievers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{summary?.activeAgents || 0}</div>
            <p className="text-xs text-muted-foreground">Currently working</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization */}
      {viewType === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Performance Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Distribution</CardTitle>
              <CardDescription>Agent performance levels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'completionRate' ? `${value}%` : value,
                      name === 'completionRate' ? 'Completion Rate' : 
                      name === 'qualityScore' ? 'Quality Score' : name
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="completionRate" fill="#3b82f6" name="Completion Rate %" />
                  <Bar dataKey="qualityScore" fill="#10b981" name="Quality Score" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cases vs Quality Scatter */}
          <Card>
            <CardHeader>
              <CardTitle>Cases vs Quality</CardTitle>
              <CardDescription>Performance correlation analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart data={agentComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="casesCompleted" name="Cases Completed" />
                  <YAxis dataKey="qualityScore" name="Quality Score" />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => [value, name === 'qualityScore' ? 'Quality Score' : 'Cases Completed']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Scatter dataKey="qualityScore" fill="#8b5cf6" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {viewType === 'individual' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Radar</CardTitle>
              <CardDescription>
                {selectedAgent !== 'all' 
                  ? `Performance metrics for ${agents.find(a => a.id === selectedAgent)?.name || 'Selected Agent'}`
                  : 'Overall performance metrics'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Performance"
                    dataKey="A"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Individual Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Metrics</CardTitle>
              <CardDescription>Comprehensive performance breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedAgent !== 'all' ? (
                (() => {
                  const agent = agents.find(a => a.id === selectedAgent);
                  if (!agent) return <div>Agent not found</div>;
                  
                  const completionRate = agent.totalCasesAssigned > 0 ? (agent.casesCompleted / agent.totalCasesAssigned) * 100 : 0;
                  
                  return (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Cases Assigned</span>
                            <span className="font-bold">{agent.totalCasesAssigned}</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Cases Completed</span>
                            <span className="font-bold text-green-600">{agent.casesCompleted}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Completion Rate</span>
                            <Badge className={getPerformanceBadge(getPerformanceLevel(agent.formQualityScore, completionRate))}>
                              {completionRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Quality Score</span>
                            <span className="font-bold">{agent.formQualityScore.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Avg Completion</span>
                            <span className="font-bold">{agent.avgCompletionDays ? `${agent.avgCompletionDays.toFixed(1)}d` : 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Forms Submitted</span>
                            <span className="font-bold">{agent.residenceFormsSubmitted + agent.officeFormsSubmitted}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-3">Form Breakdown</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Residence Forms:</span>
                            <span className="font-medium">{agent.residenceFormsSubmitted}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Office Forms:</span>
                            <span className="font-medium">{agent.officeFormsSubmitted}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Attachments:</span>
                            <span className="font-medium">{agent.attachmentsUploaded}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Select an Agent</h3>
                  <p className="text-muted-foreground">Choose an agent to view detailed metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {viewType === 'comparison' && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Comparison</CardTitle>
            <CardDescription>Side-by-side performance comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={agentComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="casesAssigned" fill="#6b7280" name="Cases Assigned" />
                <Bar dataKey="casesCompleted" fill="#10b981" name="Cases Completed" />
                <Bar dataKey="formsSubmitted" fill="#3b82f6" name="Forms Submitted" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === 'trends' && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Productivity metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={productivityTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="casesCompleted" 
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Cases Completed"
                />
                <Line 
                  type="monotone" 
                  dataKey="formsSubmitted" 
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Forms Submitted"
                />
                <Line 
                  type="monotone" 
                  dataKey="qualityScore" 
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Quality Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
