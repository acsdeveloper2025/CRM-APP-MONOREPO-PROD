import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/ui/components/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { useOverdueTasks, useTATStats } from '@/hooks/useDashboard';
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
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TATMonitoringSummaryCards, TATMonitoringTable } from '@/components/tat/TATMonitoringPanels';
import { Card } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface TATMonitoringFilters {
  priority?: string;
  status?: string;
  [key: string]: unknown;
}

export const TATMonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'critical' | 'all'>('critical');
  const [criticalPage, setCriticalPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [sortBy, setSortBy] = useState('days_overdue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
  } = useUnifiedFilters<TATMonitoringFilters>({
    syncWithUrl: true,
  });

  // Reset pagination when search or filters change
  useEffect(() => {
    setCriticalPage(1);
    setAllPage(1);
  }, [debouncedSearchValue, activeFilters]);

  // Fetch TAT Statistics for the cards
  const { data: tatStatsData } = useTATStats();
  const tatStats = tatStatsData?.data;

  // Common filter params
  const filterParams = {
    sortBy,
    sortOrder,
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
    status: activeFilters.status || undefined,
  };

  // Fetch critical overdue tasks (>3 days)
  const { data: criticalData, isLoading: criticalLoading, refetch: refetchCritical } = useOverdueTasks({
    threshold: 3,
    page: criticalPage,
    limit: 20,
    ...filterParams,
  });

  // Fetch all overdue tasks (>1 day)
  const { data: allData, isLoading: allLoading, refetch: refetchAll } = useOverdueTasks({
    threshold: 1,
    page: allPage,
    limit: 20,
    ...filterParams,
  });

  const handleRefresh = () => {
    refetchCritical();
    refetchAll();
  };

  const criticalTasks = criticalData?.data?.tasks || [];
  const criticalPagination = criticalData?.data?.pagination || { page: 1, totalPages: 1, totalCount: 0, limit: 20, total: 0 };
  
  const allTasks = allData?.data?.tasks || [];
  const allPagination = allData?.data?.pagination || { page: 1, totalPages: 1, totalCount: 0, limit: 20, total: 0 };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <Page
      title="TAT Monitoring"
      subtitle="Track overdue operational work before SLA breaches spread across the queue."
      shell
      actions={
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handleRefresh} disabled={criticalLoading || allLoading}>
          Refresh
        </Button>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="danger">SLA Command</Badge>
          <Text as="h2" variant="headline">See the pressure points before they become operational fire drills.</Text>
          <Text variant="body-sm" tone="muted">Critical overdue items stay separated from the broader backlog so intervention is immediate.</Text>
        </Stack>
      </Section>

      <Section>
        <TATMonitoringSummaryCards
          criticalCount={criticalPagination.totalCount}
          totalCount={allPagination.totalCount}
          onTrack={tatStats?.onTrack || 0}
          avgOverdueDays={tatStats?.avgOverdueDays || 0}
          completedToday={tatStats?.completedToday || 0}
        />
      </Section>

      <Section>
        <Card tone="strong" className="ui-filter-bar" staticCard>
          <UnifiedSearchFilterLayout
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={clearSearch}
            isSearchLoading={isDebouncing}
            searchPlaceholder="Search task number, case number, customer..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
            filterContent={
              <FilterGrid columns={2}>
                <div className="space-y-2">
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
                      <SelectItem value="URGENT">Urgent</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                    </SelectContent>
                  </Select>
                </div>
              </FilterGrid>
            }
            actions={
              <Button variant="outline" onClick={handleRefresh} disabled={criticalLoading || allLoading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", (criticalLoading || allLoading) && "animate-spin")} />
                Refresh
              </Button>
            }
          />
        </Card>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'critical' | 'all')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="critical" className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Critical Overdue (&gt;3 Days)</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>All Overdue Tasks (&gt;1 Day)</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="critical" className="mt-6">
              <TATMonitoringTable
                tasks={criticalTasks}
                isLoading={criticalLoading}
                pagination={criticalPagination}
                sortBy={sortBy}
                onSort={handleSort}
                onPageChange={setCriticalPage}
                onViewCase={(caseId) => navigate(`/cases/${caseId}`)}
                onViewTask={(taskId) => navigate(`/verification-tasks/${taskId}`)}
              />
            </TabsContent>
            <TabsContent value="all" className="mt-6">
              <TATMonitoringTable
                tasks={allTasks}
                isLoading={allLoading}
                pagination={allPagination}
                sortBy={sortBy}
                onSort={handleSort}
                onPageChange={setAllPage}
                onViewCase={(caseId) => navigate(`/cases/${caseId}`)}
                onViewTask={(taskId) => navigate(`/verification-tasks/${taskId}`)}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </Section>
    </Page>
  );
};
