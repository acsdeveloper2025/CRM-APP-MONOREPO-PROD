import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { TaskAssignmentModal } from '@/components/verification-tasks/TaskAssignmentModal';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { useScopePageReset } from '@/hooks/useScopePageReset';
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
  RefreshCw,
  Package,
  UserCheck,
  TrendingUp,
  Download,
} from 'lucide-react';
import { VerificationTasksService } from '@/services/verificationTasks';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useNavigate } from 'react-router-dom';

interface PendingTaskFilters {
  [key: string]: unknown;
  priority?: string;
  assignedTo?: string;
}

export const PendingTasksPage: React.FC = () => {
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
  } = useUnifiedFilters<PendingTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
    status: 'PENDING,ASSIGNED',
  });

  // P18.M-04: reset to page 1 on scope toggle.
  useScopePageReset(() => setPaginationState((prev) => ({ ...prev, page: 1 })));

  // Reset pagination when search or filters change
  useEffect(() => {
    setPaginationState((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearchValue, activeFilters]);

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
    status: 'PENDING,ASSIGNED',
    excludeUnassignedRevisit: 'true',
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } =
    useAllVerificationTasks(queryFilters);

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
      // Pass both case ID and task ID so we know which specific task to update
      const url = taskId
        ? `/case-management/create-new-case?edit=${caseId}&taskId=${taskId}`
        : `/case-management/create-new-case?edit=${caseId}`;
      navigate(url);
    }
  };

  // Count active filters (simple count of non-undefined values)
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Pending Tasks</h1>
          <p className="mt-2 text-muted-foreground">
            Verification tasks that need assignment or are waiting to be started
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-gray-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Pending</p>
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
              <Package className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold text-foreground">{statistics.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Assigned</p>
                <p className="text-2xl font-bold text-foreground">{statistics.assigned}</p>
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

        {/* P19.B-09: removed "Avg Age" stat card. It computed off the
            current paginated array (tasks.length, page-bounded) so the
            value oscillated as the user paginated and was never the
            true average across all pending tasks. Add a BE-side
            avgAgeDays aggregate to the statistics block in
            verificationTasksController if this number is needed. */}
      </div>

      {/* Unified Search & Filter */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search pending tasks..."
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  toast.info('Generating Excel export...');
                  const blob = await VerificationTasksService.exportToExcel({
                    status: 'PENDING,ASSIGNED',
                  });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `pendingTasks_${new Date().toISOString().split('T')[0]}.xlsx`;
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
            <Button variant="outline" onClick={() => refreshTasks()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
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
              <p className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} tasks
              </p>
              {pagination.totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginationState((prev) => ({ ...prev, page: prev.page - 1 }))}
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
                    onClick={() => setPaginationState((prev) => ({ ...prev, page: prev.page + 1 }))}
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
