import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { TaskAssignmentModal } from '@/components/verification-tasks/TaskAssignmentModal';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import {
  Play,
  Clock,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InProgressTaskFilters {
  priority?: string;
}

export const InProgressTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
  } = useUnifiedFilters<InProgressTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, _setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'started_at',
    sortOrder: 'asc' as 'asc' | 'desc',
    status: 'IN_PROGRESS',
  });

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks(queryFilters);

  const _activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof InProgressTaskFilters] !== undefined
  ).length;

  // Calculate statistics
  const activeAgents = new Set(tasks.map(t => t.assignedTo).filter(Boolean)).size;
  const longRunningTasks = tasks.filter(t => {
    if (!t.startedAt) {return false;}
    const hoursSinceStart = (Date.now() - new Date(t.startedAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceStart > 24; // More than 24 hours
  }).length;

  const handleAssignTask = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

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
          <h1 className="text-3xl font-bold tracking-tight">In Progress Tasks</h1>
          <p className="text-gray-600 mt-1">
            Verification tasks currently being worked on by field agents
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
            <CardTitle className="text-sm font-medium">Total In Progress</CardTitle>
            <Play className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.inProgress}</div>
            <p className="text-xs text-gray-600">
              Active tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Long Running</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{longRunningTasks}</div>
            <p className="text-xs text-gray-600">
              &gt; 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.highPriority}</div>
            <p className="text-xs text-gray-600">
              Urgent + High
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgents}</div>
            <p className="text-xs text-gray-600">
              Field agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasks.length > 0
                ? Math.round(tasks.reduce((acc, t) => {
                    const started = new Date(t.createdAt);
                    const now = new Date();
                    const durationInHours = Math.floor((now.getTime() - started.getTime()) / (1000 * 60 * 60));
                    return acc + durationInHours;
                  }, 0) / tasks.length)
                : 0}h
            </div>
            <p className="text-xs text-gray-600">
              Average runtime
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
        onAssignTask={handleAssignTask}
        onViewTask={handleViewTask}
        onViewCase={handleViewCase}
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

      {/* Task Assignment Modal */}
      {selectedTaskId && (
        <TaskAssignmentModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onSuccess={() => {
            setSelectedTaskId(null);
            refreshTasks();
          }}
        />
      )}
    </div>
  );
};

