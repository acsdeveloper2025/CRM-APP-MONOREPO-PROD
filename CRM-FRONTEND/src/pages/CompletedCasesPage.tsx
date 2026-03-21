import React, { useState } from 'react';
import { CompletedCaseTable } from '@/components/cases/CompletedCaseTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { useCases, useRefreshCases } from '@/hooks/useCases';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { Download, RefreshCw, CheckCircle, Calendar, Star, Users, Timer } from 'lucide-react';
import { casesService, type CaseListQuery } from '@/services/cases';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface CompletedCaseFilters {
  [key: string]: unknown;
  priority?: string;
  clientId?: string;
}

export const CompletedCasesPage: React.FC = () => {
  // Unified search with 800ms debounce
  const {
    debouncedSearchValue,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
  } = useUnifiedFilters<CompletedCaseFilters>({
    syncWithUrl: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    sortBy: 'completedAt',
    sortOrder: 'desc' as const,
  });

  // Build query with search and filters
  const query: CaseListQuery = {
    ...pagination,
    status: 'COMPLETED',
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
    clientId: (activeFilters.clientId as string) || undefined,
  };

  const { data: casesData, isLoading } = useCases(query);
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


  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'completed',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export completed cases:', error);
    }
  };

  return (
    <Page
      title="Completed Cases"
      subtitle="Review completed verification cases and export finished work."
      shell
      actions={(
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
      )}
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="status-completed">Completed Queue</Badge>
          <Text as="h2" variant="headline">Keep finished cases exportable and easy to review without changing the existing list behavior.</Text>
          <Text variant="body-sm" tone="muted">
            This page now shares the same operational shell and summary rhythm as the rest of the case workflow.
          </Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            {
              title: 'Total Completed',
              value: statistics?.completed || 0,
              detail: 'Finished verification cases',
              icon: CheckCircle,
              tone: 'positive',
            },
            {
              title: 'This Month',
              value: statistics?.completedThisMonth || 0,
              detail: 'Completed in the current month',
              icon: Calendar,
              tone: 'accent',
            },
            {
              title: 'High Priority',
              value: statistics?.highPriority || 0,
              detail: 'Completed urgent cases',
              icon: Star,
              tone: 'warning',
            },
            {
              title: 'Field Users',
              value: statistics?.activeAgentsCompleted || 0,
              detail: 'Agents with completed work',
              icon: Users,
              tone: 'neutral',
            },
            {
              title: 'Avg TAT',
              value: `${Math.round(statistics?.avgTATDays || 0)} days`,
              detail: 'Average turnaround',
              icon: Timer,
              tone: 'accent',
            },
          ]}
        />
      </Section>

      <Section>
        <Card tone="strong" staticCard bodyClassName="p-0">
          <CompletedCaseTable
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
      ) : null}
    </Page>
  );
};
