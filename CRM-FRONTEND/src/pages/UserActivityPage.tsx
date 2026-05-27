import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  CalendarRange,
  CalendarDays,
  Calendar as CalendarIcon,
  Users,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserActivitiesTable } from '@/components/users/UserActivitiesTable';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { usersService } from '@/services/users';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { logger } from '@/utils/logger';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

type SortOption = 'createdAt_desc' | 'createdAt_asc';
const SORT_OPTIONS: { value: SortOption; label: string; sortOrder: 'asc' | 'desc' }[] = [
  { value: 'createdAt_desc', label: 'Newest first', sortOrder: 'desc' },
  { value: 'createdAt_asc', label: 'Oldest first', sortOrder: 'asc' },
];

export function UserActivityPage() {
  const [isExporting, setIsExporting] = useState(false);
  const { hasPermissionCode } = usePermissionContext();
  const canManageRbac = hasPermissionCode('permission.manage') || hasPermissionCode('role.manage');

  const [searchParams, setSearchParams] = useSearchParams();
  const search = useUnifiedSearch({ syncWithUrl: true, urlParamName: 'q' });

  const action = searchParams.get('action') || '';
  const sort = (searchParams.get('sort') || 'createdAt_desc') as SortOption;
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const pageSize = Number(searchParams.get('pageSize') || 20);
  const page = Number(searchParams.get('page') || 1);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '' || value === 'all') {
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
  }, [search.debouncedSearchValue, action, sort, dateFrom, dateTo, pageSize]);

  const sortOption = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];

  const activeFilterCount = [!!action, sort !== 'createdAt_desc', !!dateFrom, !!dateTo].filter(
    Boolean
  ).length;
  const hasActiveFilters = activeFilterCount > 0;
  const handleClearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['action', 'sort', 'dateFrom', 'dateTo'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const baseQuery = {
    search: search.debouncedSearchValue || undefined,
    action: action || undefined,
    createdFrom: dateFrom || undefined,
    createdTo: dateTo || undefined,
    sortOrder: sortOption.sortOrder,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['user-activities', baseQuery, page, pageSize],
    queryFn: () => usersService.getUserActivities({ ...baseQuery, page, limit: pageSize }),
    enabled: canManageRbac,
  });

  const { data: statsData } = useQuery({
    queryKey: ['user-activities-stats', baseQuery],
    queryFn: () => usersService.getUserActivitiesStats(baseQuery),
    enabled: canManageRbac,
    staleTime: 30 * 1000,
  });

  const stats = statsData?.data || {
    total: 0,
    today: 0,
    last7Days: 0,
    last30Days: 0,
    uniqueUsers: 0,
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await usersService.exportUserActivities(baseQuery);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_activity_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export activities:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Activity</h1>
          <p className="text-muted-foreground">Audit trail of user actions across the system</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All audit events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <CalendarIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">Since midnight</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
            <CalendarRange className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last7Days}</div>
            <p className="text-xs text-muted-foreground">Rolling week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
            <CalendarDays className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last30Days}</div>
            <p className="text-xs text-muted-foreground">Rolling month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Distinct actors</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={search.searchValue}
            onSearchChange={search.setSearchValue}
            onSearchClear={search.clearSearch}
            isSearchLoading={search.isDebouncing}
            searchPlaceholder="Search by action or details..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting…' : 'Export'}
              </Button>
            }
            filterContent={
              <FilterGrid columns={4}>
                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <Input
                    id="action"
                    placeholder="e.g. USER_LOGIN"
                    value={action}
                    onChange={(e) => updateParam('action', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sort by</Label>
                  <Select
                    value={sort}
                    onValueChange={(v) => updateParam('sort', v === 'createdAt_desc' ? null : v)}
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">Date From</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    placeholder="(YYYY-MM-DD)"
                    value={dateFrom}
                    onChange={(e) => updateParam('dateFrom', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">Date To</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    placeholder="(YYYY-MM-DD)"
                    value={dateTo}
                    onChange={(e) => updateParam('dateTo', e.target.value || null)}
                  />
                </div>
              </FilterGrid>
            }
          />

          <UserActivitiesTable
            data={Array.isArray(data?.data) ? data.data : []}
            isLoading={isLoading}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {total > 0
                ? `Showing ${data?.data?.length || 0} of ${total} activities`
                : 'No activities to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="pageSize">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => updateParam('pageSize', v === '20' ? null : v)}
                >
                  <SelectTrigger id="pageSize" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateParam('page', page <= 2 ? null : String(page - 1))}
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
    </div>
  );
}
