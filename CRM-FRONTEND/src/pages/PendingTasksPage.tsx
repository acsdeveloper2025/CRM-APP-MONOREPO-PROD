import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
  Clock,
  AlertTriangle,
  RefreshCw,
  Package,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Grid } from '@/ui/layout/Grid';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface PendingTaskFilters {
  [key: string]: unknown;
  priority?: string;
  assignedTo?: string;
}

export const PendingTasksPage: React.FC = () => {
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
  } = useUnifiedFilters<PendingTaskFilters>({
    syncWithUrl: true,
  });

  const [paginationState, setPaginationState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc',
    status: 'PENDING,ASSIGNED',
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

  const handleAssignTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    toast('Assignment modal opened');
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
      // Pass both case ID and task ID so we know which specific task to update
      const url = taskId ? `/cases/new?edit=${caseId}&taskId=${taskId}` : `/cases/new?edit=${caseId}`;
      navigate(url);
    }
  };

  // Count active filters (simple count of non-undefined values)
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-ui-search-input="true"]');
        input?.focus();
        input?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const summaryCards = [
    {
      title: 'Total Pending',
      value: statistics.pending + statistics.assigned,
      detail: `${statistics.pending} unassigned, ${statistics.assigned} assigned`,
      icon: Clock,
      tone: 'accent' as const,
    },
    {
      title: 'Unassigned',
      value: statistics.pending,
      detail: 'Need assignment',
      icon: Package,
      tone: 'warning' as const,
    },
    {
      title: 'Assigned',
      value: statistics.assigned,
      detail: 'Waiting to start',
      icon: UserCheck,
      tone: 'neutral' as const,
    },
    {
      title: 'High Priority',
      value: (statistics.urgent || 0) + (statistics.highPriority || 0),
      detail: 'Urgent + High',
      icon: AlertTriangle,
      tone: 'danger' as const,
    },
    {
      title: 'Avg Age',
      value:
        tasks.length > 0
          ? `${Math.round(
              tasks.reduce((acc, t) => {
                const created = new Date(t.createdAt);
                const now = new Date();
                const ageInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                return acc + ageInDays;
              }, 0) / tasks.length
            )} days`
          : '0 days',
      detail: 'Average task age',
      icon: TrendingUp,
      tone: 'warning' as const,
    },
  ];

  return (
    <Page
      title="Pending Tasks"
      subtitle="Queue discipline for tasks awaiting assignment or first action."
      shell
      actions={
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => refreshTasks()} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="warning">Task Management</Badge>
          <Text as="h2" variant="headline">Keep pending work moving before it stalls.</Text>
          <Text variant="body-sm" tone="muted">
            Spot assignment gaps, surface urgency, and keep the queue under active control.
          </Text>
        </Stack>
      </Section>

      <Section>
        <Grid min={200}>
          {summaryCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} {...{ className: "ui-stat-card" }}>
                <Stack gap={3}>
                  <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                    <Badge variant={item.tone}>{item.title}</Badge>
                    <Icon size={18} />
                  </Stack>
                  <Text variant="headline">{item.value}</Text>
                  <Text variant="body-sm" tone="muted">{item.detail}</Text>
                </Stack>
              </Card>
            );
          })}
        </Grid>
      </Section>

      <Section>
        <Card tone="strong" {...{ className: "ui-filter-bar" }} staticCard>
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
                <Stack gap={2}>
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
                </Stack>
              </FilterGrid>
            }
            actions={
              <Stack gap={3}>
                <div {...{ className: "ui-chip-row" }}>
                  <Button variant={activeFilters.priority === '4' ? 'primary' : 'secondary'} onClick={() => setFilter('priority', activeFilters.priority === '4' ? undefined : '4')}>
                    Urgent only
                  </Button>
                  <Button variant={!activeFilters.priority ? 'primary' : 'secondary'} onClick={() => setFilter('priority', undefined)}>
                    All priorities
                  </Button>
                  <Badge variant={hasActiveFilters ? 'warning' : 'neutral'}>
                    {hasActiveFilters ? `${activeFilterCount} active filters` : 'No active filters'}
                  </Badge>
                </div>
                <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => refreshTasks()} disabled={loading}>
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

      {pagination.total > 0 ? (
        <Section>
          <Card tone="strong">
            <Stack direction="horizontal" justify="space-between" align="center" gap={3} wrap="wrap">
              <Text variant="body-sm" tone="muted">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tasks
              </Text>
              {pagination.totalPages > 1 ? (
                <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                  <Button
                    variant="secondary"
                    onClick={() => setPaginationState(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Text variant="body-sm">Page {pagination.page} of {pagination.totalPages}</Text>
                  <Button
                    variant="secondary"
                    onClick={() => setPaginationState(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Card>
        </Section>
      ) : null}

      {selectedTaskId ? (
        <TaskAssignmentModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onSuccess={() => {
            setSelectedTaskId(null);
            refreshTasks();
          }}
        />
      ) : null}
    </Page>
  );
};
