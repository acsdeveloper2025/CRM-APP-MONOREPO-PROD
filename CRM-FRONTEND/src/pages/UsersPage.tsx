import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@/types/auth';
import { USER_ROLE_OPTIONS } from '@/types/constants';
import { Plus, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usersService } from '@/services/users';
import { UsersTable } from '@/components/users/UsersTable';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { BulkImportUsersDialog } from '@/components/users/BulkImportUsersDialog';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
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

interface UserFilters extends Record<string, unknown> {
  role?: Role;
  status?: string;
  consentStatus?: 'accepted' | 'pending';
}

export function UsersPage() {
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const { hasPermissionCode } = usePermissionContext();
  const canViewUsersData = hasPermissionCode('user.view');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const search = useUnifiedSearch({ syncWithUrl: true, urlParamName: 'search' });
  const filters = useUnifiedFilters<UserFilters>({ syncWithUrl: true });

  useEffect(() => {
    setPage(1);
  }, [search.debouncedSearchValue, filters.filters]);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: [
      'users',
      search.debouncedSearchValue,
      filters.filters.role,
      filters.filters.status,
      page,
      pageSize,
    ],
    queryFn: () =>
      usersService.getUsers({
        search: search.debouncedSearchValue || undefined,
        role: filters.filters.role || undefined,
        isActive:
          filters.filters.status === 'active'
            ? true
            : filters.filters.status === 'inactive'
              ? false
              : undefined,
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
    try {
      const blob = await usersService.exportUsers({}, 'EXCEL');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export users:', error);
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
    newUsersThisMonth: 0,
    usersByRole: [],
    usersByDepartment: [],
    recentLogins: [],
  };

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
        <CardHeader>
          <CardTitle>User Management System</CardTitle>
          <CardDescription>Comprehensive user administration and access control</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={search.searchValue}
            onSearchChange={search.setSearchValue}
            onSearchClear={search.clearSearch}
            isSearchLoading={search.isDebouncing}
            searchPlaceholder="Search users by name, email, or phone..."
            hasActiveFilters={filters.hasActiveFilters}
            activeFilterCount={Object.keys(filters.filters).length}
            onClearFilters={filters.clearFilters}
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportUsers}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
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
                    value={filters.filters.role || 'all'}
                    onValueChange={(value) =>
                      filters.setFilter('role', value === 'all' ? undefined : (value as Role))
                    }
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
                    value={filters.filters.status || 'all'}
                    onValueChange={(value) =>
                      filters.setFilter('status', value === 'all' ? undefined : value)
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
                    value={filters.filters.consentStatus || 'all'}
                    onValueChange={(value) =>
                      filters.setFilter(
                        'consentStatus',
                        value === 'all' ? undefined : (value as 'accepted' | 'pending')
                      )
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
              </FilterGrid>
            }
          />

          <UsersTable
            data={Array.isArray(usersData?.data) ? usersData.data : []}
            isLoading={usersLoading}
          />

          {usersData?.pagination && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {usersData.data?.length || 0} of {usersData.pagination.total} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {page} of {usersData.pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={page >= (usersData.pagination.totalPages || 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={showCreateUser} onOpenChange={setShowCreateUser} />
      <BulkImportUsersDialog open={showBulkImport} onOpenChange={setShowBulkImport} />
    </div>
  );
}
