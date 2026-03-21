import React, { useState, useEffect } from 'react';
import { Button } from '@/ui/components/button';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/unified-search-filter-layout';
import { Label } from '@/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import {
  RefreshCw,
  Copy,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Button as UiButton } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface RevisitTaskFilters {
  priority?: string;
  status?: string;
  [key: string]: unknown;
}

export const RevisitTasksPage: React.FC = () => {
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
  } = useUnifiedFilters<RevisitTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc',
    task_type: 'REVISIT',
    // Exclude completed tasks - they should only show in Completed Tasks page
    status: activeFilters.status || 'PENDING,ASSIGNED,IN_PROGRESS',
  });

  // Reset pagination when search or filters change
  useEffect(() => {
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, [debouncedSearchValue, activeFilters]);

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
    // Override status if user has a specific filter, otherwise use the default from paginationState
    status: activeFilters.status || paginationState.status,
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

  const handleEditCase = (caseId: string, taskId?: string) => {
    if (caseId) {
      // Pass both case ID and task ID so we know which specific task to update
      const url = taskId ? `/cases/new?edit=${caseId}&taskId=${taskId}` : `/cases/new?edit=${caseId}`;
      navigate(url);
    }
  };

  // Count active filters
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  const summaryCards = [
    { title: 'Total Revisit Tasks', value: pagination.total, detail: 'All revisit tasks', icon: Copy, tone: 'accent' as const },
    {
      title: 'This Month',
      value: tasks.filter(t => {
        if (!t.createdAt) {
          return false;
        }
        const created = new Date(t.createdAt);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length,
      detail: 'Current period',
      icon: Calendar,
      tone: 'neutral' as const,
    },
    {
      title: 'Completion Rate',
      value: `${pagination.total > 0 ? Math.round((statistics.completed / pagination.total) * 100) : 0}%`,
      detail: 'Completed revisits',
      icon: TrendingUp,
      tone: 'positive' as const,
    },
    { title: 'Pending', value: statistics.pending + statistics.assigned, detail: 'Awaiting verification', icon: Clock, tone: 'warning' as const },
    { title: 'High Priority', value: (statistics.urgent || 0) + (statistics.highPriority || 0), detail: 'Urgent + high', icon: AlertTriangle, tone: 'danger' as const },
  ];

  return (
    <Page
      title="Revisit Tasks"
      subtitle="Re-verification work cloned from completed or reopened cases."
      shell
      actions={
        <UiButton variant="secondary" icon={<RefreshCw size={16} />} onClick={() => refreshTasks()} disabled={loading}>
          Refresh
        </UiButton>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="warning">Revisit Queue</Badge>
          <Text as="h2" variant="headline">Keep follow-up work separate from the primary queue.</Text>
          <Text variant="body-sm" tone="muted">Track cloned tasks, prioritize unresolved revisits, and open the parent case quickly.</Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid items={summaryCards} />
      </Section>

      <Section>
        <Card tone="strong" {...{ className: "ui-filter-bar" }} staticCard>
          <UnifiedSearchFilterLayout
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={clearSearch}
            isSearchLoading={isDebouncing}
            searchPlaceholder="Search revisit tasks..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
            filterContent={
              <FilterGrid columns={3}>
                <div {...{ className: "space-y-2" }}>
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
                      <SelectItem value="REVOKED">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div {...{ className: "space-y-2" }}>
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
              <Button variant="outline" onClick={() => refreshTasks()} disabled={loading}>
                <RefreshCw {...{ className: `h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}` }} />
                Refresh
              </Button>
            }
          />
        </Card>
      </Section>

      {error ? (
        <Section>
          <Card>
            <Text variant="body-sm" tone="danger">Error loading tasks: {error}</Text>
          </Card>
        </Section>
      ) : null}

      <Section>
        <TasksListFlat
          tasks={tasks}
          loading={loading}
          onAssignTask={() => {}}
          onViewTask={handleViewTask}
          onViewCase={handleViewCase}
          onEditCase={handleEditCase}
        />
      </Section>

      <Section>
        <PaginationStatusCard
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPrevious={() => setPaginationState(prev => ({ ...prev, page: prev.page - 1 }))}
          onNext={() => setPaginationState(prev => ({ ...prev, page: prev.page + 1 }))}
        />
      </Section>
    </Page>
  );
};
