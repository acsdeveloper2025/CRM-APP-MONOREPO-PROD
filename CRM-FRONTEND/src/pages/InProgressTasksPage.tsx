import React, { useState, useEffect } from 'react';
import { Button } from '@/ui/components/button';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { TaskAssignmentModal } from '@/components/verification-tasks/TaskAssignmentModal';
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
  Play,
  Clock,
  RefreshCw,
  TrendingUp,
  Users
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

interface InProgressTaskFilters {
  priority?: string;
  [key: string]: unknown;
}

export const InProgressTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
  } = useUnifiedFilters<InProgressTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'started_at',
    sortOrder: 'asc' as 'asc' | 'desc',
    status: 'IN_PROGRESS',
  });

  // Reset pagination when search or filters change
  useEffect(() => {
    setPaginationState((prev) => {
      if (prev.page === 1) {
        return prev;
      }
      return { ...prev, page: 1 };
    });
  }, [debouncedSearchValue, activeFilters]);

  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks(queryFilters);

  const handleFilterChange = (key: string, value: unknown) => {
    if (key === 'page') {
      setPaginationState(prev => ({ ...prev, page: value as number }));
    } else {
      setFilter(key as keyof InProgressTaskFilters, value);
    }
  };

  // Use backend statistics
  const { 
    inProgress: totalInProgress = 0,
    longRunning: longRunningTasks = 0,
    urgent = 0,
    highPriority = 0,
    totalAgents = 0,
    avgDuration = 0
  } = statistics || {};

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

  const handleEditCase = (caseId: string, taskId?: string) => {
    if (caseId) {
      const url = taskId ? `/cases/new?edit=${caseId}&taskId=${taskId}` : `/cases/new?edit=${caseId}`;
      navigate(url);
    }
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  const summaryCards = [
    { title: 'Total In Progress', value: totalInProgress, detail: 'Active tasks', icon: Play, tone: 'accent' as const },
    { title: 'Long Running', value: longRunningTasks, detail: '> 24 hours', icon: Clock, tone: 'warning' as const },
    { title: 'High Priority', value: urgent + highPriority, detail: 'Urgent + high', icon: TrendingUp, tone: 'danger' as const },
    { title: 'Active Agents', value: totalAgents, detail: 'Field agents', icon: Users, tone: 'positive' as const },
    { title: 'Avg Duration', value: `${Math.round(avgDuration)}h`, detail: 'Average runtime', icon: TrendingUp, tone: 'neutral' as const },
  ];

  return (
    <Page
      title="In Progress Tasks"
      subtitle="Live execution queue for work already in the field."
      shell
      actions={
        <UiButton variant="secondary" icon={<RefreshCw size={16} />} onClick={() => refreshTasks()} disabled={loading}>
          Refresh
        </UiButton>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Operational Queue</Badge>
          <Text as="h2" variant="headline">Watch running tasks before they drift into TAT risk.</Text>
          <Text variant="body-sm" tone="muted">Track long-running work, agent load, and urgent items in one view.</Text>
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
            searchPlaceholder="Search in-progress tasks..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
            filterContent={
              <FilterGrid columns={3}>
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
          onAssignTask={handleAssignTask}
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
          onPrevious={() => handleFilterChange('page', pagination.page - 1)}
          onNext={() => handleFilterChange('page', pagination.page + 1)}
        />
      </Section>

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
    </Page>
  );
};
