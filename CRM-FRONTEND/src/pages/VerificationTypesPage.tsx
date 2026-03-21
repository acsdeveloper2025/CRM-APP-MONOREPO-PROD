import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileCheck, CheckCircle, XCircle, Layers, TrendingUp } from 'lucide-react';
import { verificationTypesService } from '@/services/verificationTypes';
import { VerificationTypesTable } from '@/components/clients/VerificationTypesTable';
import { CreateVerificationTypeDialog } from '@/components/clients/CreateVerificationTypeDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/ui/components/unified-search-filter-layout';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export function VerificationTypesPage() {
  const [showCreateVerificationType, setShowCreateVerificationType] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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

  // Reset pagination to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const { data: verificationTypesData, isLoading: verificationTypesLoading } = useQuery({
    queryKey: ['verification-types', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => verificationTypesService.getVerificationTypes({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
  });

  // Fetch verification types stats
  const { data: statsData } = useQuery({
    queryKey: ['verification-types-stats'],
    queryFn: () => verificationTypesService.getVerificationTypeStats(),
  });

  const verificationTypes = verificationTypesData?.data || [];
  const stats = statsData?.data || { total: 0, active: 0, inactive: 0, byCategory: {} };

  return (
    <Page
      title="Verification Types Management"
      subtitle="Manage verification types, categories, and configuration coverage."
      shell
      actions={(
        <Button icon={<Plus size={16} />} onClick={() => setShowCreateVerificationType(true)}>
          Add Type
        </Button>
      )}
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Verification Catalog</Badge>
          <Text as="h2" variant="headline">Keep type configuration dense and scannable while preserving the existing CRUD flow.</Text>
          <Text variant="body-sm" tone="muted">
            The page now shares the same shell, summary rhythm, and pagination treatment as the other management consoles.
          </Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            {
              title: 'Total Types',
              value: stats.total,
              detail: 'All types',
              icon: FileCheck,
              tone: 'neutral',
            },
            {
              title: 'Active Types',
              value: stats.active,
              detail: 'Currently active',
              icon: CheckCircle,
              tone: 'positive',
            },
            {
              title: 'Inactive Types',
              value: stats.inactive,
              detail: 'Disabled types',
              icon: XCircle,
              tone: 'danger',
            },
            {
              title: 'Categories',
              value: Object.keys(stats.byCategory || {}).length,
              detail: 'Type categories',
              icon: Layers,
              tone: 'accent',
            },
            {
              title: 'With Rates',
              value: verificationTypes.filter(v => v.hasRates).length,
              detail: 'Rate mappings',
              icon: TrendingUp,
              tone: 'warning',
            },
          ]}
        />
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <UnifiedSearchFilterLayout
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              onSearchClear={clearSearch}
              isSearchLoading={isDebouncing}
              searchPlaceholder="Search verification types by name, code or category..."
              showFilters={false}
              actions={undefined}
            />

            <VerificationTypesTable
              data={verificationTypes}
              isLoading={verificationTypesLoading}
            />

            {verificationTypesData?.pagination ? (
              <PaginationStatusCard
                page={currentPage}
                limit={pageSize}
                total={verificationTypesData.pagination.total}
                totalPages={verificationTypesData.pagination.totalPages || 1}
                onPrevious={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                onNext={() => setCurrentPage(prev => prev + 1)}
              />
            ) : null}
          </Stack>
        </Card>
      </Section>

      <CreateVerificationTypeDialog
        open={showCreateVerificationType}
        onOpenChange={setShowCreateVerificationType}
      />
    </Page>
  );
}
