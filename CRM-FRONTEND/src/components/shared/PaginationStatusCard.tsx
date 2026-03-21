import React from 'react';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface PaginationStatusCardProps {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function PaginationStatusCard({
  page,
  limit,
  total,
  totalPages = 1,
  onPrevious,
  onNext,
}: PaginationStatusCardProps) {
  if (total <= 0) {
    return null;
  }

  return (
    <Card tone="strong">
      <Stack direction="horizontal" justify="space-between" align="center" gap={3} wrap="wrap">
        <Text variant="body-sm" tone="muted">
          Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} items
        </Text>
        {totalPages > 1 ? (
          <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
            <Button variant="secondary" onClick={onPrevious} disabled={page === 1}>
              Previous
            </Button>
            <Text variant="body-sm">Page {page} of {totalPages}</Text>
            <Button variant="secondary" onClick={onNext} disabled={page === totalPages}>
              Next
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
