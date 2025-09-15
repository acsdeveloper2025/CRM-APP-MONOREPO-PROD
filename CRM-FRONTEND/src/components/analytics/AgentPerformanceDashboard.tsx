import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgentPerformance } from '@/hooks/useAnalytics';
import { useQuery } from '@tanstack/react-query';
import { departmentsService } from '@/services/departments';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Award, 
  Download, 
  Filter,
  Star,
  Target
} from 'lucide-react';
import type { AgentPerformanceQuery } from '@/services/analytics';

export const AgentPerformanceDashboard: React.FC = () => {
  const [filters, setFilters] = useState<AgentPerformanceQuery>({});

  const { data: performanceData, isLoading: performanceLoading } = useAgentPerformance(filters);
  const { data: departmentsData } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
  });

  const agents = performanceData?.data?.agents || [];
  const summary = performanceData?.data?.summary;
  const topPerformers = performanceData?.data?.topPerformers || [];
  const departments = departmentsData?.data || [];

  const handleFilterChange = (key: keyof AgentPerformanceQuery, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    if (rate >= 70) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Performance</h1>
          <p className="mt-2 text-muted-foreground">
            Track field agent productivity and performance metrics
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalAgents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Field agents in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.activeAgents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently working on cases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cases/Agent</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.avgCasesPerAgent ? summary.avgCasesPerAgent.toFixed(1) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Average workload
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
            <Award className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {summary?.avgCompletionRate ? `${summary.avgCompletionRate.toFixed(1)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span>Top Performers</span>
            </CardTitle>
            <CardDescription>Highest performing agents this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {topPerformers.slice(0, 5).map((agent, index) => {
                const completionRate = agent.totalCasesAssigned > 0 
                  ? (agent.casesCompleted / agent.totalCasesAssigned) * 100 
                  : 0;
                
                return (
                  <div key={agent.id} className="text-center p-4 border rounded-lg">
                    <div className="flex items-center justify-center space-x-1 mb-2">
                      <span className="text-2xl font-bold">#{index + 1}</span>
                      {index === 0 && <Star className="h-5 w-5 text-yellow-500 fill-current" />}
                    </div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">{agent.employeeId}</div>
                    <div className="mt-2">
                      <Badge className={getCompletionRateColor(completionRate)}>
                        {completionRate.toFixed(1)}% completion
                      </Badge>
                    </div>
                    <div className="text-sm mt-1">
                      Quality: <span className={getPerformanceColor(agent.formQualityScore)}>
                        {agent.formQualityScore.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <Select 
                value={filters.departmentId?.toString() || ''} 
                onValueChange={(value) => handleFilterChange('departmentId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentId">Specific Agent</Label>
              <Select 
                value={filters.agentId || ''} 
                onValueChange={(value) => handleFilterChange('agentId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All agents</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Details</CardTitle>
          <CardDescription>
            {agents.length > 0 
              ? `Showing ${agents.length} agent${agents.length === 1 ? '' : 's'}`
              : 'No agents found'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Cases Assigned</TableHead>
                  <TableHead>Cases Completed</TableHead>
                  <TableHead>Completion Rate</TableHead>
                  <TableHead>Forms Submitted</TableHead>
                  <TableHead>Quality Score</TableHead>
                  <TableHead>Avg Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 8 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No agents found</h3>
                      <p className="text-muted-foreground">
                        Try adjusting your filters or check back later.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => {
                    const completionRate = agent.totalCasesAssigned > 0 
                      ? (agent.casesCompleted / agent.totalCasesAssigned) * 100 
                      : 0;
                    
                    return (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-sm text-muted-foreground">{agent.employeeId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{agent.departmentName || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center font-medium">{agent.totalCasesAssigned}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center font-medium text-green-600">{agent.casesCompleted}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCompletionRateColor(completionRate)}>
                            {completionRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {agent.residenceFormsSubmitted}R + {agent.officeFormsSubmitted}O
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`font-medium ${getPerformanceColor(agent.formQualityScore)}`}>
                            {agent.formQualityScore.toFixed(1)}%
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {agent.avgCompletionDays ? `${agent.avgCompletionDays.toFixed(1)}d` : 'N/A'}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
