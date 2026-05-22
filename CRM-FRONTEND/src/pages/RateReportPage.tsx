import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Download,
  Trash2,
  IndianRupee,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  MoreHorizontal,
} from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ratesService, type Rate } from '@/services/rates';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { rateTypesService } from '@/services/rateTypes';
import { DeleteConfirmationDialog } from '@/components/rate-management/DeleteConfirmationDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';
import { logger } from '@/utils/logger';

type SortValue =
  | 'name_asc'
  | 'name_desc'
  | 'amount_desc'
  | 'amount_asc'
  | 'created_desc'
  | 'created_asc';
type StatusValue = 'all' | 'true' | 'false';

const SORT_OPTIONS: Array<{
  value: SortValue;
  label: string;
  sortBy: 'clientName' | 'amount' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}> = [
  { value: 'name_asc', label: 'Client A → Z', sortBy: 'clientName', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Client Z → A', sortBy: 'clientName', sortOrder: 'desc' },
  { value: 'amount_desc', label: 'Rate high → low', sortBy: 'amount', sortOrder: 'desc' },
  { value: 'amount_asc', label: 'Rate low → high', sortBy: 'amount', sortOrder: 'asc' },
  { value: 'created_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'created_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 20;
const DEFAULT_SORT: SortValue = 'name_asc';
const DEFAULT_STATUS: StatusValue = 'all';
const isPageSize = (n: number): n is PageSize =>
  (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);

export function RateReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') as StatusValue) || DEFAULT_STATUS;
  const sort = (searchParams.get('sort') as SortValue) || DEFAULT_SORT;
  const pageSizeRaw = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const pageSize: PageSize = isPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const filterClient = searchParams.get('client') || 'all';
  const filterProduct = searchParams.get('product') || 'all';
  const filterVT = searchParams.get('vt') || 'all';
  const filterRateType = searchParams.get('rateType') || 'all';

  const [deletingRate, setDeletingRate] = useState<Rate | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  const sortConfig = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0],
    [sort]
  );

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
  }, [
    debouncedSearchValue,
    status,
    sort,
    pageSize,
    dateFrom,
    dateTo,
    filterClient,
    filterProduct,
    filterVT,
    filterRateType,
  ]);

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

  const listArgs = useMemo(
    () => ({
      search: debouncedSearchValue || undefined,
      isActive: (status === 'all' ? 'all' : (status as 'true' | 'false')) as
        | 'true'
        | 'false'
        | 'all',
      clientId: filterClient === 'all' ? undefined : Number(filterClient),
      productId: filterProduct === 'all' ? undefined : Number(filterProduct),
      verificationTypeId: filterVT === 'all' ? undefined : Number(filterVT),
      rateTypeId: filterRateType === 'all' ? undefined : Number(filterRateType),
      createdFrom: dateFrom || undefined,
      createdTo: dateTo || undefined,
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
      page,
      limit: pageSize,
    }),
    [
      debouncedSearchValue,
      status,
      filterClient,
      filterProduct,
      filterVT,
      filterRateType,
      dateFrom,
      dateTo,
      sortConfig,
      page,
      pageSize,
    ]
  );

  const { data: ratesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['rates', listArgs],
    queryFn: () => ratesService.getRates(listArgs),
  });

  const { data: statsResp } = useQuery({
    queryKey: ['rate-stats'],
    queryFn: () => ratesService.getRateStats(),
  });
  const stats = statsResp?.data || {
    total: 0,
    active: 0,
    inactive: 0,
    recentlyAddedCount: 0,
    averageAmount: 0,
    minAmount: 0,
    maxAmount: 0,
    uniqueClients: 0,
  };

  // Filter-dropdown data (independent — not cascading on form selection).
  const { data: filterClientsResp } = useQuery({
    queryKey: ['clients', 'filter-options'],
    queryFn: () => clientsService.getClients({ limit: 500 }),
  });
  const { data: filterProductsResp } = useQuery({
    queryKey: ['products', 'filter-options'],
    queryFn: () =>
      productsService.getProducts({
        isActive: 'true',
        limit: 500,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });
  const { data: filterVTsResp } = useQuery({
    queryKey: ['verification-types-active'],
    queryFn: () => verificationTypesService.getVerificationTypes({ isActive: true, limit: 100 }),
  });
  const { data: filterRateTypesResp } = useQuery({
    queryKey: ['rate-types', 'active-for-filter'],
    queryFn: () => rateTypesService.getActiveRateTypes(),
  });

  const deleteRateMutation = useMutationWithInvalidation({
    mutationFn: (rateId: number) => ratesService.deleteRate(rateId),
    invalidateKeys: [['rates'], ['rate-stats'], ['rate-management-stats']],
    successMessage: 'Rate deleted successfully',
    errorContext: 'Rate Deletion',
    errorFallbackMessage: 'Failed to delete rate',
    onSuccess: () => setDeletingRate(null),
  });

  const rates = ratesData?.data || [];
  const total = ratesData?.pagination?.total ?? 0;
  const totalPages = ratesData?.pagination?.totalPages ?? 1;

  const filterClientOptions = filterClientsResp?.data || [];
  const filterProductOptions = filterProductsResp?.data || [];
  const filterVTOptions = filterVTsResp?.data || [];
  const filterRateTypeOptions = filterRateTypesResp?.data || [];

  const activeFilterCount =
    (status !== DEFAULT_STATUS ? 1 : 0) +
    (sort !== DEFAULT_SORT ? 1 : 0) +
    (filterClient !== 'all' ? 1 : 0) +
    (filterProduct !== 'all' ? 1 : 0) +
    (filterVT !== 'all' ? 1 : 0) +
    (filterRateType !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const handleClearFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['status', 'sort', 'client', 'product', 'vt', 'rateType', 'dateFrom', 'dateTo'].forEach(
          (k) => next.delete(k)
        );
        return next;
      },
      { replace: true }
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await ratesService.exportRates({
        search: listArgs.search,
        isActive: listArgs.isActive,
        clientId: listArgs.clientId,
        productId: listArgs.productId,
        verificationTypeId: listArgs.verificationTypeId,
        rateTypeId: listArgs.rateTypeId,
        createdFrom: listArgs.createdFrom,
        createdTo: listArgs.createdTo,
        sortBy: listArgs.sortBy,
        sortOrder: listArgs.sortOrder,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rates_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      logger.error('Rates export failed', err);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label htmlFor="rr-status">Status</Label>
        <Select value={status} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="rr-status">
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
        <Label htmlFor="rr-client">Client</Label>
        <Select value={filterClient} onValueChange={(v) => updateParam('client', v)}>
          <SelectTrigger id="rr-client">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {filterClientOptions.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rr-product">Product</Label>
        <Select value={filterProduct} onValueChange={(v) => updateParam('product', v)}>
          <SelectTrigger id="rr-product">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {filterProductOptions.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rr-vt">Verification Type</Label>
        <Select value={filterVT} onValueChange={(v) => updateParam('vt', v)}>
          <SelectTrigger id="rr-vt">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VTs</SelectItem>
            {filterVTOptions.map((vt) => (
              <SelectItem key={vt.id} value={String(vt.id)}>
                {vt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rr-rt">Rate Type</Label>
        <Select value={filterRateType} onValueChange={(v) => updateParam('rateType', v)}>
          <SelectTrigger id="rr-rt">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rate types</SelectItem>
            {filterRateTypeOptions.map((rt) => (
              <SelectItem key={rt.id} value={String(rt.id)}>
                {rt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rr-sort">Sort by</Label>
        <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
          <SelectTrigger id="rr-sort">
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
        <Label htmlFor="rr-date-from">Date From</Label>
        <Input
          id="rr-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rr-date-to">Date To</Label>
        <Input
          id="rr-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => updateParam('dateTo', e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rate Report</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all configured rates with comprehensive filtering and reporting.
        </p>
      </div>

      {/* 5-card stats grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rates</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">Disabled rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recently Added</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentlyAddedCount}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Number(stats.averageAmount || 0).toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.uniqueClients} unique client{stats.uniqueClients === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={clearSearch}
            isSearchLoading={isDebouncing}
            searchPlaceholder="Search by client, product, VT or rate type..."
            filterContent={filterContent}
            hasActiveFilters={activeFilterCount > 0}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            actions={
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting || ratesLoading}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting…' : 'Export'}
              </Button>
            }
          />

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Verification Type</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No rates found
                    </TableCell>
                  </TableRow>
                ) : (
                  rates.map((rate, idx) => (
                    <TableRow
                      key={
                        rate.id ||
                        `${rate.clientId}-${rate.productId}-${rate.verificationTypeId}-${rate.rateTypeId}-${idx}`
                      }
                    >
                      <TableCell>
                        <div className="font-medium">{rate.clientName}</div>
                        <div className="text-xs text-muted-foreground">{rate.clientCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{rate.productName}</div>
                        <div className="text-xs text-muted-foreground">{rate.productCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{rate.verificationTypeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {rate.verificationTypeCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rate.rateTypeName}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {rate.currency} {Number(rate.amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(rate.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {rate.isActive ? (
                          <Badge variant="default">ACTIVE</Badge>
                        ) : (
                          <Badge variant="secondary">INACTIVE</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Row actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setDeletingRate(rate)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {total > 0 ? `Showing ${rates.length} of ${total} rates` : 'No rates to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="rr-page-size">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => updateParam('pageSize', v === '20' ? null : v)}
                >
                  <SelectTrigger id="rr-page-size" className="w-20">
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
                onClick={() => updateParam('page', String(page - 1))}
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

      {deletingRate && (
        <DeleteConfirmationDialog
          open={!!deletingRate}
          onOpenChange={(open) => !open && setDeletingRate(null)}
          title="Delete Rate"
          description={`Delete rate for ${deletingRate.clientName} - ${deletingRate.productName} - ${deletingRate.verificationTypeName} - ${deletingRate.rateTypeName}? This cannot be undone.`}
          onConfirm={() => deleteRateMutation.mutate(deletingRate.id)}
          isLoading={deleteRateMutation.isPending}
        />
      )}
    </div>
  );
}
