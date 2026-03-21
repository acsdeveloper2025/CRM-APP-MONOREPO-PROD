import React, { useState } from 'react';
import { Label } from '@/ui/components/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { CaseTable } from '@/components/cases/CaseTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { useCases, useRefreshCases } from '@/hooks/useCases';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/UnifiedSearchFilterLayout';
import { Download, RefreshCw, PlayCircle, Timer, Zap, Users, BarChart3 } from 'lucide-react';
import { casesService, type CaseListQuery } from '@/services/cases';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface InProgressCaseFilters {
  priority?: string;
  clientId?: string;
  [key: string]: unknown;
}

export const InProgressCasesPage: React.FC = () => {
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
  } = useUnifiedFilters<InProgressCaseFilters>({
    syncWithUrl: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    sortBy: 'pendingDuration',
    sortOrder: 'desc' as const,
  });

  // Build query with search and filters
  const query: CaseListQuery = {
    ...pagination,
    status: 'IN_PROGRESS',
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
    clientId: activeFilters.clientId || undefined,
  };

  const { data: casesData, isLoading, refetch: _refetch } = useCases(query);
  const { refreshCases } = useRefreshCases();

  const cases = casesData?.data?.data || [];
  const statistics = casesData?.data?.statistics;
  const paginationData = casesData?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  const activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof InProgressCaseFilters] !== undefined
  ).length;

  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'in-progress',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export in progress cases:', error);
    }
  };

  return (
    <Page
      title="In Progress Cases"
      subtitle="Track active cases and intervene before turnaround risk increases."
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <Button
            variant="secondary"
            icon={<RefreshCw size={16} />}
            onClick={async () => {
              await refreshCases({
                clearCache: true,
                preserveFilters: true,
                showToast: true
              });
            }}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
            Export
          </Button>
        </Stack>
      }
    >
      <Section>
        <Badge variant="status-progress">Active Queue</Badge>
      </Section>

      <Section>
        <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search in-progress cases..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={2}>
            {/* Priority Filter */}
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
                  <SelectItem value="1">Low</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                  <SelectItem value="4">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Filter */}
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select
                value={activeFilters.clientId || 'all'}
                onValueChange={(value) => setFilter('clientId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
        actions={
          <>
            <Button variant="secondary" onClick={async () => {
              await refreshCases({
                clearCache: true,
                preserveFilters: true,
                showToast: true
              });
            }} disabled={isLoading}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              Export
            </Button>
          </>
        }
      />
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            { title: 'Total In Progress', value: statistics?.inProgress || 0, detail: 'Active cases', icon: PlayCircle, tone: 'accent' },
            { title: 'Long Running', value: statistics?.overdue || 0, detail: 'Require attention', icon: Timer, tone: 'warning' },
            { title: 'High Priority', value: statistics?.highPriority || 0, detail: 'Urgent active cases', icon: Zap, tone: 'danger' },
            { title: 'Active Agents', value: statistics?.activeAgentsInProgress || 0, detail: 'Currently assigned', icon: Users, tone: 'neutral' },
            { title: 'Avg Duration', value: `${Math.round(statistics?.avgDurationDaysInProgress || 0)} days`, detail: 'Average running time', icon: BarChart3, tone: 'warning' },
          ]}
        />
      </Section>

      <Section>
        <Card tone="strong" staticCard bodyClassName="p-0">
          <CaseTable
            cases={cases}
            isLoading={isLoading}
          />
        </Card>
      </Section>

      {paginationData.total > 0 ? (
        <Section>
        <CasePagination
          currentPage={paginationData.page}
          totalPages={paginationData.totalPages}
          totalItems={paginationData.total}
          itemsPerPage={paginationData.limit}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          isLoading={isLoading}
        />
        </Section>
      ) : (
        <Section>
          <Text variant="body-sm" tone="muted">No in progress cases found.</Text>
        </Section>
      )}
    </Page>
  );
};
