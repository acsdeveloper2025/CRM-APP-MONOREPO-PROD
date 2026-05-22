import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  Upload,
  Sparkles,
  Wand2,
  Loader2,
  Eye,
  Calendar,
  Layers,
} from 'lucide-react';
import { reportTemplatesService } from '@/services/reportTemplates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { useClients, useProductsByClient } from '@/hooks/useClients';
import {
  useReportTemplates,
  useReportTemplate,
  useCreateReportTemplate,
  useUpdateReportTemplate,
  useDeactivateReportTemplate,
  useValidateReportTemplate,
} from '@/hooks/useReportTemplates';
import {
  reportTemplatesService,
  type ReportTemplateListItem,
  type ReportTemplatePageOrientation,
  type ReportTemplatePageSize,
} from '@/services/reportTemplates';
import { PlaceholderReference } from '@/components/reports/PlaceholderReference';
import { SAMPLE_REPORT_TEMPLATE_HTML } from '@/components/reports/sampleReportTemplate';

// ---------------------------------------------------------------------------
// Local form types
// ---------------------------------------------------------------------------

interface TemplateFormData {
  clientId: string;
  productId: string;
  name: string;
  htmlContent: string;
  pageSize: ReportTemplatePageSize;
  pageOrientation: ReportTemplatePageOrientation;
}

const EMPTY_FORM: TemplateFormData = {
  clientId: '',
  productId: '',
  name: '',
  htmlContent: '',
  pageSize: 'A4',
  pageOrientation: 'portrait',
};

