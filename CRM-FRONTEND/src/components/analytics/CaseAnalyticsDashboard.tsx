import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/ui/components/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import { useCaseAnalytics } from '@/hooks/useAnalytics';
import { useClients } from '@/hooks/useClients';
import { useFieldUsers } from '@/hooks/useUsers';
import {
  BarChart3,
  Clock,
  CheckCircle,
  Download,
  Filter,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import type { CaseAnalyticsQuery } from '@/services/analytics';

export const CaseAnalyticsDashboard: React.FC = () => {
  const [filters, setFilters] = useState<CaseAnalyticsQuery>({});

  const { data: analyticsData, isLoading: analyticsLoading } = useCaseAnalytics(filters);
  const { data: clientsData } = useClients();
  const { data: agentsData } = useFieldUsers();

  const cases = analyticsData?.data?.cases || [];
  const summary = analyticsData?.data?.summary;
  const clients = clientsData?.data || [];
  const agents = agentsData || [];

  const handleFilterChange = (key: keyof CaseAnalyticsQuery, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-green-100 text-green-800';
      case 'ASSIGNED':
        return 'bg-yellow-100 text-yellow-800';
      case 'PENDING':
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
      default:
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    }
  };

  return (
    <div {...{ className: "space-y-6" }}>
      {/* Header */}
      <div {...{ className: "flex items-center justify-between" }}>
        <div>
          <h1 {...{ className: "text-3xl font-bold text-gray-900" }}>Case Analytics</h1>
          <p {...{ className: "mt-2 text-gray-600" }}>
            Comprehensive case performance and completion metrics
          </p>
        </div>
        <Button variant="outline">
          <Download {...{ className: "h-4 w-4 mr-2" }} />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div {...{ className: "grid gap-4 md:grid-cols-4" }}>
        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>Total Cases</CardTitle>
            <BarChart3 {...{ className: "h-4 w-4 text-gray-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold" }}>{summary?.totalCases || 0}</div>
            <p {...{ className: "text-xs text-gray-600" }}>
              All cases in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>Completed Cases</CardTitle>
            <CheckCircle {...{ className: "h-4 w-4 text-green-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold text-green-600" }}>{summary?.completedCases || 0}</div>
            <p {...{ className: "text-xs text-gray-600" }}>
              {summary?.completionRate ? `${summary.completionRate.toFixed(1)}% completion rate` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>Avg Completion Time</CardTitle>
            <Clock {...{ className: "h-4 w-4 text-green-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold text-green-600" }}>
              {summary?.avgCompletionDays ? `${summary.avgCompletionDays.toFixed(1)}d` : 'N/A'}
            </div>
            <p {...{ className: "text-xs text-gray-600" }}>
              Average days to complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
            <CardTitle {...{ className: "text-sm font-medium" }}>Form Completion</CardTitle>
            <FileText {...{ className: "h-4 w-4 text-green-600" }} />
          </CardHeader>
          <CardContent>
            <div {...{ className: "text-2xl font-bold text-green-600" }}>
              {summary?.avgFormCompletion ? `${summary.avgFormCompletion.toFixed(1)}%` : 'N/A'}
            </div>
            <p {...{ className: "text-xs text-gray-600" }}>
              Average form completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      {summary?.statusDistribution && (
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current case status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div {...{ className: "grid gap-4 md:grid-cols-4" }}>
              {Object.entries(summary.statusDistribution).map(([status, count]) => (
                <div key={status} {...{ className: "text-center" }}>
                  <div {...{ className: "text-2xl font-bold" }}>{count}</div>
                  <Badge {...{ className: getStatusColor(status) }} variant="outline">
                    {status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle {...{ className: "flex items-center space-x-2" }}>
            <Filter {...{ className: "h-5 w-5" }} />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div {...{ className: "grid gap-4 md:grid-cols-5" }}>
            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="clientId">Client</Label>
              <Select 
                value={filters.clientId?.toString() || ''} 
                onValueChange={(value) => handleFilterChange('clientId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="agentId">Agent</Label>
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
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={filters.status || ''} 
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Case Details</CardTitle>
          <CardDescription>
            {cases.length > 0 
              ? `Showing ${cases.length} case${cases.length === 1 ? '' : 's'}`
              : 'No cases found'
            }
          </CardDescription>
        </CardHeader>
        <CardContent {...{ className: "p-0" }}>
          <div {...{ className: "border rounded-lg" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Forms</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyticsLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 8 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <div {...{ className: "h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : cases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} {...{ className: "text-center py-8" }}>
                      <BarChart3 {...{ className: "mx-auto h-12 w-12 text-gray-600" }} />
                      <h3 {...{ className: "mt-4 text-lg font-semibold" }}>No cases found</h3>
                      <p {...{ className: "text-gray-600" }}>
                        Try adjusting your filters or check back later.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  cases.map((caseItem) => (
                    <TableRow key={caseItem.id}>
                      <TableCell {...{ className: "font-medium" }}>
                        <Link
                          to={`/cases/${caseItem.id}`}
                          {...{ className: "text-primary hover:underline" }}
                        >
                          #{caseItem.caseId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div {...{ className: "font-medium" }}>{caseItem.customerName}</div>
                          <div {...{ className: "text-sm text-gray-600" }}>{caseItem.clientName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge {...{ className: getStatusColor(caseItem.status) }}>
                          {caseItem.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge {...{ className: getPriorityColor(caseItem.priority) }} variant="outline">
                          {caseItem.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div {...{ className: "font-medium" }}>{caseItem.agentName || 'Unassigned'}</div>
                          <div {...{ className: "text-sm text-gray-600" }}>{caseItem.employeeId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div {...{ className: "text-sm" }}>
                          {caseItem.residenceReports}R + {caseItem.officeReports}O
                        </div>
                      </TableCell>
                      <TableCell>
                        <div {...{ className: "flex items-center space-x-2" }}>
                          <div {...{ className: "text-sm font-medium" }}>
                            {caseItem.formCompletionPercentage}%
                          </div>
                          <div {...{ className: "w-16 bg-slate-100 dark:bg-slate-800/60 rounded-full h-2" }}>
                            <div 
                              {...{ className: "bg-blue-600 h-2 rounded-full" }} 
                              style={{ width: `${caseItem.formCompletionPercentage}%` }}
                             />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div {...{ className: "text-sm" }}>
                          {formatDistanceToNow(new Date(caseItem.updatedAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
