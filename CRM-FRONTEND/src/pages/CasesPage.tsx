import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/ui/layout/Page';
import { Badge } from '@/ui/components/Badge';
import { Button as UiButton } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
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
import { useClients } from '@/hooks/useClients';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/UnifiedSearchFilterLayout';
import { Download, Plus, RefreshCw, FileText, Clock, CheckCircle, PlayCircle, AlertTriangle } from 'lucide-react';
import { casesService, type CaseListQuery } from '@/services/cases';
import { usePermissionContext } from '@/contexts/PermissionContext';

interface CaseFilters {
  status?: string;
  priority?: string;
  clientId?: string;
  [key: string]: string | undefined;
}

export const CasesPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionCode } = usePermissionContext();
  const canViewClientsFilter =
    hasPermissionCode('client.view') || hasPermissionCode('page.masterdata');

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
  } = useUnifiedFilters<CaseFilters>({
    syncWithUrl: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    sortBy: 'caseId',
    sortOrder: 'desc' as const,
  });

  // Build query with search and filters
  const query: CaseListQuery = {
    ...pagination,
    search: debouncedSearchValue || undefined,
    status: activeFilters.status || undefined,
    priority: activeFilters.priority || undefined,
    clientId: activeFilters.clientId || undefined,
  };

  const { data: casesData, isLoading, error: _error } = useCases(query);
  const { data: clientsData } = useClients({ limit: 100 }, { enabled: canViewClientsFilter });

  const { refreshCases } = useRefreshCases();

  const cases = casesData?.data?.data || [];
  const statistics = casesData?.data?.statistics || {
    totalCases: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    revoked: 0,
    overdue: 0,
    highPriority: 0,
  };
  const paginationData = casesData?.data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };

  const clients = clientsData?.data || [];

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };



  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'all',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export cases:', error);
    }
  };

  const handleRefresh = async () => {
    await refreshCases({
      clearCache: true,
      preserveFilters: true,
      showToast: true
    });
  };

  const handleNewCase = () => {
    navigate('/cases/new');
  };

  // Count active filters
  const activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof CaseFilters] !== undefined
  ).length;

  // Statistics from backend
  const { 
    totalCases, 
    pending: pendingCases, 
    inProgress: inProgressCases, 
    completed: completedCases, 
    overdue: overdueCases 
  } = statistics;

  return (
    <Page
      shell
      title="Cases"
      subtitle="Manage and track all verification cases."
      actions={
        <>
          <UiButton variant="secondary" onClick={handleRefresh} disabled={isLoading} icon={<RefreshCw size={16} />}>
            Refresh
          </UiButton>
          <UiButton variant="secondary" onClick={handleExport} icon={<Download size={16} />}>
            Export
          </UiButton>
          <UiButton variant="primary" onClick={handleNewCase} icon={<Plus size={16} />}>
            New Case
          </UiButton>
        </>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Case Operations</Badge>
          <Text as="h2" variant="headline">Keep intake, filtering, and case status review on one operational surface.</Text>
          <Text variant="body-sm" tone="muted">The list workflow is unchanged; the presentation now follows the shared shell and metric system.</Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            { title: 'Total Cases', value: totalCases, detail: 'All verification cases', icon: FileText, tone: 'neutral' },
            { title: 'Pending', value: pendingCases, detail: 'Awaiting action', icon: Clock, tone: 'warning' },
            { title: 'In Progress', value: inProgressCases, detail: 'Currently active', icon: PlayCircle, tone: 'info' },
            { title: 'Completed', value: completedCases, detail: 'Successfully done', icon: CheckCircle, tone: 'positive' },
            { title: 'Overdue', value: overdueCases, detail: 'More than 2 days old', icon: AlertTriangle, tone: 'danger' },
          ]}
        />
      </Section>

      <Section>
        <UnifiedSearchFilterLayout
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onSearchClear={clearSearch}
          isSearchLoading={isDebouncing}
          searchPlaceholder="Search cases by ID, customer name, or description..."
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onClearFilters={clearFilters}
          filterContent={
            <FilterGrid columns={3}>
            {/* Status Filter */}
            <div {...{ className: "space-y-2" }}>
              <Text as="label" htmlFor="status" variant="label" tone="soft">Status</Text>
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
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div {...{ className: "space-y-2" }}>
              <Text as="label" htmlFor="priority" variant="label" tone="soft">Priority</Text>
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
            {canViewClientsFilter && (
              <div {...{ className: "space-y-2" }}>
                <Text as="label" htmlFor="client" variant="label" tone="soft">Client</Text>
                <Select
                  value={activeFilters.clientId || 'all'}
                  onValueChange={(value) =>
                    setFilter('clientId', value === 'all' ? undefined : value)
                  }
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client: { id: number; name: string }) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            </FilterGrid>
          }
        />
      </Section>

      <Section>
        <Card tone="strong" staticCard bodyClassName="p-0">
          <Stack gap={3} style={{ padding: '24px 24px 0' }}>
            <Text as="h3" variant="title">Cases</Text>
            <Text variant="body-sm" tone="muted">
              {paginationData.total > 0
                ? `Showing ${paginationData.total} case${paginationData.total === 1 ? '' : 's'}`
                : 'No cases found'}
            </Text>
          </Stack>
          <div style={{ paddingTop: '24px' }}>
            <CaseTable
              cases={cases}
              isLoading={isLoading}
            />
          </div>
        </Card>
      </Section>

      {paginationData.total > 0 && (
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
      )}
    </Page>
  );
};
