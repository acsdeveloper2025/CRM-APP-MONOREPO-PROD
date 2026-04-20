import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
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
  const [filterClientId, setFilterClientId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(true);
  // Standard debounced + URL-synced search, same hook used across the app.
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });
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
      ...(filterActiveOnly ? { isActive: true } : {}),
      ...(debouncedSearchValue.trim() ? { search: debouncedSearchValue.trim() } : {}),
      limit: 50,
    }),
    [filterClientId, filterProductId, filterActiveOnly, debouncedSearchValue]
  );

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

  // Derived stats for the top cards, mirroring CaseDataTemplatesPage.
  const activeCount = templates.filter((t) => t.isActive).length;
  const inactiveCount = templates.length - activeCount;

  const hasActiveFilters = !!filterClientId || !!filterProductId || !filterActiveOnly;
  const activeFilterCount =
    (filterClientId ? 1 : 0) + (filterProductId ? 1 : 0) + (filterActiveOnly ? 0 : 1);

  const handleClearFilters = () => {
    setFilterClientId('');
    setFilterProductId('');
    setFilterActiveOnly(true);
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

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveCount}</div>
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Client</Label>
              <Select
                value={filterClientId || 'all'}
                onValueChange={(val) => {
                  setFilterClientId(val === 'all' ? '' : val);
                  setFilterProductId('');
                }}
              >
                <SelectTrigger>
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
            <div>
              <Label className="text-xs">Product</Label>
              <Select
                value={filterProductId || 'all'}
                onValueChange={(val) => setFilterProductId(val === 'all' ? '' : val)}
                disabled={!filterClientId}
              >
                <SelectTrigger>
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
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={filterActiveOnly ? 'active' : 'all'}
                onValueChange={(val) => setFilterActiveOnly(val === 'active')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="all">All (incl. deactivated)</SelectItem>
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
                </div>
              </div>
              <textarea
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
