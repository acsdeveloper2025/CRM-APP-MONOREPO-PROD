import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Briefcase,
  CheckCircle,
  XCircle,
  Calendar,
  Download,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { designationsService } from '@/services/designations';
import { departmentsService } from '@/services/departments';
import { DesignationsTable } from '@/components/designations/DesignationsTable';
import { CreateDesignationDialog } from '@/components/designations/CreateDesignationDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';
import { logger } from '@/utils/logger';

type SortValue = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'updated_desc';
type StatusValue = 'all' | 'true' | 'false';
const ALL_DEPARTMENTS = '__all__';

const SORT_OPTIONS: Array<{
  value: SortValue;
  label: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}> = [
  { value: 'name_asc', label: 'Name A → Z', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Name Z → A', sortBy: 'name', sortOrder: 'desc' },
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

export function DesignationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') as StatusValue) || DEFAULT_STATUS;
  const sort = (searchParams.get('sort') as SortValue) || DEFAULT_SORT;
  const departmentId = searchParams.get('departmentId') || '';
  const pageSizeRaw = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const pageSize: PageSize = isPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const [showCreate, setShowCreate] = useState(false);
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
  }, [debouncedSearchValue, status, sort, pageSize, dateFrom, dateTo, departmentId]);

  const updateParam = (key: string, value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === '' || value === 'all' || value === ALL_DEPARTMENTS) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  };

  const queryArgs = useMemo(
    () => ({
      search: debouncedSearchValue || undefined,
      isActive: status === 'all' ? undefined : (status as 'true' | 'false'),
      departmentId: departmentId ? Number(departmentId) : undefined,
      createdFrom: dateFrom || undefined,
      createdTo: dateTo || undefined,
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
      page,
      limit: pageSize,
    }),
    [debouncedSearchValue, status, departmentId, dateFrom, dateTo, sortConfig, page, pageSize]
  );

  const { data: listData, isLoading } = useQuery({
    queryKey: ['designations', queryArgs],
    queryFn: () => designationsService.getDesignations(queryArgs),
  });

  const { data: statsData } = useQuery({
    queryKey: ['designation-stats'],
    queryFn: () => designationsService.getDesignationStats(),
  });
  const stats = statsData?.data || {
    total: 0,
    active: 0,
    inactive: 0,
    recentlyAddedCount: 0,
    withoutDepartmentCount: 0,
  };

  // Department dropdown for filter.
  const { data: departmentsRes } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
  });
  const departments = Array.isArray(departmentsRes?.data) ? departmentsRes.data : [];

  const totalPages = listData?.pagination?.totalPages ?? 1;
  const total = listData?.pagination?.total ?? 0;

  const activeFilterCount =
    (status !== DEFAULT_STATUS ? 1 : 0) +
    (sort !== DEFAULT_SORT ? 1 : 0) +
    (departmentId ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const handleClearFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('status');
        next.delete('sort');
        next.delete('departmentId');
        next.delete('dateFrom');
        next.delete('dateTo');
        return next;
      },
      { replace: true }
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await designationsService.exportDesignations({
        search: queryArgs.search,
        isActive: queryArgs.isActive,
        departmentId: queryArgs.departmentId,
        createdFrom: queryArgs.createdFrom,
        createdTo: queryArgs.createdTo,
        sortBy: queryArgs.sortBy,
        sortOrder: queryArgs.sortOrder,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `designations_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      logger.error('Designations export failed', err);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label htmlFor="desig-status-filter">Status</Label>
        <Select value={status} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="desig-status-filter">
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
        <Label htmlFor="desig-department-filter">Department</Label>
        <Select
          value={departmentId || ALL_DEPARTMENTS}
          onValueChange={(v) => updateParam('departmentId', v)}
        >
          <SelectTrigger id="desig-department-filter">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="desig-sort">Sort by</Label>
        <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
          <SelectTrigger id="desig-sort">
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
        <Label htmlFor="desig-date-from">Date From</Label>
        <Input
          id="desig-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
          placeholder="(YYYY-MM-DD)"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="desig-date-to">Date To</Label>
        <Input
          id="desig-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => updateParam('dateTo', e.target.value)}
          placeholder="(YYYY-MM-DD)"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Designations</h1>
          <p className="text-sm text-muted-foreground">
            Manage job titles (designations) assigned to users.
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Designations</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All designations</p>
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
            <p className="text-xs text-muted-foreground">Disabled designations</p>
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
            <CardTitle className="text-sm font-medium">Without Department</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withoutDepartmentCount}</div>
            <p className="text-xs text-muted-foreground">Orphan designations</p>
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
            searchPlaceholder="Search designations by name or description..."
            filterContent={filterContent}
            hasActiveFilters={activeFilterCount > 0}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting || isLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Designation
                </Button>
              </div>
            }
          />

          <DesignationsTable data={listData?.data || []} isLoading={isLoading} />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {total > 0
                ? `Showing ${listData?.data?.length || 0} of ${total} designations`
                : 'No designations to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="desig-page-size" className="text-sm text-muted-foreground">
                  Rows
                </Label>
                <Select value={String(pageSize)} onValueChange={(v) => updateParam('pageSize', v)}>
                  <SelectTrigger id="desig-page-size" className="w-[80px] h-8">
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
                onClick={() => updateParam('page', String(Math.max(1, page - 1)))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="text-sm">
                Page {page} of {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateParam('page', String(page + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateDesignationDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
