import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Calculator, Download, Calendar } from 'lucide-react';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { commissionManagementApi } from '../../services/commissionManagementApi';
import { commissionManagementService } from '../../services/commissionManagement';
import { CommissionCalculation } from '../../types/commission';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = [
  { value: 'createdAt_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'createdAt_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'amount_desc', label: 'Amount (high → low)', sortBy: 'amount', sortOrder: 'desc' },
  { value: 'amount_asc', label: 'Amount (low → high)', sortBy: 'amount', sortOrder: 'asc' },
  { value: 'status_asc', label: 'Status A → Z', sortBy: 'status', sortOrder: 'asc' },
];

export const CommissionCalculationsTab: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [calculations, setCalculations] = useState<CommissionCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // URL state — every filter survives reload + is shareable.
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '20');
  const status = searchParams.get('status') || 'all';
  const sort = searchParams.get('sort') || 'createdAt_desc';
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

  // Reset page to 1 on filter / sort / pageSize change.
  useEffect(() => {
    if (page !== 1 && searchParams.get('page')) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue, status, sort, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const response = await commissionManagementApi.getCommissionCalculations({
          page,
          limit: pageSize,
          search: debouncedSearchValue || undefined,
          status: status === 'all' ? undefined : status,
          startDate: dateFrom || undefined,
          endDate: dateTo || undefined,
          sortBy: sortPair.sortBy,
          sortOrder: sortPair.sortOrder,
        });
        if (cancelled) {
          return;
        }
        setCalculations(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalRows(response.pagination?.total || (response.data || []).length);
      } catch (err) {
        logger.error('Error loading calculations:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    page,
    pageSize,
    debouncedSearchValue,
    status,
    dateFrom,
    dateTo,
    sortPair.sortBy,
    sortPair.sortOrder,
  ]);

  const formatMonth = (dateString: string): string => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const activeFilterCount = (status !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'dateFrom', 'dateTo', 'sort', 'page'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: false });
    clearSearch();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      toast.info('Generating Excel export...');
      // Use the hardened /commission-management/export endpoint
      // (escapeFormulaRow + COMMISSION_EXPORTED audit + 10k cap + SORT_MAP).
      const blob = await commissionManagementService.exportToExcel({
        status: status === 'all' ? undefined : status,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commission_calculations_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Commissions exported');
    } catch (err) {
      logger.error('Error exporting calculations:', err);
      toast.error('Failed to export commissions');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search by field user, client, product, or task #..."
        hasActiveFilters={activeFilterCount > 0}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
        filterContent={
          <FilterGrid columns={4}>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => updateParam('status', v)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || loading}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting…' : 'Export'}
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task #</TableHead>
                  <TableHead>Field User</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Calculator className="h-12 w-12 mb-4" />
                        <p className="text-lg font-semibold">No commission calculations found</p>
                        <p className="text-sm mt-2">
                          {activeFilterCount > 0 || debouncedSearchValue
                            ? 'Try clearing your filters.'
                            : 'Complete verification tasks to generate commissions.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  calculations.map((calculation) => (
                    <TableRow key={calculation.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {calculation.taskNumber || 'N/A'}
                        </div>
                        {calculation.verificationTypeName && (
                          <div className="text-sm text-muted-foreground">
                            {calculation.verificationTypeName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {calculation.userName || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {calculation.userEmail || ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {calculation.clientName || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>{calculation.productName || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={baseBadgeStyle}>
                          {formatBadgeLabel(calculation.rateTypeName || 'N/A')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{calculation.status || 'PENDING'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold">
                          {calculation.currency} {Number(calculation.commissionAmount).toFixed(2)}
                        </div>
                        {calculation.baseAmount && (
                          <div className="text-sm text-muted-foreground">
                            Base: {calculation.currency} {Number(calculation.baseAmount).toFixed(2)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{formatMonth(calculation.createdAt)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalRows > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} of{' '}
                {totalRows}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pageSize" className="text-sm">
                    Rows
                  </Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => updateParam('pageSize', v === '20' ? null : v)}
                  >
                    <SelectTrigger id="pageSize" className="w-20">
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
                  disabled={page <= 1}
                  onClick={() => updateParam('page', page <= 2 ? null : String(page - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages || 1}
                </span>
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
      )}
    </div>
  );
};
