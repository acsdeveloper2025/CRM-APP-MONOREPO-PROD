import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/components/ui/unified-search-filter-layout';
import {
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CompletedTaskFilters {
  priority?: string;
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

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks(queryFilters);

  const activeFilterCount = Object.keys(activeFilters).filter(
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



  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Completed Tasks</h1>
          <p className="text-muted-foreground mt-1">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.completed}</div>
            <p className="text-xs text-muted-foreground">
              Successfully completed tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
            <p className="text-xs text-muted-foreground">
              Completed in current period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.completed > 0 
                ? Math.round((statistics.completed / (statistics.completed + statistics.inProgress + statistics.pending + statistics.assigned)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall completion rate
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
        onViewTask={handleViewTask}
        onViewCase={handleViewCase}
      />

      {/* Pagination - Always show for better UX */}
      {pagination.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tasks
              </p>
              {pagination.totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFilterChange('page', pagination.page - 1)}
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
                    onClick={() => handleFilterChange('page', pagination.page + 1)}
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

