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
  XCircle,
  AlertTriangle,
  RefreshCw,
  Package,
  UserCheck,
  Download
} from 'lucide-react';
import { VerificationTasksService } from '@/services/verificationTasks';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useNavigate } from 'react-router-dom';
import { VerificationTask } from '@/types/verificationTask';

interface RevokedTaskFilters {
  [key: string]: unknown;
  priority?: string;
}

export const RevokedTasksPage: React.FC = () => {
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
  } = useUnifiedFilters<RevokedTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'revokedAt',
    sortOrder: 'desc' as 'asc' | 'desc',
    status: 'REVOKED',
  });

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks(queryFilters);

  const activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof RevokedTaskFilters] !== undefined
  ).length;

  const totalRevoked = statistics?.revoked || pagination?.total || 0;
  const highPriorityCount = (statistics?.highPriority || 0) + (statistics?.urgent || 0);
  const uniqueCases = new Set(tasks.map((t: VerificationTask) => t.caseId)).size;
  const uniqueFieldAgents = new Set(tasks.map((t: VerificationTask) => t.assignedTo?.id).filter(Boolean)).size;

  const handleViewTask = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const handleViewCase = (caseId: string) => {
    if (caseId) {
      navigate(`/cases/${caseId}`);
    }
  };

  const handleEditCase = (caseId: string, taskId?: string) => {
    if (caseId) {
      const url = taskId ? `/cases/new?edit=${caseId}&taskId=${taskId}` : `/cases/new?edit=${caseId}`;
      navigate(url);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6" style={{ backgroundColor: '#FAFAFA' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: '#000000' }}>Revoked Tasks</h1>
          <p className="mt-1" style={{ color: '#1F2937' }}>
            Verification tasks that have been revoked by field agents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
 toast.info('Generating Excel export...'); const blob = await VerificationTasksService.exportToExcel({ status: 'REVOKED' }); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `revoked_tasks_${new Date().toISOString().split('T')[0]}.xlsx`; a.click(); window.URL.revokeObjectURL(url); toast.success('Export downloaded');
            } catch (err) { logger.error('Export failed:', err); toast.error('Export failed'); }
          }}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
          <Button onClick={() => refreshTasks()} variant="outline" size="sm" disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card style={{ backgroundColor: '#FFFFFF' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#1F2937' }}>Total Revoked</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#000000' }}>
              {totalRevoked}
            </div>
            <p className="text-xs mt-1" style={{ color: '#1F2937' }}>
              Tasks revoked by field agents
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#FFFFFF' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#1F2937' }}>High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4" style={{ color: '#10B981' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#000000' }}>
              {highPriorityCount}
            </div>
            <p className="text-xs mt-1" style={{ color: '#1F2937' }}>
              Urgent attention needed
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#FFFFFF' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#1F2937' }}>Unique Cases</CardTitle>
            <Package className="h-4 w-4" style={{ color: '#10B981' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#000000' }}>
              {uniqueCases}
            </div>
            <p className="text-xs mt-1" style={{ color: '#1F2937' }}>
              Cases with revoked tasks
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#FFFFFF' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#1F2937' }}>Field Agents</CardTitle>
            <UserCheck className="h-4 w-4" style={{ color: '#10B981' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#000000' }}>
              {uniqueFieldAgents}
            </div>
            <p className="text-xs mt-1" style={{ color: '#1F2937' }}>
              Agents who revoked tasks
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
        searchPlaceholder="Search by task number, case number, customer name..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={3}>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={activeFilters.priority || 'all'}
                onValueChange={(value) => setFilter('priority', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All Priorities" />
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
          </FilterGrid>
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
        onViewTask={handleViewTask}
        onViewCase={handleViewCase}
        onEditCase={handleEditCase}
        onAssignTask={() => {}}
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

export default RevokedTasksPage;
