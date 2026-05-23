import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Download,
  Receipt,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { billingService, type InvoiceQuery } from '@/services/billing';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { useClients } from '@/hooks/useClients';
import { InvoicesTable } from '@/components/billing/InvoicesTable';
import { CreateInvoiceDialog } from '@/components/billing/CreateInvoiceDialog';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

type SortValue =
  | 'invoiceNumber_asc'
  | 'invoiceNumber_desc'
  | 'issueDate_desc'
  | 'issueDate_asc'
  | 'totalAmount_desc'
  | 'dueDate_asc';

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: 'issueDate_desc', label: 'Newest first' },
  { value: 'issueDate_asc', label: 'Oldest first' },
  { value: 'invoiceNumber_asc', label: 'Invoice # A → Z' },
  { value: 'invoiceNumber_desc', label: 'Invoice # Z → A' },
  { value: 'totalAmount_desc', label: 'Amount (high → low)' },
  { value: 'dueDate_asc', label: 'Due soonest first' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function parseSort(sort: string | null): { sortBy: string; sortOrder: 'asc' | 'desc' } {
  const value = (sort ?? 'issueDate_desc') as SortValue;
  const [sortBy, sortOrder] = value.split('_') as [string, 'asc' | 'desc'];
  return { sortBy, sortOrder };
}

export function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  const status = searchParams.get('status') ?? 'all';
  const clientId = searchParams.get('clientId') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const sort = searchParams.get('sort') ?? 'issueDate_desc';
  const pageSize = Number(searchParams.get('pageSize') ?? '20');
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

  useEffect(() => {
    if (page !== 1) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue, status, clientId, dateFrom, dateTo, sort, pageSize]);

  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: clientsData } = useClients({ page: 1, limit: 100 });
  const clients = clientsData?.data ?? [];

  const { sortBy, sortOrder } = parseSort(sort);
  const listQuery: InvoiceQuery = {
    search: debouncedSearchValue || undefined,
    status: status !== 'all' ? status : undefined,
    clientId: clientId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortOrder,
    page,
    limit: pageSize,
  };

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', listQuery],
    queryFn: () => billingService.getInvoices(listQuery),
  });

  const { data: invoiceStatsData } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: () => billingService.getInvoiceStats(),
  });

  const stats = invoiceStatsData?.data;
  const totalInvoices = stats?.totalInvoices ?? 0;
  const totalAmount = Number(stats?.totalAmount ?? 0);
  const draftCount = stats?.statusDistribution?.DRAFT ?? 0;
  const overdueCount = stats?.overdueInvoices ?? 0;
  const outstandingAmount = Number(stats?.pendingAmount ?? 0);

  const rows = invoicesData?.data ?? [];
  // BE list returns pagination on the ApiResponse wrapper at `response.pagination`
  // — same shape used by every other §9 list page.
  type PaginationShape = { page: number; limit: number; total: number; totalPages: number };
  const pagination = (invoicesData as { pagination?: PaginationShape } | undefined)?.pagination ?? {
    page,
    limit: pageSize,
    total: 0,
    totalPages: 0,
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await billingService.exportInvoicesToExcel(listQuery);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Invoices exported successfully');
    } catch (error) {
      logger.error('Failed to export invoices:', error);
      toast.error('Failed to export invoices');
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters = status !== 'all' || !!clientId || !!dateFrom || !!dateTo;
  const activeFilterCount = [status !== 'all', !!clientId, !!dateFrom, !!dateTo].filter(
    Boolean
  ).length;

  const handleClearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'clientId', 'dateFrom', 'dateTo'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Track invoices, manage GST breakdown, and monitor outstanding payments.
          </p>
        </div>
      </div>

      {/* 5-card stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">₹{totalAmount.toLocaleString()} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{draftCount}</div>
            <p className="text-xs text-muted-foreground">Unissued invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.statusDistribution?.SENT ?? 0}</div>
            <p className="text-xs text-muted-foreground">Issued + awaiting payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{outstandingAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Sent &amp; unpaid</p>
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
            searchPlaceholder="Search by invoice number, client name, or notes..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            filterContent={
              <FilterGrid columns={4}>
                <div className="space-y-1">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => updateParam('status', v)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="SENT">Sent</SelectItem>
                      <SelectItem value="OVERDUE">Overdue</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={clientId || 'all'}
                    onValueChange={(v) => updateParam('clientId', v === 'all' ? null : v)}
                  >
                    <SelectTrigger id="client">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              </FilterGrid>
            }
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={isExporting || isLoading || rows.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
                <Button onClick={() => setShowCreateInvoice(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </>
            }
          />

          <InvoicesTable data={rows} isLoading={isLoading} />

          {/* §9.3 pagination row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {pagination.total > 0
                ? `Showing ${rows.length} of ${pagination.total} invoices`
                : 'No invoices to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="pageSize">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => updateParam('pageSize', v === '20' ? null : v)}
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
                Page {page} of {pagination.totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateInvoiceDialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice} />
    </div>
  );
}

export default InvoicesPage;
