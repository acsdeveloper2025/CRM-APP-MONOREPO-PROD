import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldOff, ShieldAlert, Users, Activity, Download } from 'lucide-react';
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
import { UserSessionsTable } from '@/components/users/UserSessionsTable';
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

export function UserSessionsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const { hasPermissionCode } = usePermissionContext();
  const canManageRbac = hasPermissionCode('permission.manage') || hasPermissionCode('role.manage');

  const [searchParams, setSearchParams] = useSearchParams();
  const search = useUnifiedSearch({ syncWithUrl: true, urlParamName: 'q' });

  const status = (searchParams.get('status') || 'all') as 'all' | 'true' | 'false';
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
  }, [search.debouncedSearchValue, status, sort, dateFrom, dateTo, pageSize]);

  const sortOption = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];

  const activeFilterCount = [
    status !== 'all',
    sort !== 'createdAt_desc',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;
  const handleClearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'sort', 'dateFrom', 'dateTo'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const baseQuery = {
    search: search.debouncedSearchValue || undefined,
    isActive: status,
    createdFrom: dateFrom || undefined,
    createdTo: dateTo || undefined,
    sortOrder: sortOption.sortOrder,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['user-sessions', baseQuery, page, pageSize],
    queryFn: () => usersService.getUserSessions({ ...baseQuery, page, limit: pageSize }),
    enabled: canManageRbac,
  });

  const { data: statsData } = useQuery({
    queryKey: ['user-sessions-stats', baseQuery],
    queryFn: () => usersService.getUserSessionsStats(baseQuery),
    enabled: canManageRbac,
    staleTime: 30 * 1000,
  });

  const stats = statsData?.data || {
    total: 0,
    active: 0,
    expired: 0,
    revoked: 0,
    uniqueUsers: 0,
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await usersService.exportUserSessions(baseQuery);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_sessions_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export sessions:', error);
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Sessions</h1>
          <p className="text-muted-foreground">Refresh-token sessions across all devices</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently valid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <ShieldOff className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">Past expiry</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revoked</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.revoked}</div>
            <p className="text-xs text-muted-foreground">Explicitly revoked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Distinct users</p>
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
            searchPlaceholder="Filter sessions by user, username, or IP..."
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
                  <Label>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => updateParam('status', v === 'all' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Expired or revoked</SelectItem>
                    </SelectContent>
                  </Select>
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

          <UserSessionsTable
            data={Array.isArray(data?.data) ? data.data : []}
            isLoading={isLoading}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {total > 0
                ? `Showing ${data?.data?.length || 0} of ${total} sessions`
                : 'No sessions to show'}
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
