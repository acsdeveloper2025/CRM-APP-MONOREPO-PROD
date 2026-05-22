import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Edit,
  Plus,
  Download,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { locationsService } from '@/services/locations';
import { serviceZoneRulesService } from '@/services/serviceZoneRules';
import { verificationTypesService } from '@/services/verificationTypes';
import { rateTypeAssignmentsService } from '@/services/rateTypeAssignments';
import { rateTypesService } from '@/services/rateTypes';
import type { ServiceZoneRule } from '@/types/rateManagement';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';
import { logger } from '@/utils/logger';

type SortValue = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'updated_desc';
type StatusValue = 'all' | 'true' | 'false';

const SORT_OPTIONS: Array<{
  value: SortValue;
  label: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}> = [
  { value: 'name_asc', label: 'Client A → Z', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Client Z → A', sortBy: 'name', sortOrder: 'desc' },
  { value: 'created_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'created_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'updated_desc', label: 'Recently updated', sortBy: 'updatedAt', sortOrder: 'desc' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 20;
const DEFAULT_SORT: SortValue = 'name_asc';
const DEFAULT_STATUS: StatusValue = 'all';

const isPageSize = (n: number): n is PageSize =>
  (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);

interface RuleFormState {
  clientId: string;
  productId: string;
  verificationTypeId: string;
  pincodeId: string;
  areaId: string;
  rateTypeId: string;
}

const EMPTY_FORM: RuleFormState = {
  clientId: '',
  productId: '',
  verificationTypeId: '',
  pincodeId: '',
  areaId: '',
  rateTypeId: '',
};

export function ServiceZoneRulesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced filter state for the LIST section.
  const status = (searchParams.get('status') as StatusValue) || DEFAULT_STATUS;
  const sort = (searchParams.get('sort') as SortValue) || DEFAULT_SORT;
  const pageSizeRaw = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const pageSize: PageSize = isPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filterClient = searchParams.get('client') || 'all';
  const filterProduct = searchParams.get('product') || 'all';
  const filterVT = searchParams.get('vt') || 'all';
  const filterRateType = searchParams.get('rateType') || 'all';

  // Form state (inline create/edit, unchanged behavior from prior tab).
  const [editingRule, setEditingRule] = useState<ServiceZoneRule | null>(null);
  const [formState, setFormState] = useState<RuleFormState>(EMPTY_FORM);
  const [pincodeSearchQuery, setPincodeSearchQuery] = useState('');
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

  // List query args (for the table section).
  const listArgs = useMemo(
    () => ({
      search: debouncedSearchValue || undefined,
      isActive: status === 'all' ? ('all' as const) : (status as 'true' | 'false'),
      clientId: filterClient === 'all' ? undefined : Number(filterClient),
      productId: filterProduct === 'all' ? undefined : Number(filterProduct),
      verificationTypeId: filterVT === 'all' ? undefined : Number(filterVT),
      rateTypeId: filterRateType === 'all' ? undefined : Number(filterRateType),
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
      sortConfig,
      page,
      pageSize,
    ]
  );

  const { data: rulesResponse, isLoading: loadingRules } = useQuery({
    queryKey: ['service-zone-rules', listArgs],
    queryFn: () => serviceZoneRulesService.listRules(listArgs),
  });

  const { data: statsResponse } = useQuery({
    queryKey: ['service-zone-rules-stats'],
    queryFn: () => serviceZoneRulesService.getStats(),
  });
  const stats = statsResponse?.data || {
    total: 0,
    active: 0,
    inactive: 0,
    recentlyAddedCount: 0,
    pincodesCoveredCount: 0,
  };

  // Filter-dropdown data: active clients/products/VTs/rateTypes (independent — not cascading).
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

  // Form-dropdown data (cascading — depends on form's clientId/productId/VT).
  const { data: clientsResponse } = useQuery({
    queryKey: ['clients', 'service-zone-rules'],
    queryFn: () => clientsService.getClients({ limit: 100 }),
  });
  const { data: productsResponse } = useQuery({
    queryKey: ['service-zone-products', formState.clientId],
    queryFn: () => productsService.getProductsByClient(formState.clientId),
    enabled: Boolean(formState.clientId),
  });
  const { data: vtsResponse } = useQuery({
    queryKey: ['service-zone-vts', formState.clientId, formState.productId],
    queryFn: () =>
      verificationTypesService.getVerificationTypesForClientProduct(
        formState.clientId,
        formState.productId
      ),
    enabled: Boolean(formState.clientId && formState.productId),
  });
  const { data: pincodesResponse } = useQuery({
    queryKey: ['service-zone-pincodes', pincodeSearchQuery],
    queryFn: () =>
      locationsService.getPincodes({ search: pincodeSearchQuery || undefined, limit: 30 }),
  });
  const { data: areasResponse } = useQuery({
    queryKey: ['service-zone-areas', formState.pincodeId],
    queryFn: () => locationsService.getAreasByPincode(Number(formState.pincodeId)),
    enabled: Boolean(formState.pincodeId),
  });
  const { data: rateTypeAssignmentsResponse } = useQuery({
    queryKey: [
      'service-zone-rate-types',
      formState.clientId,
      formState.productId,
      formState.verificationTypeId,
    ],
    queryFn: () =>
      rateTypeAssignmentsService.getAssignmentsByCombination({
        clientId: Number(formState.clientId),
        productId: Number(formState.productId),
        verificationTypeId: Number(formState.verificationTypeId),
      }),
    enabled: Boolean(formState.clientId && formState.productId && formState.verificationTypeId),
  });

  const createRuleMutation = useMutationWithInvalidation({
    mutationFn: () =>
      serviceZoneRulesService.createRule({
        clientId: Number(formState.clientId),
        productId: Number(formState.productId),
        verificationTypeId: Number(formState.verificationTypeId),
        pincodeId: Number(formState.pincodeId),
        areaId: Number(formState.areaId),
        rateTypeId: Number(formState.rateTypeId),
      }),
    invalidateKeys: [['service-zone-rules'], ['service-zone-rules-stats']],
    successMessage: 'Rate type rule saved successfully',
    errorContext: 'Rate Type Rules',
    errorFallbackMessage: 'Failed to save rate type rule',
    onSuccess: () => {
      setFormState(EMPTY_FORM);
      setEditingRule(null);
    },
  });

  const updateRuleMutation = useMutationWithInvalidation({
    mutationFn: () => {
      if (!editingRule) {
        throw new Error('No rate type rule selected for update');
      }
      return serviceZoneRulesService.updateRule(editingRule.id, {
        clientId: Number(formState.clientId),
        productId: Number(formState.productId),
        verificationTypeId: Number(formState.verificationTypeId),
        pincodeId: Number(formState.pincodeId),
        areaId: Number(formState.areaId),
        rateTypeId: Number(formState.rateTypeId),
      });
    },
    invalidateKeys: [['service-zone-rules'], ['service-zone-rules-stats']],
    successMessage: 'Service zone rule updated successfully',
    errorContext: 'Rate Type Rules',
    errorFallbackMessage: 'Failed to update rate type rule',
    onSuccess: () => {
      setFormState(EMPTY_FORM);
      setEditingRule(null);
    },
  });

  const toggleRuleMutation = useMutationWithInvalidation({
    mutationFn: (rule: ServiceZoneRule) =>
      rule.isActive
        ? serviceZoneRulesService.deactivateRule(rule.id)
        : serviceZoneRulesService.activateRule(rule.id),
    invalidateKeys: [['service-zone-rules'], ['service-zone-rules-stats']],
    successMessage: 'Service zone rule status updated',
    errorContext: 'Rate Type Rules',
    errorFallbackMessage: 'Failed to update rate type rule status',
  });

  const clients = useMemo(() => clientsResponse?.data || [], [clientsResponse?.data]);
  const products = useMemo(() => productsResponse?.data || [], [productsResponse?.data]);
  const verificationTypes = useMemo(() => vtsResponse?.data || [], [vtsResponse?.data]);
  const pincodes = useMemo(() => pincodesResponse?.data || [], [pincodesResponse?.data]);
  const areas = useMemo(() => areasResponse?.data || [], [areasResponse?.data]);
  const rateTypes = useMemo(
    () =>
      (rateTypeAssignmentsResponse?.data || [])
        .filter((rta) => rta.isAssigned && rta.assignmentActive)
        .map((rta) => ({ id: rta.rateTypeId, name: rta.rateTypeName })),
    [rateTypeAssignmentsResponse?.data]
  );
  const rules = rulesResponse?.data || [];
  const total = rulesResponse?.pagination?.total ?? 0;
  const totalPages = rulesResponse?.pagination?.totalPages ?? 1;

  const filterClientOptions = filterClientsResp?.data || [];
  const filterProductOptions = filterProductsResp?.data || [];
  const filterVTOptions = filterVTsResp?.data || [];
  const filterRateTypeOptions = filterRateTypesResp?.data || [];

  useEffect(() => {
    if (!formState.pincodeId) {
      if (formState.areaId) {
        setFormState((prev) => ({ ...prev, areaId: '' }));
      }
      return;
    }
    if (areas.length === 1 && formState.areaId !== String(areas[0].id)) {
      setFormState((prev) => ({ ...prev, areaId: String(areas[0].id) }));
    }
    if (formState.areaId && !areas.some((area) => String(area.id) === formState.areaId)) {
      setFormState((prev) => ({ ...prev, areaId: '' }));
    }
  }, [areas, formState.areaId, formState.pincodeId]);

  const canSubmit =
    formState.clientId &&
    formState.productId &&
    formState.verificationTypeId &&
    formState.pincodeId &&
    formState.areaId &&
    formState.rateTypeId;

  const handleEdit = (rule: ServiceZoneRule) => {
    setEditingRule(rule);
    setFormState({
      clientId: String(rule.clientId),
      productId: String(rule.productId),
      verificationTypeId: String(rule.verificationTypeId),
      pincodeId: String(rule.pincodeId),
      areaId: String(rule.areaId),
      rateTypeId: String(rule.rateTypeId),
    });
    // Scroll up so the form is visible (parent page scrolls).
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormChange = (field: keyof RuleFormState, value: string) => {
    setFormState((prev) => {
      if (field === 'clientId') {
        return { ...prev, clientId: value, productId: '', verificationTypeId: '', rateTypeId: '' };
      }
      if (field === 'productId') {
        return { ...prev, productId: value, verificationTypeId: '', rateTypeId: '' };
      }
      if (field === 'verificationTypeId') {
        return { ...prev, verificationTypeId: value, rateTypeId: '' };
      }
      if (field === 'pincodeId') {
        return { ...prev, pincodeId: value, areaId: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    if (editingRule) {
      updateRuleMutation.mutate();
    } else {
      createRuleMutation.mutate();
    }
  };

  const activeFilterCount =
    (status !== DEFAULT_STATUS ? 1 : 0) +
    (sort !== DEFAULT_SORT ? 1 : 0) +
    (filterClient !== 'all' ? 1 : 0) +
    (filterProduct !== 'all' ? 1 : 0) +
    (filterVT !== 'all' ? 1 : 0) +
    (filterRateType !== 'all' ? 1 : 0);

  const handleClearFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['status', 'sort', 'client', 'product', 'vt', 'rateType'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true }
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await serviceZoneRulesService.exportRules({
        search: listArgs.search,
        isActive: listArgs.isActive,
        clientId: listArgs.clientId,
        productId: listArgs.productId,
        verificationTypeId: listArgs.verificationTypeId,
        rateTypeId: listArgs.rateTypeId,
        sortBy: listArgs.sortBy,
        sortOrder: listArgs.sortOrder,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service_zone_rules_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      logger.error('SZR export failed', err);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label htmlFor="szr-status">Status</Label>
        <Select value={status} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="szr-status">
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
        <Label htmlFor="szr-client">Client</Label>
        <Select value={filterClient} onValueChange={(v) => updateParam('client', v)}>
          <SelectTrigger id="szr-client">
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
        <Label htmlFor="szr-product">Product</Label>
        <Select value={filterProduct} onValueChange={(v) => updateParam('product', v)}>
          <SelectTrigger id="szr-product">
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
        <Label htmlFor="szr-vt">Verification Type</Label>
        <Select value={filterVT} onValueChange={(v) => updateParam('vt', v)}>
          <SelectTrigger id="szr-vt">
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
        <Label htmlFor="szr-rt">Rate Type</Label>
        <Select value={filterRateType} onValueChange={(v) => updateParam('rateType', v)}>
          <SelectTrigger id="szr-rt">
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
        <Label htmlFor="szr-sort">Sort by</Label>
        <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
          <SelectTrigger id="szr-sort">
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Service Zone Rules</h1>
        <p className="text-sm text-muted-foreground">
          Map client, product, verification type, pincode, and area combinations to a rate type
          before pricing is applied.
        </p>
      </div>

      {/* 5-card stats grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All rules</p>
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
            <p className="text-xs text-muted-foreground">Disabled rules</p>
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
            <CardTitle className="text-sm font-medium">Pincodes Covered</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pincodesCoveredCount}</div>
            <p className="text-xs text-muted-foreground">Distinct active pincodes</p>
          </CardContent>
        </Card>
      </div>

      {/* Inline Create/Edit form (preserved from prior tab, behavior unchanged). */}
      <Card>
        <CardHeader>
          <CardTitle>{editingRule ? 'Edit Rate Type Rule' : 'Create Rate Type Rule'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                value={formState.clientId}
                onValueChange={(value) => handleFormChange('clientId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product *</Label>
              <Select
                value={formState.productId}
                onValueChange={(value) => handleFormChange('productId', value)}
                disabled={!formState.clientId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={formState.clientId ? 'Select product' : 'Select client first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Verification Type *</Label>
              <Select
                value={formState.verificationTypeId}
                onValueChange={(value) => handleFormChange('verificationTypeId', value)}
                disabled={!formState.productId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      formState.productId ? 'Select verification type' : 'Select product first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {verificationTypes.map((vt) => (
                    <SelectItem key={vt.id} value={String(vt.id)}>
                      {vt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pincode *</Label>
              <Select
                value={formState.pincodeId}
                onValueChange={(value) => handleFormChange('pincodeId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pincode" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input
                      placeholder="Search pincode..."
                      value={pincodeSearchQuery}
                      onChange={(e) => setPincodeSearchQuery(e.target.value)}
                      className="h-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {pincodes.map((pincode) => (
                    <SelectItem key={pincode.id} value={String(pincode.id)}>
                      {pincode.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Area *</Label>
              <Select
                value={formState.areaId}
                onValueChange={(value) => handleFormChange('areaId', value)}
                disabled={!formState.pincodeId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={formState.pincodeId ? 'Select area' : 'Select pincode first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={String(area.id)}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rate Type *</Label>
              <Select
                value={formState.rateTypeId}
                onValueChange={(value) => handleFormChange('rateTypeId', value)}
                disabled={!formState.verificationTypeId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !formState.verificationTypeId
                        ? 'Select verification type first'
                        : rateTypes.length === 0
                          ? 'No rate types assigned for this combination'
                          : 'Select rate type'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {rateTypes.map((rt) => (
                    <SelectItem key={rt.id} value={String(rt.id)}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!!(createRuleMutation.error || updateRuleMutation.error) && (
            <Alert variant="destructive">
              <AlertDescription>
                {(createRuleMutation.error as Error | undefined)?.message ||
                  (updateRuleMutation.error as Error | undefined)?.message ||
                  'Unable to save rate type rule'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || createRuleMutation.isPending || updateRuleMutation.isPending}
            >
              {editingRule ? (
                <>
                  <Edit className="h-4 w-4 mr-2" /> Update Rule
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" /> Create Rule
                </>
              )}
            </Button>
            {editingRule && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingRule(null);
                  setFormState(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Canonical list shell: filter bar + table + pagination. */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={clearSearch}
            isSearchLoading={isDebouncing}
            searchPlaceholder="Search by client, product, pincode, area or rate type..."
            filterContent={filterContent}
            hasActiveFilters={activeFilterCount > 0}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            actions={
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting || loadingRules}
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
                <TableHead>Verification Type</TableHead>
                <TableHead>Pincode</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRules ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No rate type rules found
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.clientName}</TableCell>
                    <TableCell>{rule.productName}</TableCell>
                    <TableCell>{rule.verificationTypeCode || rule.verificationTypeName}</TableCell>
                    <TableCell>{rule.pincodeCode}</TableCell>
                    <TableCell>{rule.areaName}</TableCell>
                    <TableCell>{rule.rateTypeName}</TableCell>
                    <TableCell>
                      {rule.isActive ? (
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
                          <DropdownMenuItem onClick={() => handleEdit(rule)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleRuleMutation.mutate(rule)}
                            disabled={toggleRuleMutation.isPending}
                          >
                            {rule.isActive ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="text-muted-foreground">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete (use Deactivate)
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
              {total > 0 ? `Showing ${rules.length} of ${total} rules` : 'No rules to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="szr-page-size">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => updateParam('pageSize', v === '20' ? null : v)}
                >
                  <SelectTrigger id="szr-page-size" className="w-20">
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
    </div>
  );
}
