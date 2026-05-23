import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MISSummaryCards } from './MISSummaryCards';
import { MISDataTable } from './MISDataTable';
import { reportsService } from '@/services/reports';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import type { MISFilters, MISDataResponse } from '@/types/mis';
import { toast } from 'sonner';
import type { VerificationType } from '@/types/client';
import { useClients, useProducts, useProductsByClient } from '@/hooks/useClients';
import { useVerificationTypes } from '@/hooks/useVerificationTypes';
import { useUsers } from '@/hooks/useUsers';
import { isBackendScopedUser, isFieldAgentUser } from '@/utils/userPermissionProfiles';
import { logger } from '@/utils/logger';

type SortValue =
  | 'taskCreatedDate_desc'
  | 'taskCreatedDate_asc'
  | 'taskCompletionDate_desc'
  | 'caseCreatedDate_desc'
  | 'amount_desc';

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: 'taskCreatedDate_desc', label: 'Newest first' },
  { value: 'taskCreatedDate_asc', label: 'Oldest first' },
  { value: 'taskCompletionDate_desc', label: 'Recently completed' },
  { value: 'caseCreatedDate_desc', label: 'Case created (newest)' },
  { value: 'amount_desc', label: 'Amount (high → low)' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function parseSort(sort: string | null): {
  sortBy: MISFilters['sortBy'];
  sortOrder: 'asc' | 'desc';
} {
  const value = (sort ?? 'taskCreatedDate_desc') as SortValue;
  const [sortBy, sortOrder] = value.split('_') as [
    NonNullable<MISFilters['sortBy']>,
    'asc' | 'desc',
  ];
  return { sortBy, sortOrder };
}

const today = (): string => new Date().toISOString().split('T')[0];
const thirtyDaysAgo = (): string =>
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export function MISDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  // URL is source of truth for all filter state.
  const dateFrom = searchParams.get('dateFrom') ?? thirtyDaysAgo();
  const dateTo = searchParams.get('dateTo') ?? today();
  const clientId = searchParams.get('clientId') ?? '';
  const productId = searchParams.get('productId') ?? '';
  const verificationTypeId = searchParams.get('verificationTypeId') ?? '';
  const caseStatus = searchParams.get('caseStatus') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const fieldAgentId = searchParams.get('fieldAgentId') ?? '';
  const backendUserId = searchParams.get('backendUserId') ?? '';
  const sort = searchParams.get('sort') ?? 'taskCreatedDate_desc';
  const pageSize = Number(searchParams.get('pageSize') ?? '50');
  const page = Number(searchParams.get('page') ?? '1');

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  // Reset page to 1 on any filter/sort/pageSize change.
  useEffect(() => {
    if (page !== 1) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // Only on these dependencies — page itself is excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchValue,
    dateFrom,
    dateTo,
    clientId,
    productId,
    verificationTypeId,
    caseStatus,
    priority,
    fieldAgentId,
    backendUserId,
    sort,
    pageSize,
  ]);

  const [isExporting, setIsExporting] = useState(false);

  const { data: clientsData } = useClients({ page: 1, limit: 100 });
  const { data: globalProductsData } = useProducts({ page: 1, limit: 100 });
  const { data: clientProductsData } = useProductsByClient(clientId || undefined);
  const { data: verificationTypesData } = useVerificationTypes({ page: 1, limit: 100 });
  const { data: usersData } = useUsers({ page: 1, limit: 100 });

  const clients = clientsData?.data || [];
  const products = clientId ? (clientProductsData?.data ?? []) : (globalProductsData?.data ?? []);
  const verificationTypes = verificationTypesData?.data || [];
  const users = usersData || [];
  const fieldAgents = users.filter((u) => isFieldAgentUser(u));
  const backendUsers = users.filter((u) => isBackendScopedUser(u));

  const filters: MISFilters = useMemo(() => {
    const { sortBy, sortOrder } = parseSort(sort);
    return {
      search: debouncedSearchValue || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      clientId: clientId ? parseInt(clientId) : undefined,
      productId: productId ? parseInt(productId) : undefined,
      verificationTypeId: verificationTypeId ? parseInt(verificationTypeId) : undefined,
      caseStatus: (caseStatus || undefined) as MISFilters['caseStatus'],
      priority: (priority || undefined) as MISFilters['priority'],
      fieldAgentId: fieldAgentId || undefined,
      backendUserId: backendUserId || undefined,
      sortBy,
      sortOrder,
      page,
      limit: pageSize,
    };
  }, [
    debouncedSearchValue,
    dateFrom,
    dateTo,
    clientId,
    productId,
    verificationTypeId,
    caseStatus,
    priority,
    fieldAgentId,
    backendUserId,
    sort,
    page,
    pageSize,
  ]);

  const { data, isLoading, refetch } = useQuery<MISDataResponse>({
    queryKey: ['mis-dashboard', filters],
    queryFn: () => reportsService.getMISDashboardData(filters),
    staleTime: 0,
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await reportsService.exportMISDashboardData(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mis_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('MIS data exported successfully');
    } catch (error) {
      logger.error('Failed to export MIS data:', error);
      toast.error('Failed to export MIS data');
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters =
    !!clientId ||
    !!productId ||
    !!verificationTypeId ||
    !!caseStatus ||
    !!priority ||
    !!fieldAgentId ||
    !!backendUserId;

  const activeFilterCount = [
    clientId,
    productId,
    verificationTypeId,
    caseStatus,
    priority,
    fieldAgentId,
    backendUserId,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    const next = new URLSearchParams(searchParams);
    [
      'clientId',
      'productId',
      'verificationTypeId',
      'caseStatus',
      'priority',
      'fieldAgentId',
      'backendUserId',
    ].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const totalRows = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 0;
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">MIS Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive Management Information System — task + case detail.
          </p>
        </div>
      </div>

      {data && <MISSummaryCards summary={data.summary} isLoading={isLoading} />}

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={clearSearch}
            isSearchLoading={isDebouncing}
            searchPlaceholder="Search by case number, customer name, phone, or task number..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            filterContent={
              <FilterGrid columns={4}>
                <div className="space-y-1">
                  <Label htmlFor="dateFrom">
                    Date From{' '}
                    <span className="text-xs font-normal text-muted-foreground">(YYYY-MM-DD)</span>
                  </Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => updateParam('dateFrom', e.target.value || null)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dateTo">
                    Date To{' '}
                    <span className="text-xs font-normal text-muted-foreground">(YYYY-MM-DD)</span>
                  </Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => updateParam('dateTo', e.target.value || null)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sort">Sort by</Label>
                  <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
                    <SelectTrigger id="sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={clientId || 'all'}
                    onValueChange={(value) => {
                      updateParam('clientId', value === 'all' ? null : value);
                      // Reset product — previously selected product may not be
                      // mapped to the new client.
                      updateParam('productId', null);
                    }}
                  >
                    <SelectTrigger id="client">
                      <SelectValue placeholder="All clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="product">Product</Label>
                  <Select
                    value={productId || 'all'}
                    onValueChange={(value) =>
                      updateParam('productId', value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger id="product">
                      <SelectValue placeholder="All products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="verificationType">Verification Type</Label>
                  <Select
                    value={verificationTypeId || 'all'}
                    onValueChange={(value) =>
                      updateParam('verificationTypeId', value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger id="verificationType">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {verificationTypes.map((type: VerificationType) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="caseStatus">Task Status</Label>
                  <Select
                    value={caseStatus || 'all'}
                    onValueChange={(value) =>
                      updateParam('caseStatus', value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger id="caseStatus">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="ASSIGNED">Assigned</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="REVOKED">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={priority || 'all'}
                    onValueChange={(value) =>
                      updateParam('priority', value === 'all' ? null : value)
                    }
                  >
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
                <div className="space-y-1">
                  <Label htmlFor="fieldAgent">Field Agent</Label>
                  <Select
                    value={fieldAgentId || 'all'}
                    onValueChange={(value) =>
                      updateParam('fieldAgentId', value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger id="fieldAgent">
                      <SelectValue placeholder="All field agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Field Agents</SelectItem>
                      {fieldAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="backendUser">Backend User</Label>
                  <Select
                    value={backendUserId || 'all'}
                    onValueChange={(value) =>
                      updateParam('backendUserId', value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger id="backendUser">
                      <SelectValue placeholder="All backend users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Backend Users</SelectItem>
                      {backendUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FilterGrid>
            }
            actions={
              <>
                <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={isExporting || isLoading || rows.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              </>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>MIS Data</CardTitle>
              <CardDescription>
                {totalRows > 0
                  ? `Showing ${rows.length} of ${totalRows} records`
                  : 'No records to show'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(isLoading && rows.length === 0) || rows.length > 0 ? (
                <MISDataTable
                  data={rows}
                  pagination={
                    data?.pagination ?? {
                      page,
                      limit: pageSize,
                      total: 0,
                      totalPages: 0,
                    }
                  }
                  onPageChange={(nextPage) =>
                    updateParam('page', nextPage > 1 ? String(nextPage) : null)
                  }
                  isLoading={isLoading}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? 'No data matches your filters. Try clearing filters or adjusting the date range.'
                      : 'No data available for the selected period.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* §9.3 pagination row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {totalRows > 0
                ? `Showing ${rows.length} of ${totalRows} records`
                : 'No records to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="pageSize">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => updateParam('pageSize', v === '50' ? null : v)}
                >
                  <SelectTrigger id="pageSize" className="w-[80px]">
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
                disabled={page === 1}
                onClick={() => updateParam('page', page > 2 ? String(page - 1) : null)}
              >
                Previous
              </Button>
              <div className="text-sm">
                Page {page} of {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
