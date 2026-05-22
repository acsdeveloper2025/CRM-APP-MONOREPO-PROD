import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { clientsService } from '@/services/clients';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { CreateClientDialog } from '@/components/clients/CreateClientDialog';
import { BulkImportDialog } from '@/components/clients/BulkImportDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';
import { logger } from '@/utils/logger';

type SortValue = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'updated_desc';
type StatusValue = 'all' | 'true' | 'false';

const SORT_OPTIONS: Array<{
  value: SortValue;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = [
  { value: 'name_asc', label: 'Name A → Z', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Name Z → A', sortBy: 'name', sortOrder: 'desc' },
  { value: 'created_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'created_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'updated_desc', label: 'Recently updated', sortBy: 'updatedAt', sortOrder: 'desc' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 20;
const DEFAULT_SORT: SortValue = 'name_asc';
const DEFAULT_STATUS: StatusValue = 'all';

const isPageSize = (n: number): n is PageSize =>
  (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth for filters; useState only holds dialog state
  // and a draft of date-range inputs while the user is typing.
  const status = (searchParams.get('status') as StatusValue) || DEFAULT_STATUS;
  const sort = (searchParams.get('sort') as SortValue) || DEFAULT_SORT;
  const pageSizeRaw = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const pageSize: PageSize = isPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  const sortConfig = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0],
    [sort]
  );

  // Reset page → 1 whenever any filter that narrows results changes.
  useEffect(() => {
    if (page !== 1) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('page', '1');
          return next;
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue, status, sort, pageSize, dateFrom, dateTo]);

  const updateParam = (key: string, value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === '' || value === 'all') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  };

  const queryArgs = useMemo(
    () => ({
      search: debouncedSearchValue || undefined,
      isActive: status === 'all' ? undefined : (status as 'true' | 'false'),
      createdFrom: dateFrom || undefined,
      createdTo: dateTo || undefined,
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
      page,
      limit: pageSize,
    }),
    [debouncedSearchValue, status, dateFrom, dateTo, sortConfig, page, pageSize]
  );

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients', queryArgs],
    queryFn: () => clientsService.getClients(queryArgs),
  });

  const totalPages = clientsData?.pagination?.totalPages ?? 1;
  const total = clientsData?.pagination?.total ?? 0;

  const activeFilterCount =
    (status !== DEFAULT_STATUS ? 1 : 0) +
    (sort !== DEFAULT_SORT ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const handleClearFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('status');
        next.delete('sort');
        next.delete('dateFrom');
        next.delete('dateTo');
        return next;
      },
      { replace: true }
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await clientsService.exportClients({
        search: queryArgs.search,
        isActive: queryArgs.isActive,
        createdFrom: queryArgs.createdFrom,
        createdTo: queryArgs.createdTo,
        sortBy: queryArgs.sortBy,
        sortOrder: queryArgs.sortOrder,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clients_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      logger.error('Clients export failed', err);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label htmlFor="client-status-filter">Status</Label>
        <Select value={status} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="client-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="client-sort">Sort by</Label>
        <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
          <SelectTrigger id="client-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="client-date-from">Date From</Label>
        <Input
          id="client-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
          placeholder="(YYYY-MM-DD)"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="client-date-to">Date To</Label>
        <Input
          id="client-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => updateParam('dateTo', e.target.value)}
          placeholder="(YYYY-MM-DD)"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage clients and their product / verification-type mappings.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={clearSearch}
            isSearchLoading={isDebouncing}
            searchPlaceholder="Search clients by name or code..."
            filterContent={filterContent}
            hasActiveFilters={activeFilterCount > 0}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting || isLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button size="sm" onClick={() => setShowCreateClient(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Client
                </Button>
              </div>
            }
          />

          <div className="overflow-x-auto">
            <div className="min-w-[800px] lg:min-w-0">
              <ClientsTable data={clientsData?.data || []} isLoading={isLoading} />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <div className="text-sm text-muted-foreground">
                {total > 0
                  ? `Showing ${clientsData?.data?.length || 0} of ${total} clients`
                  : 'No clients to show'}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="client-page-size" className="text-sm text-muted-foreground">
                    Rows
                  </Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => updateParam('pageSize', v)}
                  >
                    <SelectTrigger id="client-page-size" className="w-[80px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParam('page', String(Math.max(1, page - 1)))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {page} of {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParam('page', String(page + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateClientDialog open={showCreateClient} onOpenChange={setShowCreateClient} />

      <BulkImportDialog open={showBulkImport} onOpenChange={setShowBulkImport} type="clients" />
    </div>
  );
}