const PAGE_SIZES: ReportTemplatePageSize[] = ['A4', 'LETTER', 'LEGAL'];
const PAGE_ORIENTATIONS: ReportTemplatePageOrientation[] = ['portrait', 'landscape'];
const MAX_HTML_BYTES = 4 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReportTemplatesPage() {
  // URL is source of truth for filters — canonical list-page shell per
  // feedback_fe_code_standards.md §9.
  const [searchParams, setSearchParams] = useSearchParams();
  type SortValue = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'updated_desc';
  type StatusValue = 'all' | 'true' | 'false';
  const SORT_OPTIONS: Array<{
    value: SortValue;
    label: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }> = useMemo(
    () => [
      { value: 'name_asc', label: 'Name A → Z', sortBy: 'name', sortOrder: 'asc' },
      { value: 'name_desc', label: 'Name Z → A', sortBy: 'name', sortOrder: 'desc' },
      { value: 'created_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
      { value: 'created_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
      { value: 'updated_desc', label: 'Recently updated', sortBy: 'updatedAt', sortOrder: 'desc' },
    ],
    []
  );
  const PAGE_SIZE_OPTIONS = useMemo(() => [20, 50, 100] as const, []);
  const filterClientId = searchParams.get('clientId') || '';
  const filterProductId = searchParams.get('productId') || '';
  // status: 'all' (default) / 'true' = active / 'false' = inactive.
  const status = (searchParams.get('status') as StatusValue) || 'all';
  const sort = (searchParams.get('sort') as SortValue) || 'name_asc';
  const pageSizeRaw = Number(searchParams.get('pageSize')) || 20;
  const pageSize: 20 | 50 | 100 = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeRaw)
    ? (pageSizeRaw as 20 | 50 | 100)
    : 20;
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const sortConfig = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0],
    [sort, SORT_OPTIONS]
  );

  // Standard debounced + URL-synced search, same hook used across the app.
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  const updateParam = useCallback(
    (key: string, value: string | null) => {
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
    },
    [setSearchParams]
  );

  const setCurrentPage = useCallback(
    (updater: number | ((p: number) => number)) => {
      const next = typeof updater === 'function' ? updater(currentPage) : updater;
      updateParam('page', String(Math.max(1, next)));
    },
    [currentPage, updateParam]
  );
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ReportTemplateListItem | null>(null);
  const [form, setForm] = useState<TemplateFormData>(EMPTY_FORM);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [converting, setConverting] = useState<boolean>(false);

  const { data: clientsRes } = useClients({ limit: 200 });
  const clients = useMemo(() => {
    if (!clientsRes?.data) {
      return [];
    }
    return Array.isArray(clientsRes.data) ? clientsRes.data : [];
  }, [clientsRes]);

  const { data: productsRes } = useProductsByClient(form.clientId || undefined);
  const formProducts = useMemo(() => {
    if (!productsRes?.data) {
      return [];
    }
    return Array.isArray(productsRes.data) ? productsRes.data : [];
  }, [productsRes]);

  const { data: filterProductsRes } = useProductsByClient(filterClientId || undefined);
  const filterProducts = useMemo(() => {
    if (!filterProductsRes?.data) {
      return [];
    }
    return Array.isArray(filterProductsRes.data) ? filterProductsRes.data : [];
  }, [filterProductsRes]);

  const listParams = useMemo(
    () => ({
      ...(filterClientId ? { clientId: Number(filterClientId) } : {}),
      ...(filterProductId ? { productId: Number(filterProductId) } : {}),
      ...(status === 'all' ? {} : { isActive: status as 'true' | 'false' }),
      ...(debouncedSearchValue.trim() ? { search: debouncedSearchValue.trim() } : {}),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
      page: currentPage,
      limit: pageSize,
    }),
    [filterClientId, filterProductId, status, debouncedSearchValue, sortConfig, currentPage, pageSize]
  );

  // Reset to page 1 when any filter narrows results.
  useEffect(() => {
    if (currentPage !== 1) {
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
  }, [filterClientId, filterProductId, status, sort, pageSize, debouncedSearchValue]);

  const { data: listRes, isLoading, refetch } = useReportTemplates(listParams);
  const templates = useMemo(() => {
    if (!listRes?.data) {
      return [];
    }
    return Array.isArray(listRes.data) ? listRes.data : [];
  }, [listRes]);

  const { data: editingRes } = useReportTemplate(editingId);
  useEffect(() => {
    if (!editingId) {
      return;
    }
    const loaded = editingRes?.data;
    if (loaded) {
      setForm({
        clientId: String(loaded.clientId),
        productId: String(loaded.productId),
        name: loaded.name,
        htmlContent: loaded.htmlContent ?? '',
        pageSize: loaded.pageSize,
        pageOrientation: loaded.pageOrientation,
      });
    }
  }, [editingId, editingRes]);

  const createMutation = useCreateReportTemplate();
  const updateMutation = useUpdateReportTemplate();
  const deactivateMutation = useDeactivateReportTemplate();
  const validateMutation = useValidateReportTemplate();

  const resetDialog = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setValidationMessage('');
  };

  const openCreate = () => {
    resetDialog();
    setDialogOpen(true);
  };

  const openEdit = (template: ReportTemplateListItem) => {
    setEditingId(template.id);
    setDialogOpen(true);
    setValidationMessage('');
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetDialog();
  };

  const handleClientChange = (value: string) => {
    setForm((f) => ({ ...f, clientId: value, productId: '' }));
  };

  const handleProductChange = (value: string) => {
    setForm((f) => ({ ...f, productId: value }));
  };

  const handleHtmlFileUpload = async (file: File) => {
    if (file.size > MAX_HTML_BYTES) {
      toast.error(`File exceeds ${Math.round(MAX_HTML_BYTES / 1024)} KB limit`);
      return;
    }
    const text = await file.text();
    setForm((f) => ({ ...f, htmlContent: text }));
    setValidationMessage('');
    toast.info('HTML loaded into editor');
  };

  const handleValidate = async () => {
    if (!form.htmlContent.trim()) {
      setValidationMessage('htmlContent is empty');
      return;
    }
    const res = await validateMutation.mutateAsync(form.htmlContent);
    const result = res.data;
    if (!result) {
      setValidationMessage('Unexpected validation response');
      return;
    }
    if (result.valid) {
      setValidationMessage('✅ Template compiles successfully');
    } else {
      setValidationMessage(`❌ ${result.error ?? 'Compile error'}`);
    }
  };

  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    if (!form.htmlContent.trim()) {
      toast.error('Nothing to preview — HTML is empty');
      return;
    }
    if (new Blob([form.htmlContent]).size > MAX_HTML_BYTES) {
      toast.error(`HTML exceeds ${Math.round(MAX_HTML_BYTES / 1024)} KB limit`);
      return;
    }
    setPreviewing(true);
    try {
      const html = await reportTemplatesService.previewHtml({ htmlContent: form.htmlContent });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        toast.error('Preview blocked by popup blocker — allow popups for localhost');
        URL.revokeObjectURL(url);
        return;
      }
      // Revoke on next tick so the browser has time to load the blob.
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success('Preview opened in new tab');
    } catch (err: unknown) {
      let msg = 'Failed to render preview';
      if (err && typeof err === 'object' && 'response' in err) {
        const r = (err as { response?: { data?: { message?: string } } }).response;
        msg = r?.data?.message ?? msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setPreviewing(false);
    }
  };

  const handleConvertPdf = async (file: File) => {
    const clientIdNum = Number(form.clientId);
    const productIdNum = Number(form.productId);
    if (!clientIdNum || !productIdNum) {
      toast.error('Select a client and product before uploading a PDF to convert');
      return;
    }
    // 10 MB mirrors the backend cap.
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF is larger than 10 MB');
      return;
    }
    setConverting(true);
    setValidationMessage('');
    try {
      const res = await reportTemplatesService.convertFromPdf(clientIdNum, productIdNum, file);
      const data = res.data;
      if (!data) {
        toast.error('Converter returned no data');
        return;
      }
      setForm((f) => ({ ...f, htmlContent: data.htmlContent }));
      const pages = data.usage.pagesCount ?? 0;
      if (data.validatedOk) {
        setValidationMessage(
          `✅ Extracted ${pages} page(s) in ${Math.round(data.usage.elapsedMs / 100) / 10}s — review layout + placeholders.`
        );
        toast.success('PDF converted to template draft');
      } else {
        setValidationMessage(
          `⚠️ Draft did not compile: ${data.validationError ?? 'unknown error'}. Edit and Validate to fix.`
        );
        toast.warning('Draft generated but needs manual fixes');
      }
    } catch (err: unknown) {
      // Backend returns { success, message, error: { code } } on failure.
      let msg = 'Failed to convert PDF';
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const body = res?.data as { message?: string } | undefined;
        if (body?.message) {
          msg = body.message;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg, { duration: 7000 });
    } finally {
      setConverting(false);
    }
  };

  const handleSave = async () => {
    const clientIdNum = Number(form.clientId);
    const productIdNum = Number(form.productId);
    if (!clientIdNum || !productIdNum) {
      toast.error('Client and product are required');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.htmlContent.trim()) {
      toast.error('HTML content is required');
      return;
    }
    if (new Blob([form.htmlContent]).size > MAX_HTML_BYTES) {
      toast.error(`HTML exceeds ${Math.round(MAX_HTML_BYTES / 1024)} KB limit`);
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          payload: {
            name: form.name.trim(),
            htmlContent: form.htmlContent,
            pageSize: form.pageSize,
            pageOrientation: form.pageOrientation,
          },
        });
      } else {
        await createMutation.mutateAsync({
          clientId: clientIdNum,
          productId: productIdNum,
          name: form.name.trim(),
          htmlContent: form.htmlContent,
          pageSize: form.pageSize,
          pageOrientation: form.pageOrientation,
        });
      }
      closeDialog();
      void refetch();
    } catch {
      // Toast already shown by mutation onError handler.
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) {
      return;
    }
    try {
      await deactivateMutation.mutateAsync(deleteCandidate.id);
      setDeleteCandidate(null);
      void refetch();
    } catch {
      // Toast shown by mutation onError.
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const htmlBytes = new Blob([form.htmlContent]).size;

  // 5-card stats from BE (NOT FE-derived from paginated array — D-17 anti-pattern).
  const { data: statsRes } = useQuery({
    queryKey: ['report-templates-stats'],
    queryFn: () => reportTemplatesService.getStats(),
  });
  const stats = statsRes?.data || {
    total: 0,
    active: 0,
    inactive: 0,
    recentlyAddedCount: 0,
    clientProductPairCount: 0,
  };

  const hasActiveFilters =
    !!filterClientId || !!filterProductId || status !== 'all' || sort !== 'name_asc';
  const activeFilterCount =
    (filterClientId ? 1 : 0) +
    (filterProductId ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (sort !== 'name_asc' ? 1 : 0);

  const handleClearFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('clientId');
        next.delete('productId');
        next.delete('status');
        next.delete('sort');
        return next;
      },
      { replace: true }
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Templates</h1>
        <p className="text-muted-foreground text-sm">
          HTML / Handlebars PDF report templates. One active per client + product.
        </p>
      </div>

      {/* Stats Cards — 5-card shell per feedback_fe_code_standards.md §9 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Current versions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">Superseded versions</p>
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
            <CardTitle className="text-sm font-medium">Client-Product Pairs</CardTitle>
            <Layers className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientProductPairCount}</div>
            <p className="text-xs text-muted-foreground">Distinct mappings</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters + Actions (unified) */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search by template name, client, or product..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={handleClearFilters}
        filterContent={
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="rt-client">Client</Label>
              <Select
                value={filterClientId || 'all'}
                onValueChange={(val) => {
                  updateParam('clientId', val === 'all' ? null : val);
                  updateParam('productId', null);
                }}
              >
                <SelectTrigger id="rt-client">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rt-product">Product</Label>
              <Select
                value={filterProductId || 'all'}
                onValueChange={(val) => updateParam('productId', val === 'all' ? null : val)}
                disabled={!filterClientId}
              >
                <SelectTrigger id="rt-product">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {filterProducts.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rt-status">Status</Label>
              <Select value={status} onValueChange={(v) => updateParam('status', v)}>
                <SelectTrigger id="rt-status">
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
              <Label htmlFor="rt-sort">Sort by</Label>
              <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
                <SelectTrigger id="rt-sort">
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
          </div>
        }
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        }
      />

      {/* Templates Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearchValue
                ? `No templates matching "${debouncedSearchValue}"`
                : 'No templates yet. Click "New Template" to create one.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.clientName}</TableCell>
                      <TableCell>{t.productName}</TableCell>
                      <TableCell>v{t.version}</TableCell>
                      <TableCell>
                        {t.isActive ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" /> Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{t.generatedCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.pageSize} / {t.pageOrientation}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(t)}
                          aria-label="Edit template"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {t.isActive && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteCandidate(t)}
                            aria-label="Deactivate template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {listRes?.pagination && listRes.pagination.total > 0
                ? `Page ${listRes.pagination.page} of ${listRes.pagination.totalPages} (${listRes.pagination.total} total)`
                : 'No templates to show'}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="rt-page-size" className="text-sm text-muted-foreground">
                  Rows
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => updateParam('pageSize', v)}
                >
                  <SelectTrigger id="rt-page-size" className="w-[80px] h-8">
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!listRes?.pagination || listRes.pagination.page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {listRes?.pagination?.page ?? 1} of {listRes?.pagination?.totalPages ?? 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={
                  !listRes?.pagination ||
                  listRes.pagination.page >= listRes.pagination.totalPages
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Report Template' : 'New Report Template'}</DialogTitle>
            <DialogDescription>
              HTML/Handlebars template per client + product. Use <code>{'{{placeholder}}'}</code>{' '}
              syntax. Available placeholders will be documented on the Placeholder Reference panel
              (coming soon).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Client</Label>
              <Select
                value={form.clientId}
                onValueChange={handleClientChange}
                disabled={!!editingId}
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
              <Select
                value={form.productId}
                onValueChange={handleProductChange}
                disabled={!!editingId || !form.clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {formProducts.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. HDFC Home Loan RCU Report"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Page Size</Label>
              <Select
                value={form.pageSize}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, pageSize: val as ReportTemplatePageSize }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Orientation</Label>
              <Select
                value={form.pageOrientation}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    pageOrientation: val as ReportTemplatePageOrientation,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_ORIENTATIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>HTML / Handlebars</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {htmlBytes.toLocaleString()} / {MAX_HTML_BYTES.toLocaleString()} bytes
                  </span>
                  <label
                    htmlFor="report-template-html-upload"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <Upload className="h-3 w-3" /> Upload .html
                  </label>
                  <input
                    id="report-template-html-upload"
                    aria-label="Upload HTML template file"
                    type="file"
                    accept=".html,.htm,.hbs,text/html"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleHtmlFileUpload(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="report-template-pdf-convert"
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent ${converting ? 'pointer-events-none opacity-60' : ''}`}
                    title="Upload a bank's PDF report format — we extract text locally and bind known labels to placeholders"
                  >
                    {converting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}{' '}
                    {converting ? 'Converting...' : 'Convert from PDF'}
                  </label>
                  <input
                    id="report-template-pdf-convert"
                    aria-label="Convert PDF report to HTML template"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    disabled={converting}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleConvertPdf(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForm((f) => ({ ...f, htmlContent: SAMPLE_REPORT_TEMPLATE_HTML }));
                      setValidationMessage('');
                      toast.info('Sample template loaded into editor');
                    }}
                    title="Replace editor content with a starter template"
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Sample
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleValidate()}
                    disabled={validateMutation.isPending}
                  >
                    <FileText className="mr-1 h-3 w-3" /> Validate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handlePreview()}
                    disabled={previewing}
                    title="Open the rendered template (with sample data) in a new tab"
                  >
                    {previewing ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Eye className="mr-1 h-3 w-3" />
                    )}
                    {previewing ? 'Rendering...' : 'Preview'}
                  </Button>
                </div>
              </div>
              <textarea
                aria-label="HTML template content"
                className="min-h-[260px] w-full resize-y rounded-md border bg-background p-2 font-mono text-xs"
                value={form.htmlContent}
                onChange={(e) => setForm((f) => ({ ...f, htmlContent: e.target.value }))}
                placeholder="<!DOCTYPE html>&#10;<html>&#10;<body>&#10;  <h1>{{case.customerName}}</h1>&#10;  ...&#10;</body>&#10;</html>"
                spellCheck={false}
              />
              {validationMessage && (
                <p className="mt-1 text-xs text-muted-foreground">{validationMessage}</p>
              )}
              <div className="mt-3">
                <PlaceholderReference
                  clientId={form.clientId ? Number(form.clientId) : null}
                  productId={form.productId ? Number(form.productId) : null}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteCandidate}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCandidate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate template?</DialogTitle>
            <DialogDescription>
              {deleteCandidate
                ? `"${deleteCandidate.name}" will be deactivated. Past generated reports keep their pinned version in the audit log.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
