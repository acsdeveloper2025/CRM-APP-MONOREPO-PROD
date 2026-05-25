import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  Download,
  Edit,
  Trash2,
  IndianRupee,
  CheckCircle,
  XCircle,
  Calendar,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { clientsService } from '@/services/clients';
import { CURRENCIES } from '@/types/constants';
import { productsService } from '@/services/products';
import { documentTypesService } from '@/services/documentTypes';
import { kycRatesService } from '@/services/kycRates';
import type { DocumentType, KYCRate } from '@/types/kycRates';
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

export function KYCRatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced filter state for the LIST section.
  const status = (searchParams.get('status') as StatusValue) || DEFAULT_STATUS;
  const sort = (searchParams.get('sort') as SortValue) || DEFAULT_SORT;
  const pageSizeRaw = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const pageSize: PageSize = isPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filterClient = searchParams.get('client') || 'all';
  const filterProduct = searchParams.get('product') || 'all';
  const filterDocType = searchParams.get('docType') || 'all';

  // Form state (inline create/edit — behavior preserved from prior tab).
  const [formClientId, setFormClientId] = useState<number | null>(null);
  const [formProductId, setFormProductId] = useState<number | null>(null);
  const [formDocTypeId, setFormDocTypeId] = useState<number | null>(null);
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<string>('INR');
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<KYCRate | null>(null);

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
  }, [debouncedSearchValue, status, sort, pageSize, filterClient, filterProduct, filterDocType]);

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
      documentTypeId: filterDocType === 'all' ? undefined : Number(filterDocType),
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
      filterDocType,
      sortConfig,
      page,
      pageSize,
    ]
  );

  const { data: ratesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['kyc-rates', listArgs],
    queryFn: () => kycRatesService.getKYCRates(listArgs),
  });

  const { data: statsResponse } = useQuery({
    queryKey: ['kyc-rates-stats'],
    queryFn: () => kycRatesService.getKYCRateStats(),
  });
  const stats = statsResponse?.data || {
    total: 0,
    active: 0,
    inactive: 0,
    recentlyAddedCount: 0,
    averageRate: 0,
  };

  // Filter-dropdown data: full client list + active products + active doc types.
  const { data: filterClientsResp, isLoading: clientsLoading } = useQuery({
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
  const { data: filterDocTypesResp } = useQuery({
    queryKey: ['document-types', 'filter-options'],
    queryFn: () => documentTypesService.getDocumentTypes({ isActive: 'true', limit: 500 }),
  });

  // Form-dropdown data (cascading from form's client/product).
  const { data: formProductsResp, isLoading: formProductsLoading } = useQuery({
    queryKey: ['client-products', formClientId],
    queryFn: () => productsService.getProductsByClient(String(formClientId || 0)),
    enabled: !!formClientId,
  });
  const { data: formDocTypesResp, isLoading: formDocTypesLoading } = useQuery({
    queryKey: ['client-product-document-types', formClientId, formProductId],
    queryFn: () =>
      documentTypesService.getDocumentTypesForClientProduct(
        formClientId ?? 0,
        formProductId ?? 0
      ) as Promise<{ success: boolean; data: DocumentType[] }>,
    enabled: !!(formClientId && formProductId),
  });

  const saveRateMutation = useMutationWithInvalidation({
    mutationFn: async (data: {
      clientId: number;
      productId: number;
      documentTypeId: number;
      amount: number;
      currency: string;
    }) => kycRatesService.createOrUpdateKYCRate(data),
    invalidateKeys: [['kyc-rates'], ['kyc-rates-stats'], ['rate-management-stats']],
    successMessage: editingRateId ? 'Rate updated successfully' : 'Rate created successfully',
    errorContext: 'KYC Rate Save',
    errorFallbackMessage: 'Failed to save rate',
    onSuccess: () => {
      resetForm();
    },
  });

  const deleteRateMutation = useMutationWithInvalidation({
    mutationFn: (rateId: number) => kycRatesService.deleteKYCRate(rateId),
    invalidateKeys: [['kyc-rates'], ['kyc-rates-stats'], ['rate-management-stats']],
    successMessage: 'Rate deleted successfully',
    errorContext: 'KYC Rate Deletion',
    errorFallbackMessage: 'Failed to delete rate',
  });

  const clients = filterClientsResp?.data || [];
  const filterProducts = filterProductsResp?.data || [];
  const filterDocTypes = filterDocTypesResp?.data || [];
  const formProducts = formProductsResp?.data || [];
  const formDocTypes = formDocTypesResp?.data || [];
  const rates = ratesData?.data || [];
  const total = ratesData?.pagination?.total ?? 0;
  const totalPages = ratesData?.pagination?.totalPages ?? 1;

  const resetForm = () => {
    setFormDocTypeId(null);
    setFormAmount('');
    setFormCurrency('INR');
    setEditingRateId(null);
  };

  const handleClientChange = (clientId: string) => {
    setFormClientId(Number(clientId));
    setFormProductId(null);
    resetForm();
  };

  const handleProductChange = (productId: string) => {
    setFormProductId(Number(productId));
    setFormDocTypeId(null);
  };

  const handleSaveRate = async () => {
    if (!formClientId || !formProductId || !formDocTypeId) {
      toast.error('Please select client, product, and document type');
      return;
    }
    const amountNum = parseFloat(formAmount);
    if (!formAmount || isNaN(amountNum) || amountNum < 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }
    await saveRateMutation.mutateAsync({
      clientId: formClientId,
      productId: formProductId,
      documentTypeId: formDocTypeId,
      amount: amountNum,
      currency: formCurrency,
    });
  };

  const handleEditRate = (rate: KYCRate) => {
    setFormClientId(rate.clientId);
    setFormProductId(rate.productId);
    setFormDocTypeId(rate.documentTypeId);
    setFormAmount(rate.amount.toString());
    setFormCurrency(rate.currency);
    setEditingRateId(rate.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDeleteRate = async () => {
    if (!rateToDelete) {
      return;
    }
    await deleteRateMutation.mutateAsync(rateToDelete.id);
    setRateToDelete(null);
  };

  const canSave = formClientId && formProductId && formDocTypeId && formAmount;

  const activeFilterCount =
    (status !== DEFAULT_STATUS ? 1 : 0) +
    (sort !== DEFAULT_SORT ? 1 : 0) +
    (filterClient !== 'all' ? 1 : 0) +
    (filterProduct !== 'all' ? 1 : 0) +
    (filterDocType !== 'all' ? 1 : 0);

  const handleClearFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['status', 'sort', 'client', 'product', 'docType'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true }
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await kycRatesService.exportKYCRates({
        search: listArgs.search,
        isActive: listArgs.isActive,
        clientId: listArgs.clientId,
        productId: listArgs.productId,
        documentTypeId: listArgs.documentTypeId,
        sortBy: listArgs.sortBy,
        sortOrder: listArgs.sortOrder,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kyc_rates_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      logger.error('KYC rates export failed', err);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label htmlFor="kyc-status">Status</Label>
        <Select value={status} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="kyc-status">
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
        <Label htmlFor="kyc-client">Client</Label>
        <Select value={filterClient} onValueChange={(v) => updateParam('client', v)}>
          <SelectTrigger id="kyc-client">
            <SelectValue />
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
        <Label htmlFor="kyc-product">Product</Label>
        <Select value={filterProduct} onValueChange={(v) => updateParam('product', v)}>
          <SelectTrigger id="kyc-product">
            <SelectValue />
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
        <Label htmlFor="kyc-doctype">Document Type</Label>
        <Select value={filterDocType} onValueChange={(v) => updateParam('docType', v)}>
          <SelectTrigger id="kyc-doctype">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doc types</SelectItem>
            {filterDocTypes.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="kyc-sort">Sort by</Label>
        <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
          <SelectTrigger id="kyc-sort">
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
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">KYC Rates</h1>
        <p className="text-sm text-muted-foreground">
          Configure pricing for KYC document verification per client and product.
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
            <p className="text-xs text-muted-foreground">All KYC rates</p>
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
            <IndianRupee className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Number(stats.averageRate || 0).toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Across active rates</p>
          </CardContent>
        </Card>
      </div>

      {/* Inline Create/Edit form (preserved from prior tab; behavior unchanged). */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingRateId ? 'Edit KYC Rate' : 'Add KYC Rate'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="form-client">Client *</Label>
              <Select
                value={formClientId ? String(formClientId) : ''}
                onValueChange={handleClientChange}
              >
                <SelectTrigger id="form-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clientsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading clients...
                    </SelectItem>
                  ) : clients.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No clients available
                    </SelectItem>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.name} ({client.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-product">Product *</Label>
              <Select
                value={formProductId ? String(formProductId) : ''}
                onValueChange={handleProductChange}
                disabled={!formClientId}
              >
                <SelectTrigger id="form-product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {formProductsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading products...
                    </SelectItem>
                  ) : formProducts.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No products available
                    </SelectItem>
                  ) : (
                    formProducts.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name} ({product.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-doctype">KYC Document Type *</Label>
              <Select
                value={formDocTypeId ? String(formDocTypeId) : ''}
                onValueChange={(v) => setFormDocTypeId(Number(v))}
                disabled={!formProductId}
              >
                <SelectTrigger id="form-doctype">
                  <SelectValue placeholder="Select a KYC document type" />
                </SelectTrigger>
                <SelectContent>
                  {formDocTypesLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading document types...
                    </SelectItem>
                  ) : formDocTypes.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No document types available
                    </SelectItem>
                  ) : (
                    formDocTypes.map((docType) => (
                      <SelectItem key={docType.id} value={String(docType.id)}>
                        {docType.name} {docType.category ? `[${docType.category}]` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="form-amount">Amount *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="form-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="pl-10"
                  disabled={!formDocTypeId}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-currency">Currency</Label>
              <Select value={formCurrency} onValueChange={setFormCurrency}>
                <SelectTrigger id="form-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveRate}
                  disabled={!canSave || saveRateMutation.isPending}
                  className="flex-1"
                >
                  {saveRateMutation.isPending
                    ? 'Saving…'
                    : editingRateId
                      ? 'Update Rate'
                      : 'Save Rate'}
                </Button>
                {editingRateId && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canonical list shell. */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={clearSearch}
            isSearchLoading={isDebouncing}
            searchPlaceholder="Search by client, product, or document type..."
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>KYC Document Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ratesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No KYC rates found
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.clientName}</TableCell>
                    <TableCell>{rate.productName}</TableCell>
                    <TableCell>{rate.documentTypeName}</TableCell>
                    <TableCell>
                      {rate.documentTypeCategory && (
                        <Badge variant="outline" className="text-xs">
                          {rate.documentTypeCategory}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rate.currency} {Number(rate.amount).toFixed(2)}
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
                          <DropdownMenuItem onClick={() => handleEditRate(rate)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setRateToDelete(rate)}
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

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {total > 0 ? `Showing ${rates.length} of ${total} KYC rates` : 'No KYC rates to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="kyc-page-size">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => updateParam('pageSize', v === '20' ? null : v)}
                >
                  <SelectTrigger id="kyc-page-size" className="w-20">
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

      <AlertDialog
        open={rateToDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleteRateMutation.isPending) {
            setRateToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KYC rate?</AlertDialogTitle>
            <AlertDialogDescription>
              {rateToDelete
                ? `${rateToDelete.clientName} · ${rateToDelete.productName} · ${rateToDelete.documentTypeName} · ${rateToDelete.currency} ${Number(rateToDelete.amount).toFixed(2)}`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleteRateMutation.isPending} onClick={confirmDeleteRate}>
              {deleteRateMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
