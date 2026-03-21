import React from 'react';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface PaginationData {
  total: number;
  totalPages: number;
}

interface LocationsTabPanelProps {
  children: React.ReactNode;
  pagination?: PaginationData;
  currentPage: number;
  pageSize: number;
  entityLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

export const LocationsTabPanel = React.memo(function LocationsTabPanel({
  children,
  pagination,
  currentPage,
  pageSize,
  entityLabel,
  onPrev,
  onNext,
}: LocationsTabPanelProps) {
  return (
    <Stack gap={4}>
      {children}
      {pagination ? (
        <Card tone="muted" staticCard>
          <Stack direction="horizontal" align="center" justify="space-between" gap={3} wrap="wrap">
            <Text variant="body-sm" tone="muted">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} {entityLabel}
            </Text>
            <Stack direction="horizontal" align="center" gap={2} wrap="wrap">
            <Button
              variant="outline"
              onClick={onPrev}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Text variant="body-sm">
              Page {currentPage} of {pagination.totalPages || 1}
            </Text>
            <Button
              variant="outline"
              onClick={onNext}
              disabled={currentPage >= (pagination.totalPages || 1)}
            >
              Next
            </Button>
            </Stack>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
});
