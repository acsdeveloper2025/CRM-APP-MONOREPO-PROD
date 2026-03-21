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
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/UnifiedSearchFilterLayout';
import {
  XCircle,
  AlertTriangle,
  RefreshCw,
  Package,
  UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VerificationTask } from '@/types/verificationTask';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Card } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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

  const summaryCards = [
    { title: 'Total Revoked', value: totalRevoked, detail: 'Tasks revoked by field agents', icon: XCircle, tone: 'danger' as const },
    { title: 'High Priority', value: highPriorityCount, detail: 'Urgent attention needed', icon: AlertTriangle, tone: 'warning' as const },
    { title: 'Unique Cases', value: uniqueCases, detail: 'Cases with revoked tasks', icon: Package, tone: 'neutral' as const },
    { title: 'Field Agents', value: uniqueFieldAgents, detail: 'Agents who revoked work', icon: UserCheck, tone: 'accent' as const },
  ];

  return (
    <Page
      title="Revoked Tasks"
      subtitle="Work that was rejected or revoked in the field and needs operational review."
      shell
      actions={
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => refreshTasks()} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="danger">Escalation Queue</Badge>
          <Text as="h2" variant="headline">Review revoked work before it becomes repeat operational debt.</Text>
          <Text variant="body-sm" tone="muted">Focus on affected cases, understand who revoked the work, and reopen the right case quickly.</Text>
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
            searchPlaceholder="Search by task number, case number, customer name..."
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
          onViewTask={handleViewTask}
          onViewCase={handleViewCase}
          onEditCase={handleEditCase}
          onAssignTask={() => {}}
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

export default RevokedTasksPage;
