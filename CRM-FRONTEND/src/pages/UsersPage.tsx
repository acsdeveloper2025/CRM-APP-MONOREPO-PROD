import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Role } from '@/types/auth';
import { USER_ROLE_OPTIONS } from '@/types/constants';
import { Plus, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usersService } from '@/services/users';
import { UsersTable } from '@/components/users/UsersTable';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { BulkImportUsersDialog } from '@/components/users/BulkImportUsersDialog';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
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
import { LoadingState } from '@/components/ui/loading';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { logger } from '@/utils/logger';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

type SortOption = 'name_asc' | 'name_desc' | 'createdAt_desc' | 'createdAt_asc' | 'updatedAt_desc';

const SORT_OPTIONS: {
  value: SortOption;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}[] = [
  { value: 'name_asc', label: 'Name A → Z', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Name Z → A', sortBy: 'name', sortOrder: 'desc' },
  { value: 'createdAt_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'createdAt_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'updatedAt_desc', label: 'Recently updated', sortBy: 'updatedAt', sortOrder: 'desc' },
];

export function UsersPage() {
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { hasPermissionCode } = usePermissionContext();
  const canViewUsersData = hasPermissionCode('user.view');

  const [searchParams, setSearchParams] = useSearchParams();

  const search = useUnifiedSearch({ syncWithUrl: true, urlParamName: 'q' });

  const role = (searchParams.get('role') || 'all') as Role | 'all';
  const status = searchParams.get('status') || 'all';
  const consentStatus = (searchParams.get('consent') || 'all') as 'all' | 'accepted' | 'pending';
  const sort = (searchParams.get('sort') || 'name_asc') as SortOption;
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

  // Reset to page 1 on any filter/sort/pageSize change.
  useEffect(() => {
    if (page !== 1) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.debouncedSearchValue, role, status, consentStatus, sort, dateFrom, dateTo, pageSize]);

  const sortOption = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];

  const activeFilterCount = [
    role !== 'all',
    status !== 'all',
    consentStatus !== 'all',
    sort !== 'name_asc',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const handleClearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['role', 'status', 'consent', 'sort', 'dateFrom', 'dateTo'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: [
      'users',
      search.debouncedSearchValue,
      role,
      status,
      consentStatus,
      sort,
      dateFrom,
      dateTo,
      page,
      pageSize,
    ],
    queryFn: () =>
      usersService.getUsers({
        search: search.debouncedSearchValue || undefined,
        role: role === 'all' ? undefined : (role as Role),
        isActive: status === 'all' ? 'all' : (status as 'true' | 'false'),
        consentStatus: consentStatus === 'all' ? undefined : consentStatus,
        sortBy: sortOption.sortBy as 'name' | 'createdAt' | 'updatedAt',
        sortOrder: sortOption.sortOrder,
        createdFrom: dateFrom || undefined,
        createdTo: dateTo || undefined,
        page,
        limit: pageSize,
      }),
  });

  const { data: userStatsData } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => usersService.getUserStats(),
    enabled: canViewUsersData,
    staleTime: 30 * 1000,
  });

  const handleExportUsers = async () => {
    setIsExporting(true);
    try {
      const blob = await usersService.exportUsers({
        search: search.debouncedSearchValue || undefined,
        role: role === 'all' ? undefined : (role as Role),
        isActive: status === 'all' ? 'all' : (status as 'true' | 'false'),
        consentStatus: consentStatus === 'all' ? undefined : consentStatus,
        sortBy: sortOption.sortBy as 'name' | 'createdAt' | 'updatedAt',
        sortOrder: sortOption.sortOrder,
        createdFrom: dateFrom || undefined,
        createdTo: dateTo || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export users:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (usersLoading && !usersData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState message="Fetching user data..." size="lg" />
      </div>
    );
  }

  const usersStats = (
    usersData as { statistics?: { total: number; active: number; inactive: number } }
  )?.statistics || { total: 0, active: 0, inactive: 0 };

  const resolvedUserStats = userStatsData?.data || {
    totalUsers: Number(usersStats.total || 0),
    activeUsers: Number(usersStats.active || 0),
    inactiveUsers: Number(usersStats.inactive || 0),
    recentlyAddedCount: 0,
    mfaEnabledCount: 0,
    newUsersThisMonth: 0,
    usersByRole: [],
    usersByDepartment: [],
    recentLogins: [],
  };

  const total = usersData?.pagination?.total ?? 0;
  const totalPages = usersData?.pagination?.totalPages ?? 1;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage users, roles, permissions, and access control
          </p>
        </div>
      </div>

      {canViewUsersData && <UserStatsCards stats={resolvedUserStats} />}

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={search.searchValue}
            onSearchChange={search.setSearchValue}
            onSearchClear={search.clearSearch}
            isSearchLoading={search.isDebouncing}
            searchPlaceholder="Search users by name, email, or phone..."
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportUsers}
                  disabled={isExporting || usersLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting…' : 'Export'}
                </Button>
                <Button size="sm" onClick={() => setShowCreateUser(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            }
            filterContent={
              <FilterGrid columns={3}>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => updateParam('role', value === 'all' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {USER_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) =>
                      updateParam(
                        'status',
                        value === 'all' ? null : value === 'active' ? 'active' : 'inactive'
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Consent</Label>
                  <Select
                    value={consentStatus}
                    onValueChange={(value) =>
                      updateParam('consent', value === 'all' ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="accepted">Acknowledgement accepted</SelectItem>
                      <SelectItem value="pending">Pending acceptance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sort by</Label>
                  <Select
                    value={sort}
                    onValueChange={(value) =>
                      updateParam('sort', value === 'name_asc' ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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

          <UsersTable
            data={Array.isArray(usersData?.data) ? usersData.data : []}
            isLoading={usersLoading}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              {total > 0
                ? `Showing ${usersData?.data?.length || 0} of ${total} users`
                : 'No users to show'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="pageSize">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => updateParam('pageSize', value === '20' ? null : value)}
                >
                  <SelectTrigger id="pageSize" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
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

      <CreateUserDialog open={showCreateUser} onOpenChange={setShowCreateUser} />
      <BulkImportUsersDialog open={showBulkImport} onOpenChange={setShowBulkImport} />
    </div>
  );
}
