import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { toast } from 'sonner';

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

export function DataEntryMISPage() {
  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const pageSize = 20;

  const { data: clientsRes } = useClients({ limit: 200 });
  const clients = useMemo(
    () =>
      (clientsRes as unknown as { data?: { data?: Array<{ id: number; name: string }> } })?.data
        ?.data ?? [],
    [clientsRes]
  );
  const { data: productsRes } = useProductsByClient(clientId || undefined);
  const products = useMemo(
    () =>
      (productsRes as unknown as { data?: { data?: Array<{ id: number; name: string }> } })?.data
        ?.data ?? [],
    [productsRes]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [clientId, productId, dateFrom, dateTo, statusFilter]);

  const ready = !!(clientId && productId);

  const { data: misRes, isLoading } = useQuery({
    queryKey: ['data-entry-mis', clientId, productId, dateFrom, dateTo, statusFilter, currentPage],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        clientId: Number(clientId),
        productId: Number(productId),
        page: currentPage,
        limit: pageSize,
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
      return apiService.get<MISResponse>('/case-data-entries/mis', params);
    },
    enabled: ready,
  });

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

  const completedCount = rows.filter((r) => r.dataEntryStatus === 'completed').length;
  const inProgressCount = rows.length - completedCount;

  const handleExport = async () => {
    if (!clientId || !productId) {
      return;
    }
    setExporting(true);
    try {
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
      console.error('Export error:', err);
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
        <h1 className="text-2xl font-bold tracking-tight">Data Entry MIS</h1>
        <p className="text-muted-foreground text-sm">
          View and export data entry records by client and product
        </p>
      </div>

      {/* Selector + Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setProductId('');
                }}
              >
                <SelectTrigger>
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
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId} disabled={!clientId}>
                <SelectTrigger>
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
              <Label>Date From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleExport}
                disabled={!ready || exporting || rows.length === 0}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting...' : 'Export Excel'}
              </Button>
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
          {/* Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pagination.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{inProgressCount}</div>
              </CardContent>
            </Card>
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

                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * pageSize + 1}–
                        {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {currentPage} of {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= pagination.totalPages}
                          onClick={() => setCurrentPage((p) => p + 1)}
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
