import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  CheckCircle,
  Clock,
  Percent,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useClients, useProductsByClient } from '@/hooks/useClients';
import { apiService } from '@/services/api';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface MISField {
  id: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  prefillSource: string | null;
}

interface MISRow {
  caseId: number;
  customerName: string;
  caseStatus: string;
  instanceLabel: string;
  taskNumber: string | null;
  dataEntryStatus: string;
  caseCreatedAt: string;
  fieldValues: Record<string, unknown>;
}

interface MISResponse {
  template: { id: number; name: string; version: number; fields: MISField[] } | null;
  data: MISRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

interface MISStats {
  total: number;
  completed: number;
  inProgress: number;
  completionRate: number;
  uniqueCases: number;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = [
  {
    value: 'caseCreatedAt_desc',
    label: 'Newest case first',
    sortBy: 'caseCreatedAt',
    sortOrder: 'desc',
  },
  {
    value: 'caseCreatedAt_asc',
    label: 'Oldest case first',
    sortBy: 'caseCreatedAt',
    sortOrder: 'asc',
  },
  {
    value: 'caseNumber_desc',
    label: 'Case # (high → low)',
    sortBy: 'caseNumber',
    sortOrder: 'desc',
  },
  { value: 'customerName_asc', label: 'Customer A → Z', sortBy: 'customerName', sortOrder: 'asc' },
];

export function DataEntryMISPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);

