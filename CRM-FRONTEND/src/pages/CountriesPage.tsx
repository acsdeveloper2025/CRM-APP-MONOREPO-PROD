import React, { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { locationsService } from '@/services/locations';
import { CountriesTable } from '@/components/locations/CountriesTable';
import { CreateCountryDialog } from '@/components/locations/CreateCountryDialog';
import { BulkImportLocationDialog } from '@/components/locations/BulkImportLocationDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchInput } from '@/components/ui/unified-search-input';

export function CountriesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const { data, isLoading } = useQuery({
    queryKey: ['countries', debouncedSearchValue, currentPage, pageSize],
    queryFn: () =>
      locationsService.getCountries({
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Countries</h1>
          <p className="text-sm text-muted-foreground">Manage country reference data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Country
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
            placeholder="Search countries..."
          />

          <CountriesTable data={data?.data || []} isLoading={isLoading} />

          {data?.pagination && (
            <div className="flex items-center justify-between px-2">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, data.pagination.total)} of {data.pagination.total}{' '}
                countries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={currentPage >= (data.pagination.totalPages || 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCountryDialog open={showCreate} onOpenChange={setShowCreate} />
      <BulkImportLocationDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        type="countries"
      />
    </div>
  );
}
