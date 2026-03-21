import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, CheckCircle } from 'lucide-react';
import { documentTypesService } from '@/services/documentTypes';
import { DocumentTypesTable } from '@/components/document-types/DocumentTypesTable';
import { CreateDocumentTypeDialog } from '@/components/document-types/CreateDocumentTypeDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/ui/components/UnifiedSearchFilterLayout';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const DocumentTypesPage: React.FC = () => {
  const [showCreateDocumentType, setShowCreateDocumentType] = useState(false);
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

  const { data: documentTypesData, isLoading: documentTypesLoading } = useQuery({
    queryKey: ['document-types', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => documentTypesService.getDocumentTypes({
      page: currentPage,
      limit: pageSize,
      sortBy: 'name',
      sortOrder: 'asc',
      search: debouncedSearchValue || undefined,
    }),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['document-types-stats'],
    queryFn: () => documentTypesService.getDocumentTypeStats(),
  });

  const documentTypes = documentTypesData?.data || [];
  const stats = statsData?.data || {
    totalDocumentTypes: 0,
    activeDocumentTypes: 0,
  };

  return (
    <Page
      title="Document Types Management"
      subtitle="Manage document type definitions with lean operational controls."
      shell
      actions={(
        <Button icon={<Plus size={16} />} onClick={() => setShowCreateDocumentType(true)}>
          Add Document Type
        </Button>
      )}
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Document Catalog</Badge>
          <Text as="h2" variant="headline">Keep document-type maintenance compact without changing the current table and dialog behavior.</Text>
          <Text variant="body-sm" tone="muted">
            The page now uses the shared shell, metrics, and pagination treatment used across the other management screens.
          </Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            {
              title: 'Total Types',
              value: stats.totalDocumentTypes,
              detail: 'All document types',
              icon: FileText,
              tone: 'neutral',
            },
            {
              title: 'Active Types',
              value: stats.activeDocumentTypes,
              detail: 'Currently active',
              icon: CheckCircle,
              tone: 'positive',
            },
          ]}
          min={260}
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
              searchPlaceholder="Search document types by name or code..."
              showFilters={false}
              actions={undefined}
            />

            <DocumentTypesTable
              data={documentTypes}
              isLoading={documentTypesLoading}
            />

            {documentTypesData?.pagination ? (
              <PaginationStatusCard
                page={currentPage}
                limit={pageSize}
                total={documentTypesData.pagination.total}
                totalPages={documentTypesData.pagination.totalPages || 1}
                onPrevious={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                onNext={() => setCurrentPage(prev => prev + 1)}
              />
            ) : null}
          </Stack>
        </Card>
      </Section>

      <CreateDocumentTypeDialog
        open={showCreateDocumentType}
        onOpenChange={setShowCreateDocumentType}
      />
    </Page>
  );
};
