import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/components/ui/unified-search-filter-layout';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Calendar,
  Clock,
  Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VerificationTasksService } from '@/services/verificationTasks';
import { toast } from 'sonner';

interface CompletedTaskFilters {
  priority?: string;
  [key: string]: unknown;
}

export const CompletedTasksPage: React.FC = () => {
  const navigate = useNavigate();

  // Unified search with 800ms debounce
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useUnifiedFilters<CompletedTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'completed_at',
    sortOrder: 'desc' as 'asc' | 'desc',
    status: 'COMPLETED',
  });

  // Reset pagination when search or filters change
  useEffect(() => {
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, [debouncedSearchValue, activeFilters]);

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks(queryFilters);

  const handleViewTask = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const handleViewCase = (caseId: string) => {
    if (caseId) {
      navigate(`/cases/${caseId}`);
    }
  };

  const handleEditCase = (caseId: string) => {
    if (caseId) {
      navigate(`/cases/new?edit=${caseId}`);
    }
  };

  const handleRevisitTask = async (taskId: string) => {
    try {
      await VerificationTasksService.revisitTask(taskId);
      
      // Show success notification
      toast.success(
        'Revisit task created successfully! The task has been moved to the Revisit tab.',
        {
          duration: 5000,
          // icon: '✅', // Removed icon as Sonner handles success icons well
        }
      );
      
      // Refresh tasks to remove the completed task from the list
      refreshTasks();
      
      // Optionally navigate to revisit tasks page after a short delay
      setTimeout(() => {
        navigate('/tasks/revisit');
      }, 1500);
    } catch (error) {
      console.error('Error creating revisit task:', error);
      toast.error('Failed to create revisit task. Please try again.');
    }
  };

  // Count active filters
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Completed Tasks</h1>
          <p className="text-gray-600 mt-1">
            Verification tasks that have been completed
          </p>
        </div>
        {/* Refresh button moved to UnifiedSearchFilterLayout actions */}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.completed}</div>
            <p className="text-xs text-gray-600">
              All completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
            <p className="text-xs text-gray-600">
              Current period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.completed > 0
                ? Math.round((statistics.completed / (statistics.completed + statistics.inProgress + statistics.pending + statistics.assigned)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-gray-600">
              Overall rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg TAT</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasks.length > 0
                ? Math.round(tasks.reduce((acc, t) => {
                    if (!t.createdAt || !t.completedAt) {return acc;}
                    const created = new Date(t.createdAt);
                    const completed = new Date(t.completedAt);
                    const tatInDays = Math.floor((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                    return acc + tatInDays;
                  }, 0) / tasks.length)
                : 0} days
            </div>
            <p className="text-xs text-gray-600">
              Average turnaround
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Award className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasks.filter(t => {
                if (!t.completedAt) {return false;}
                const completed = new Date(t.completedAt);
                const today = new Date();
                return completed.toDateString() === today.toDateString();
              }).length}
            </div>
            <p className="text-xs text-gray-600">
              Completed today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unified Search & Filter */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search completed tasks..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={3}>
            {/* Priority Filter */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={activeFilters.priority || 'all'}
                onValueChange={(value) => setFilter('priority', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="1">Low</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                  <SelectItem value="4">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
        actions={
          <Button
            variant="outline"
            onClick={() => refreshTasks()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Tasks List */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-600">Error loading tasks: {error}</p>
          </CardContent>
        </Card>
      )}

      <TasksListFlat
        tasks={tasks}
        loading={loading}
        onAssignTask={() => {}}
        onViewTask={handleViewTask}
        onViewCase={handleViewCase}
        onEditCase={handleEditCase}
        onRevisitTask={handleRevisitTask}
      />

      {/* Pagination - Always show for better UX */}
      {pagination.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tasks
              </p>
              {pagination.totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginationState(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginationState(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

