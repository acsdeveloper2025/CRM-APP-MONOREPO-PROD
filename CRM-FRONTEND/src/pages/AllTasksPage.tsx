import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { logger } from '@/utils/logger';
import { VerificationTasksService } from '@/services/verificationTasks';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { TaskAssignmentModal } from '@/components/verification-tasks/TaskAssignmentModal';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { useScopePageReset } from '@/hooks/useScopePageReset';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import {
  ListTodo,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TaskFilters {
  status?: string;
  priority?: string;
  [key: string]: string | undefined;
}

export const AllTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
  } = useUnifiedFilters<TaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  // P18.M-04: reset to page 1 on scope toggle.
  useScopePageReset(() => setPaginationState((prev) => ({ ...prev, page: 1 })));

  // Build query with search and filters
  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    status: activeFilters.status || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } =
    useAllVerificationTasks(queryFilters);

  const activeFilterCount = Object.keys(activeFilters).filter(
    (key) => activeFilters[key as keyof TaskFilters] !== undefined
  ).length;

  const handleFilterChange = (key: string, value: string | number) => {
    setPaginationState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAssignTask = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleViewTask = (taskId: string) => {
    navigate(`/task-management/${taskId}`);
  };

  const handleViewCase = (caseId: string) => {
    if (caseId) {
      navigate(`/case-management/${caseId}`);
    }
  };

  const handleEditCase = (caseId: string, taskId?: string) => {
    if (caseId) {
      const url = taskId
        ? `/case-management/create-new-case?edit=${caseId}&taskId=${taskId}`
        : `/case-management/create-new-case?edit=${caseId}`;
      navigate(url);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header — matches CasesPage */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">All Tasks</h1>
          <p className="mt-2 text-muted-foreground">Manage and track all verification tasks</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ListTodo className="h-8 w-8 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold text-foreground">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-foreground">
                  {statistics.pending + statistics.assigned}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-foreground">{statistics.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-foreground">{statistics.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-foreground">
                  {(statistics.urgent || 0) + (statistics.highPriority || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unified Search and Filter Layout — BELOW cards, matches CasesPage */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search tasks by ID, case ID, or description..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={2}>
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
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  toast.info('Generating Excel export...');
                  const blob = await VerificationTasksService.exportToExcel({
                    status: activeFilters.status,
                    priority: activeFilters.priority,
                    search: debouncedSearchValue || undefined,
                  });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('Export downloaded successfully');
                } catch (error) {
                  logger.error('Export failed:', error);
                  toast.error('Failed to export tasks');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => refreshTasks()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </>
        }
      />

      {/* Tasks List */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-red-600">
              Could not load tasks. Check your connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshTasks()}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <TasksListFlat
        tasks={tasks}
        loading={loading}
        onAssignTask={handleAssignTask}
        onViewTask={handleViewTask}
        onViewCase={handleViewCase}
        onEditCase={handleEditCase}
      />

      {/* Pagination - Always show for better UX */}
      {pagination.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} tasks
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
