import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOverdueTasks, useTATStats } from '@/hooks/useDashboard';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  AlertTriangle,
  User,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Download,
} from 'lucide-react';
import { VerificationTasksService } from '@/services/verificationTasks';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { cn } from '@/lib/utils';
import type { OverdueTask, OverdueTasksResponse } from '@/types/dto/dashboard.dto';

interface TATMonitoringFilters {
  priority?: string;
  status?: string;
  [key: string]: unknown;
}

export const TATMonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'critical' | 'all'>('critical');
  const [criticalPage, setCriticalPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [sortBy, setSortBy] = useState('daysOverdue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Unified search with 800ms debounce
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({
      syncWithUrl: true,
    });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useUnifiedFilters<TATMonitoringFilters>({
    syncWithUrl: true,
  });

  // Reset pagination when search or filters change
  useEffect(() => {
    setCriticalPage(1);
    setAllPage(1);
  }, [debouncedSearchValue, activeFilters]);

  // Fetch TAT Statistics for the cards
  const { data: tatStatsData } = useTATStats();
  const tatStats = tatStatsData?.data;

  // Common filter params
  const filterParams = {
    sortBy,
    sortOrder,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
    status: activeFilters.status || undefined,
  };

  // Fetch critical overdue tasks (>3 days)
  const {
    data: criticalData,
    isLoading: criticalLoading,
    refetch: refetchCritical,
  } = useOverdueTasks({
    threshold: 3,
    page: criticalPage,
    limit: 20,
    ...filterParams,
  });

  // Fetch all overdue tasks (>1 day)
  const {
    data: allData,
    isLoading: allLoading,
    refetch: refetchAll,
  } = useOverdueTasks({
    threshold: 1,
    page: allPage,
    limit: 20,
    ...filterParams,
  });

  const handleRefresh = () => {
    refetchCritical();
    refetchAll();
  };

  const criticalTasks = criticalData?.data?.tasks || [];
  const criticalPagination = criticalData?.data?.pagination || {
    page: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20,
    total: 0,
  };

  const allTasks = allData?.data?.tasks || [];
  const allPagination = allData?.data?.pagination || {
    page: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20,
    total: 0,
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-yellow-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'ASSIGNED':
        return 'bg-green-100 text-green-800 border-blue-300';
      case 'IN_PROGRESS':
        return 'bg-green-100 text-green-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDaysOverdueColor = (days: number) => {
    if (days > 3) {
      return 'text-red-600 font-bold';
    }
    if (days > 1) {
      return 'text-yellow-600 font-semibold';
    }
    return 'text-yellow-600';
  };

  const renderTaskTable = (
    tasks: OverdueTask[],
    isLoading: boolean,
    pagination: OverdueTasksResponse['pagination'],
    onPageChange: (page: number) => void
  ) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    if (tasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-600">
          <Clock className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No overdue tasks found</p>
          <p className="text-sm">All tasks are within TAT!</p>
        </div>
      );
    }

    return (
      <>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('taskNumber')}>
                  <div className="flex items-center space-x-1">
                    <span>Task Number</span>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Case Number</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('customerName')}>
                  <div className="flex items-center space-x-1">
                    <span>Customer</span>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Verification Type</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('daysOverdue')}>
                  <div className="flex items-center space-x-1">
                    <span>Days Overdue</span>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('priority')}>
                  <div className="flex items-center space-x-1">
                    <span>Priority</span>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                >
                  <TableCell className="font-medium">{task.taskNumber}</TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      className="p-0 h-auto font-normal"
                      onClick={() => navigate(`/case-management/${task.caseId}`)}
                    >
                      {task.caseNumber}
                    </Button>
                  </TableCell>
                  <TableCell>{task.customerName}</TableCell>
                  <TableCell className="text-sm">{task.verificationTypeName}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-600" />
                      <span className="text-sm">{task.assignedToName || 'Unassigned'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn('font-semibold', getDaysOverdueColor(task.daysOverdue))}>
                      {task.daysOverdue} {task.daysOverdue === 1 ? 'day' : 'days'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/verification-tasks/${task.id}`)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * 20 + 1} to{' '}
              {Math.min(pagination.page * 20, pagination.totalCount)} of {pagination.totalCount}{' '}
              tasks
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </>
    );
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">TAT Monitoring</h1>
          <p className="text-gray-600 mt-1">Track and manage overdue verification tasks</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalPagination.totalCount}</div>
            <p className="text-xs text-gray-600">More than 3 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{allPagination.totalCount}</div>
            <p className="text-xs text-gray-600">More than 1 day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Track</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{tatStats?.onTrack || 0}</div>
            <p className="text-xs text-gray-600">Within TAT</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg TAT</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tatStats?.avgOverdueDays || 0} days</div>
            <p className="text-xs text-gray-600">Average overdue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tatStats?.completedToday || 0}</div>
            <p className="text-xs text-gray-600">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search task number, case number, customer..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={2}>
            {/* Priority Filter */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={activeFilters.priority || 'all'}
                onValueChange={(value) =>
                  setFilter('priority', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={activeFilters.status || 'all'}
                onValueChange={(value) => setFilter('status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  toast.info('Generating Excel export...');
                  const blob = await VerificationTasksService.exportToExcel({});
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tat_monitoring_${new Date().toISOString().split('T')[0]}.xlsx`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('Export downloaded');
                } catch (err) {
                  logger.error('Export failed:', err);
                  toast.error('Export failed');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={criticalLoading || allLoading}
            >
              <RefreshCw
                className={cn('h-4 w-4 mr-2', (criticalLoading || allLoading) && 'animate-spin')}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Overdue Tasks</CardTitle>
          <CardDescription>
            View and manage tasks that have exceeded their turnaround time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'critical' | 'all')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="critical" className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Critical Overdue (&gt;3 Days)</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>All Overdue Tasks (&gt;1 Day)</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="critical" className="mt-6">
              {renderTaskTable(criticalTasks, criticalLoading, criticalPagination, setCriticalPage)}
            </TabsContent>
            <TabsContent value="all" className="mt-6">
              {renderTaskTable(allTasks, allLoading, allPagination, setAllPage)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
