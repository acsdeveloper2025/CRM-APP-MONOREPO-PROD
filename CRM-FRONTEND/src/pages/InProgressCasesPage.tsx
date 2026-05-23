import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import { CaseTable } from '@/components/cases/CaseTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { useCases, useRefreshCases } from '@/hooks/useCases';
import { useClients } from '@/hooks/useClients';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { useScopePageReset } from '@/hooks/useScopePageReset';
import { useActiveScope } from '@/hooks/useActiveScope';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { casesService, type CaseListQuery } from '@/services/cases';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  Activity,
  Hourglass,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Download,
  RefreshCw,
} from 'lucide-react';

const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = [
  { value: 'updatedAt_desc', label: 'Recently updated', sortBy: 'updatedAt', sortOrder: 'desc' },
  { value: 'createdAt_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'createdAt_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'priority_desc', label: 'Priority (high → low)', sortBy: 'priority', sortOrder: 'desc' },
  { value: 'customerName_asc', label: 'Customer A → Z', sortBy: 'customerName', sortOrder: 'asc' },
];

const IN_PROGRESS_STATUS = 'IN_PROGRESS';

export const InProgressCasesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const { hasPermissionCode } = usePermissionContext();
  const { selectedClientId, selectedProductId } = useActiveScope();
  const canViewClientsFilter =
    hasPermissionCode('client.view') || hasPermissionCode('page.masterdata');

  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '20');
  const priority = searchParams.get('priority') || 'all';
  const clientId = searchParams.get('clientId') || 'all';
  const sort = searchParams.get('sort') || 'updatedAt_desc';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const sortPair = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0],
    [sort]
  );

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '' || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: false });
  };

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  useEffect(() => {
    if (page !== 1 && searchParams.get('page')) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue, priority, clientId, sort, dateFrom, dateTo, pageSize]);

  useScopePageReset(() => updateParam('page', null));

  const baseFilters = {
    search: debouncedSearchValue || undefined,
    priority: priority === 'all' ? undefined : priority,
    clientId: clientId === 'all' ? undefined : clientId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const query: CaseListQuery = {
    ...baseFilters,
    status: IN_PROGRESS_STATUS,
    page,
    limit: pageSize,
    sortBy: sortPair.sortBy,
    sortOrder: sortPair.sortOrder,
  };

  const { data: casesData, isLoading } = useCases(query);
  const { data: clientsData } = useClients({ limit: 500 }, { enabled: canViewClientsFilter });
  const { refreshCases } = useRefreshCases();

  const { data: stats } = useQuery({
    queryKey: [
      'cases-stats',
      'in-progress-cases',
      baseFilters,
      { c: selectedClientId, p: selectedProductId },
    ],
    queryFn: () => casesService.getStats(baseFilters),
  });

  const cases = casesData?.data?.data || [];
  const paginationData = casesData?.data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };
  const clients = clientsData?.data || [];

  const activeFilterCount =
    (priority !== 'all' ? 1 : 0) +
    (clientId !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['priority', 'clientId', 'dateFrom', 'dateTo', 'sort', 'page'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: false });
    clearSearch();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      toast.info('Generating Excel export...');
      const { blob, filename } = await casesService.exportCases({
        exportType: 'in-progress',
        search: debouncedSearchValue || undefined,
        priority: priority === 'all' ? undefined : priority,
        clientId: clientId === 'all' ? undefined : clientId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortPair.sortBy,
        sortOrder: sortPair.sortOrder,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully');
    } catch (err) {
      logger.error('Failed to export in-progress cases:', err);
      toast.error('Failed to export cases');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = async () => {
    await refreshCases({ clearCache: true, preserveFilters: true, showToast: true });
  };

  const totalPages = paginationData.totalPages || 1;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">In Progress Cases</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all cases currently being worked on.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total In Progress</p>
                <p className="text-2xl font-bold">{stats?.inProgress ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Hourglass className="h-8 w-8 text-amber-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Long Running &gt; 3d</p>
                <p className="text-2xl font-bold">{stats?.longRunning ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Created &gt; 3 days ago</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold">{stats?.highPriority ?? '—'}</p>
                <p className="text-xs text-muted-foreground">HIGH + URGENT</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold">{stats?.completedToday ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Timer className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg In-Progress Days</p>
                <p className="text-2xl font-bold">
                  {stats?.avgInProgressDays ? stats.avgInProgressDays.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search by case #, customer, phone, address, trigger..."
        hasActiveFilters={activeFilterCount > 0}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
        filterContent={
          <FilterGrid columns={4}>
            <div className="space-y-1">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => updateParam('priority', v)}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canViewClientsFilter && (
              <div className="space-y-1">
                <Label htmlFor="client">Client</Label>
                <Select value={clientId} onValueChange={(v) => updateParam('clientId', v)}>
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
            <div className="space-y-1">
              <Label htmlFor="sort">Sort by</Label>
              <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
                <SelectTrigger id="sort">
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
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => updateParam('dateFrom', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => updateParam('dateTo', e.target.value)}
              />
            </div>
          </FilterGrid>
        }
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isExporting || isLoading}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting…' : 'Export'}
            </Button>
          </>
        }
      />

      <CaseTable cases={cases} isLoading={isLoading} />

      {paginationData.total > 0 && (
        <CasePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={paginationData.total}
          itemsPerPage={pageSize}
          onPageChange={(p) => updateParam('page', p <= 1 ? null : String(p))}
          onItemsPerPageChange={(n) => updateParam('pageSize', n === 20 ? null : String(n))}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
