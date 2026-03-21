import React, { useState, useEffect } from 'react';
import { Button } from '@/ui/components/Button';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/UnifiedSearchFilterLayout';
import { Label } from '@/ui/components/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import {
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Calendar,
  Clock,
  Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VerificationTasksService } from '@/services/verificationTasks';
import { toast } from 'sonner';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Card } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface CompletedTaskFilters {
  priority?: string;
  [key: string]: unknown;
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

  // Use backend statistics
  const { 
    completed: totalCompleted = 0,
    avgTurnaround = 0,
    completedToday = 0,
    inProgress = 0,
    pending = 0,
    assigned = 0
  } = statistics || {};

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

  const handleRevisitTask = async (taskId: string) => {
    try {
      await VerificationTasksService.revisitTask(taskId);
      
      // Show success notification
      toast.success(
        'Revisit task created successfully! The task has been moved to the Revisit tab.',
        {
          duration: 5000,
          // icon: '✅', // Removed icon as Sonner handles success icons well
        }
      );
      
      // Refresh tasks to remove the completed task from the list
      refreshTasks();
      
      // Optionally navigate to revisit tasks page after a short delay
      setTimeout(() => {
        navigate('/tasks/revisit');
      }, 1500);
    } catch (error) {
      console.error('Error creating revisit task:', error);
      toast.error('Failed to create revisit task. Please try again.');
    }
  };

  // Count active filters
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  const summaryCards = [
    { title: 'Total Completed', value: totalCompleted, detail: 'All completed tasks', icon: CheckCircle, tone: 'positive' as const },
    { title: 'This Month', value: pagination.total, detail: 'Current period', icon: Calendar, tone: 'accent' as const },
    {
      title: 'Completion Rate',
      value: `${totalCompleted > 0 ? Math.round((totalCompleted / (totalCompleted + inProgress + pending + assigned)) * 100) : 0}%`,
      detail: 'Overall completion rate',
      icon: TrendingUp,
      tone: 'neutral' as const,
    },
    { title: 'Avg TAT', value: `${Math.round(avgTurnaround)} days`, detail: 'Average turnaround', icon: Clock, tone: 'warning' as const },
    { title: 'Today', value: completedToday, detail: 'Completed today', icon: Award, tone: 'accent' as const },
  ];

  return (
    <Page
      title="Completed Tasks"
      subtitle="Closed work with revisit controls and completion monitoring."
      shell
      actions={
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => refreshTasks()} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="positive">Completion Queue</Badge>
          <Text as="h2" variant="headline">Track output quality after the field work is done.</Text>
          <Text variant="body-sm" tone="muted">Audit completion rate, create revisits, and keep the finished queue searchable.</Text>
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
            searchPlaceholder="Search completed tasks..."
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
          onAssignTask={() => {}}
          onViewTask={handleViewTask}
          onViewCase={handleViewCase}
          onEditCase={handleEditCase}
          onRevisitTask={handleRevisitTask}
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
