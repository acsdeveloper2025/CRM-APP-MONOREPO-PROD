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
  UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RevokedTaskFilters {
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
    sortBy: 'revoked_at',
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

  const handleViewTask = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const handleViewCase = (caseId: string) => {
    if (caseId) {
      navigate(`/cases/${caseId}`);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6" style={{ backgroundColor: '#FAFAFA' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#000000' }}>Revoked Tasks</h1>
          <p className="mt-1" style={{ color: '#1F2937' }}>
            Verification tasks that have been revoked by field agents
          </p>
        </div>
        <Button
          onClick={refreshTasks}
          variant="outline"
          size="sm"
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
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
              {statistics?.totalTasks || 0}
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
              {statistics?.highPriorityTasks || 0}
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
              {statistics?.uniqueCases || 0}
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
              {statistics?.uniqueFieldAgents || 0}
            </div>
            <p className="text-xs mt-1" style={{ color: '#1F2937' }}>
              Agents who revoked tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onClearSearch={clearSearch}
        isDebouncing={isDebouncing}
        searchPlaceholder="Search by task number, case number, customer name..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      >
        <FilterGrid>
          <div className="space-y-2">
            <Label htmlFor="priority-filter" style={{ color: '#1F2937' }}>Priority</Label>
            <Select
              value={activeFilters.priority || 'all'}
              onValueChange={(value) => setFilter('priority', value === 'all' ? undefined : value)}
            >
              <SelectTrigger id="priority-filter">
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
      </UnifiedSearchFilterLayout>

      {/* Tasks List */}
      <Card style={{ backgroundColor: '#FFFFFF' }}>
        <CardHeader>
          <CardTitle style={{ color: '#000000' }}>Revoked Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <TasksListFlat
            tasks={tasks}
            loading={loading}
            onViewTask={handleViewTask}
            onViewCase={handleViewCase}
            emptyMessage="No revoked tasks found"
            emptyDescription="Tasks revoked by field agents will appear here"
            pagination={{
              currentPage: pagination?.currentPage || 1,
              totalPages: pagination?.totalPages || 1,
              totalItems: pagination?.totalItems || 0,
              itemsPerPage: pagination?.itemsPerPage || 20,
              onPageChange: (page) => setPaginationState(prev => ({ ...prev, page })),
              onItemsPerPageChange: (limit) => setPaginationState(prev => ({ ...prev, limit, page: 1 })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default RevokedTasksPage;

