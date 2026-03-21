import React, { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { Label } from '@/ui/components/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { TaskAssignmentModal } from '@/components/verification-tasks/TaskAssignmentModal';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/UnifiedSearchFilterLayout';
import {
  ListTodo,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Card } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface TaskFilters {
  status?: string;
  priority?: string;
  [key: string]: string | undefined;
}

export const AllTasksPage: React.FC = () => {
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
  } = useUnifiedFilters<TaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  // Build query with search and filters
  const queryFilters = {
    ...paginationState,
    search: debouncedSearchValue || undefined,
    status: activeFilters.status || undefined,
    priority: activeFilters.priority || undefined,
  };

  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks(queryFilters);

  const activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof TaskFilters] !== undefined
  ).length;

  const handleFilterChange = (key: string, value: string | number) => {
    setPaginationState(prev => ({
      ...prev,
      [key]: value
    }));
  };

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

  const summaryCards = [
    {
      title: 'Total Tasks',
      value: pagination.total,
      detail: 'All active and historical tasks',
      icon: ListTodo,
      tone: 'accent' as const,
    },
    {
      title: 'Pending',
      value: statistics.pending + statistics.assigned,
      detail: 'Awaiting action',
      icon: Clock,
      tone: 'warning' as const,
    },
    {
      title: 'In Progress',
      value: statistics.inProgress,
      detail: 'Currently under execution',
      icon: Users,
      tone: 'neutral' as const,
    },
    {
      title: 'Completed',
      value: statistics.completed,
      detail: 'Successfully closed',
      icon: CheckCircle2,
      tone: 'positive' as const,
    },
    {
      title: 'High Priority',
      value: (statistics.urgent || 0) + (statistics.highPriority || 0),
      detail: 'Urgent + high priority',
      icon: AlertTriangle,
      tone: 'danger' as const,
    },
  ];

  return (
    <Page
      title="All Verification Tasks"
      subtitle="Unified operational view across every verification queue."
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <Button variant="secondary">
            Export
          </Button>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => refreshTasks()} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Task Operations</Badge>
          <Text as="h2" variant="headline">Manage the full verification workload from one queue.</Text>
          <Text variant="body-sm" tone="muted">
            Search broadly, narrow by status or priority, and move into task or case detail from the same surface.
          </Text>
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
            searchPlaceholder="Search tasks by ID, case ID, or description..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
            filterContent={
              <FilterGrid columns={2}>
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
              <Stack direction="horizontal" gap={2} wrap="wrap">
                <Button variant="outline" size="sm">
                  <Download {...{ className: "h-4 w-4 mr-2" }} />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => refreshTasks()} disabled={loading}>
                  <RefreshCw {...{ className: `h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}` }} />
                  Refresh
                </Button>
              </Stack>
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

      <Section className="ui-stagger">
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
