import React, { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { locationsService } from '@/services/locations';
import { AreasTable } from '@/components/locations/AreasTable';
import { CreateAreaDialog } from '@/components/locations/CreateAreaDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchInput } from '@/components/ui/unified-search-input';
import { PincodeArea } from '@/types/location';

export function AreasPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const { data, isLoading } = useQuery({
    queryKey: ['areas', debouncedSearchValue, currentPage, pageSize],
    queryFn: () =>
      locationsService.getAreas({
        search: debouncedSearchValue || undefined,
        page: currentPage,
        limit: pageSize,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Areas</h1>
          <p className="text-sm text-muted-foreground">Manage area reference data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Area
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchInput
            value={searchValue}
            onChange={setSearchValue}
            onClear={clearSearch}
            isLoading={isDebouncing}
            placeholder="Search areas..."
          />

          <AreasTable data={(data?.data as unknown as PincodeArea[]) || []} isLoading={isLoading} />

          {data?.pagination && (
            <div className="flex items-center justify-between px-2">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, data.pagination.total)} of {data.pagination.total}{' '}
                areas
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {data.pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= (data.pagination.totalPages || 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateAreaDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
