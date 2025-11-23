import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
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

interface CompletedTaskFilters {
  priority?: string;
}

export const CompletedTasksPage: React.FC = () => {
  const navigate = useNavigate();

  // Unified search with 800ms debounce
  const {
    searchValue: _searchValue,
    debouncedSearchValue,
    setSearchValue: _setSearchValue,
    clearSearch: _clearSearch,
    isDebouncing: _isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
    setFilter: _setFilter,
    clearFilters: _clearFilters,
    hasActiveFilters: _hasActiveFilters,
  } = useUnifiedFilters<CompletedTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, _setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'completed_at',
    sortOrder: 'desc' as 'asc' | 'desc',
    status: 'COMPLETED',
  });

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks(queryFilters);

  const _activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof CompletedTaskFilters] !== undefined
  ).length;

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
      console.log('Revisit task created successfully');
      // Refresh tasks to show any updates if needed (though new task won't be in completed list)
      refreshTasks();
    } catch (error) {
      console.error('Error creating revisit task:', error);
      alert('Failed to create revisit task. Please try again.');
    }
  };



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
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshTasks()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
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
                    onClick={() => _setPaginationState(prev => ({ ...prev, page: prev.page - 1 }))}
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
                    onClick={() => _setPaginationState(prev => ({ ...prev, page: prev.page + 1 }))}
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

