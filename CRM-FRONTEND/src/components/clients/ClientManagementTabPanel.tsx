import React from 'react';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { UnifiedSearchFilterLayout } from '@/ui/components/UnifiedSearchFilterLayout';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface ClientManagementTabPanelProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  isSearchLoading: boolean;
  searchPlaceholder: string;
  actions?: React.ReactNode;
  minWidth?: number;
  pagination?: { total: number; totalPages: number };
  currentPage: number;
  onPrev: () => void;
  onNext: () => void;
  pageLabel: string;
  rowCount: number;
  children: React.ReactNode;
}

export const ClientManagementTabPanel = React.memo(function ClientManagementTabPanel({
  searchValue,
  onSearchChange,
  onSearchClear,
  isSearchLoading,
  searchPlaceholder,
  actions,
  minWidthClassName = 'min-w-[800px] lg:min-w-0',
  pagination,
  currentPage,
  onPrev,
  onNext,
  pageLabel,
  rowCount,
  children,
}: ClientManagementTabPanelProps) {
  return (
    <Stack gap={4}>
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onSearchClear={onSearchClear}
        isSearchLoading={isSearchLoading}
        searchPlaceholder={searchPlaceholder}
        showFilters={false}
        actions={actions}
      />
      <Box style={{ overflowX: 'auto' }}>
        <Box style={{ minWidth }}>
          {children}
        </Box>
        {pagination ? (
          <Card tone="muted" staticCard style={{ marginTop: '16px' }}>
            <Stack
              direction="horizontal"
              align="center"
              justify="space-between"
              gap={3}
              wrap="wrap"
            >
              <Text variant="body-sm" tone="muted">
              Showing {rowCount} of {pagination.total} {pageLabel}
              </Text>
              <Stack direction="horizontal" align="center" gap={2} wrap="wrap">
                <Button variant="secondary" onClick={onPrev} disabled={currentPage === 1}>
                Previous
              </Button>
                <Text variant="body-sm">
                Page {currentPage} of {pagination.totalPages || 1}
                </Text>
              <Button
                variant="secondary"
                onClick={onNext}
                disabled={currentPage >= (pagination.totalPages || 1)}
              >
                Next
              </Button>
              </Stack>
            </Stack>
          </Card>
        ) : null}
      </Box>
    </Stack>
  );
});