  // URL state — every filter survives reload + is shareable.
  const clientId = searchParams.get('clientId') || '';
  const productId = searchParams.get('productId') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const sort = searchParams.get('sort') || 'caseCreatedAt_desc';
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '20');

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

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch } = useUnifiedSearch({
    syncWithUrl: true,
  });

  const { data: clientsRes } = useClients({ limit: 200 });
  const clients = useMemo(() => {
    if (!clientsRes?.data) {
      return [];
    }
    return Array.isArray(clientsRes.data) ? clientsRes.data : [];
  }, [clientsRes]);

  const { data: productsRes } = useProductsByClient(clientId || undefined);
  const products = useMemo(() => {
    if (!productsRes?.data) {
      return [];
    }
    return Array.isArray(productsRes.data) ? productsRes.data : [];
  }, [productsRes]);

  // Reset to page 1 when any filter changes.
  useEffect(() => {
    if (page !== 1 && searchParams.get('page')) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, productId, dateFrom, dateTo, statusFilter, sort, debouncedSearchValue, pageSize]);

  // Clear product when client changes — but only AFTER products have
  // loaded for the new client. Otherwise the initial render (empty
  // products array) would clobber a valid URL-loaded productId.
  useEffect(() => {
    if (
      productId &&
      productsRes !== undefined &&
      products.length > 0 &&
      !products.find((p) => String(p.id) === productId)
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete('productId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, products, productsRes]);

  const ready = !!(clientId && productId);

  const baseFilters = {
    clientId: clientId ? Number(clientId) : undefined,
    productId: productId ? Number(productId) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: debouncedSearchValue || undefined,
  };

  const { data: misRes, isLoading } = useQuery({
    queryKey: [
      'data-entry-mis',
      clientId,
      productId,
      dateFrom,
      dateTo,
      statusFilter,
      sort,
      debouncedSearchValue,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        ...(baseFilters as Record<string, string | number>),
        page,
        limit: pageSize,
        sortBy: sortPair.sortBy,
        sortOrder: sortPair.sortOrder,
      };
      if (statusFilter !== 'all') {
        params.dataEntryStatus = statusFilter;
      }
      return apiService.get<MISResponse>('/case-data-entries/mis', params);
    },
    enabled: ready,
  });

  // 5-card stats from new /mis/stats endpoint. Ignores statusFilter so
  // partition counters reflect the full population (Completed / In Progress
  // cards remain meaningful even when narrowed by the dropdown).
  const { data: statsRes } = useQuery({
    queryKey: ['data-entry-mis-stats', clientId, productId, dateFrom, dateTo, debouncedSearchValue],
    queryFn: async () =>
      apiService.get<MISStats>(
        '/case-data-entries/mis/stats',
        baseFilters as Record<string, unknown>
      ),
    enabled: ready,
  });
  const stats = (statsRes?.data as unknown as MISStats) || null;

  const misData: MISResponse | null = useMemo(() => {
    const raw = misRes?.data;
    if (!raw) {
      return null;
    }
    return raw as unknown as MISResponse;
  }, [misRes]);

  const template = misData?.template;
  const rows = misData?.data ?? [];
  const pagination = misData?.pagination ?? { total: 0, page: 1, limit: pageSize, totalPages: 0 };
  const fields = template?.fields ?? [];

  const handleExport = async () => {
    if (!clientId || !productId) {
      return;
    }
    setExporting(true);
    try {
      toast.info('Generating Excel export...');
      const params: Record<string, string | number> = {
        clientId: Number(clientId),
        productId: Number(productId),
      };
      if (dateFrom) {
        params.dateFrom = dateFrom;
      }
      if (dateTo) {
        params.dateTo = dateTo;
      }
      if (statusFilter !== 'all') {
        params.dataEntryStatus = statusFilter;
      }
      if (debouncedSearchValue) {
        params.search = debouncedSearchValue;
      }
      params.sortBy = sortPair.sortBy;
      params.sortOrder = sortPair.sortOrder;
      const response = await apiService.getRaw<Blob>('/case-data-entries/mis/export', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cName = clients.find((c) => String(c.id) === clientId)?.name ?? 'Export';
      const pName = products.find((p) => String(p.id) === productId)?.name ?? '';
      a.download = `DataEntry_${cName}_${pName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      toast.error('Export failed');
      logger.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatCellValue = (val: unknown): string => {
    if (val === null || val === undefined || val === '') {
      return '';
    }
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return String(val);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Entry MIS</h1>
        <p className="text-sm text-muted-foreground">
          View and export data entry records by client and product.
        </p>
      </div>

      {/* Selector + Filters — form-driven contract per §9 deviation
          (client+product required to seed the page; can't show stats without
          knowing which template to scope to). */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="client">Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  const next = new URLSearchParams(searchParams);
                  if (v) {
                    next.set('clientId', v);
                  } else {
                    next.delete('clientId');
                  }
                  next.delete('productId');
                  next.delete('page');
                  setSearchParams(next, { replace: false });
                }}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product">Product</Label>
              <Select
                value={productId}
                onValueChange={(v) => updateParam('productId', v)}
                disabled={!clientId}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder={clientId ? 'Select product' : 'Pick client first'} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateFrom">
                Date From{' '}
                <span className="text-xs font-normal text-muted-foreground">(YYYY-MM-DD)</span>
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => updateParam('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">
                Date To{' '}
                <span className="text-xs font-normal text-muted-foreground">(YYYY-MM-DD)</span>
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => updateParam('dateTo', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => updateParam('status', v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
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
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Customer name or case #"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!ready && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a client and product to view data entry records.
          </CardContent>
        </Card>
      )}

      {ready && (
        <>
          {/* 5-card stats from /mis/stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total ?? '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.completed ?? '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.inProgress ?? '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <Percent className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats !== null ? `${stats.completionRate}%` : '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Cases</CardTitle>
                <Briefcase className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.uniqueCases ?? '—'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {searchValue && (
              <Button variant="outline" size="sm" onClick={clearSearch}>
                Clear search
              </Button>
            )}
            <Button onClick={handleExport} disabled={exporting || rows.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {template
                    ? 'No data entry records found for the selected filters.'
                    : 'No template configured for this client + product.'}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap w-12" aria-label="Report" />
                          <TableHead className="whitespace-nowrap">Case #</TableHead>
                          <TableHead className="whitespace-nowrap">Customer</TableHead>
                          <TableHead className="whitespace-nowrap">Instance</TableHead>
                          <TableHead className="whitespace-nowrap">Task #</TableHead>
                          <TableHead className="whitespace-nowrap">DE Status</TableHead>
                          <TableHead className="whitespace-nowrap">Received</TableHead>
                          {fields.map((f) => (
                            <TableHead key={f.fieldKey} className="whitespace-nowrap">
                              {f.fieldLabel}
                              {f.prefillSource && (
                                <span className="text-xs text-muted-foreground ml-1">*</span>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, idx) => (
                          <TableRow key={`${r.caseId}-${idx}`}>
                            <TableCell className="w-12">
                              <DownloadReportButton
                                caseId={r.caseId}
                                size="icon"
                                variant="ghost"
                                label={`Download report for case ${r.caseId}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{r.caseId}</TableCell>
                            <TableCell>{r.customerName}</TableCell>
                            <TableCell>{r.instanceLabel}</TableCell>
                            <TableCell>{r.taskNumber ?? ''}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  r.dataEntryStatus === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }
                              >
                                {r.dataEntryStatus === 'completed' ? 'Completed' : 'In Progress'}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {r.caseCreatedAt
                                ? new Date(r.caseCreatedAt).toLocaleDateString('en-IN')
                                : ''}
                            </TableCell>
                            {fields.map((f) => (
                              <TableCell key={f.fieldKey} className="max-w-[200px] truncate">
                                {formatCellValue(r.fieldValues?.[f.fieldKey])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {pagination.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(page - 1) * pageSize + 1}–
                        {Math.min(page * pageSize, pagination.total)} of {pagination.total}
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
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {page} of {pagination.totalPages || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= pagination.totalPages}
                          onClick={() => updateParam('page', String(page + 1))}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
