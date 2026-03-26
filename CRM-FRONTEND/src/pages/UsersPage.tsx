import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Role } from '@/types/auth';
import { USER_ROLE_OPTIONS } from '@/types/constants';
import { Plus, Upload, Download, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usersService } from '@/services/users';
import { UsersTable } from '@/components/users/UsersTable';
import { UserActivitiesTable } from '@/components/users/UserActivitiesTable';
import { UserSessionsTable } from '@/components/users/UserSessionsTable';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { BulkImportUsersDialog } from '@/components/users/BulkImportUsersDialog';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/components/ui/unified-search-filter-layout';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading';
import { useUserActivities } from '@/hooks/useUserActivities';
import { useUserSessions } from '@/hooks/useUserSessions';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

interface UserFilters extends Record<string, unknown> {
  role?: Role;
  status?: string;
}

export function UsersPage() {
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const { hasPermissionCode } = usePermissionContext();
  const canManageRbac = hasPermissionCode('permission.manage') || hasPermissionCode('role.manage');
  const canViewUsersData = hasPermissionCode('user.view');

  const adminTabs = ['users', 'activities', 'sessions'] as const;
  const standardTabs = ['users'] as const;
  const validTabs = canManageRbac ? adminTabs : standardTabs;
  type UserTab = (typeof adminTabs)[number];

  const queryTab = searchParams.get('tab');
  const rawTab = tabParam || queryTab || 'users';
  const activeTab: UserTab = validTabs.includes(rawTab as (typeof validTabs)[number])
    ? (rawTab as UserTab)
    : 'users';

  useEffect(() => {
    if (!tabParam) {
      if (activeTab !== 'users') {
        navigate(`/users/${activeTab}`, { replace: true });
      }
      return;
    }

    const canonicalPath = activeTab === 'users' ? '/users' : `/users/${activeTab}`;
    if (tabParam !== activeTab) {
      navigate(canonicalPath, { replace: true });
    }
  }, [tabParam, activeTab, navigate]);

  const handleTabChange = (nextTab: string) => {
    navigate(nextTab === 'users' ? '/users' : `/users/${nextTab}`);
  };

  // 1. Users Tab State
  const [userPage, setUserPage] = useState(1);
  const [userPageSize] = useState(20);
  const userSearch = useUnifiedSearch({
    syncWithUrl: true,
    urlParamName: 'search',
  });
  const userFilters = useUnifiedFilters<UserFilters>({
    syncWithUrl: true,
  });

  // 2. Activities Tab State
  const [actPage, setActPage] = useState(1);
  const actSearch = useUnifiedSearch({
    syncWithUrl: true,
    urlParamName: 'act_search',
  });
  const actFilters = useUnifiedFilters<{ fromDate?: string; toDate?: string; userId?: string }>({
    syncWithUrl: true,
    urlParamPrefix: 'act_',
  });

  // 3. Sessions Tab State
  const [sessPage, setSessPage] = useState(1);
  const sessSearch = useUnifiedSearch({
    syncWithUrl: true,
    urlParamName: 'sess_search',
  });

  // Independent pagination resets
  useEffect(() => { setUserPage(1); }, [userSearch.debouncedSearchValue, userFilters.filters]);
  useEffect(() => { setActPage(1); }, [actSearch.debouncedSearchValue, actFilters.filters]);
  useEffect(() => { setSessPage(1); }, [sessSearch.debouncedSearchValue]);

  // Queries
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', userSearch.debouncedSearchValue, userFilters.filters.role, userFilters.filters.status, userPage, userPageSize],
    queryFn: () => usersService.getUsers({
      search: userSearch.debouncedSearchValue || undefined,
      role: userFilters.filters.role || undefined,
      isActive: userFilters.filters.status === 'active' ? true : userFilters.filters.status === 'inactive' ? false : undefined,
      page: userPage,
      limit: userPageSize,
    }),
    enabled: activeTab === 'users',
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useUserActivities({
    page: actPage,
    limit: 20,
    search: actSearch.debouncedSearchValue || undefined,
    fromDate: actFilters.filters.fromDate,
    toDate: actFilters.filters.toDate,
    userId: actFilters.filters.userId,
  }, { enabled: activeTab === 'activities' && canManageRbac });

  const { data: sessionsData, isLoading: sessionsLoading } = useUserSessions({
    userId: undefined, // Admins can filter by userId if implemented in UI
    search: sessSearch.debouncedSearchValue || undefined,
    page: sessPage,
    limit: 20,
  }, { enabled: activeTab === 'sessions' && canManageRbac });

  const { data: userStatsData } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => usersService.getUserStats(),
    enabled: canViewUsersData,
    staleTime: 30 * 1000,
  });

  const handleExportUsers = async (format: 'CSV' | 'EXCEL' = 'EXCEL') => {
    try {
      const blob = await usersService.exportUsers({}, format);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.${format === 'EXCEL' ? 'xlsx' : 'csv'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export users:', error);
    }
  };

  const getTabStats = () => {
    try {
      const usersStats = (usersData as { statistics?: { total: number; active: number; inactive: number } })?.statistics || { total: 0, active: 0, inactive: 0 };
      const activities = activitiesData?.data || [];
      const sessions = sessionsData?.data || [];

      // Ensure all arrays are properly defined
      const safeActivities = Array.isArray(activities) ? activities : [];
      const safeSessions = Array.isArray(sessions) ? sessions : [];

      return {
        users: {
          total: Number(usersStats.total || 0),
          active: Number(usersStats.active || 0),
          inactive: Number(usersStats.inactive || 0),
        },
        activities: {
          total: safeActivities.length,
          today: safeActivities.filter(activity => {
            if (!activity?.createdAt) {return false;}
            try {
              const activityDate = new Date(activity.createdAt);
              const today = new Date();
              return activityDate.toDateString() === today.toDateString();
            } catch {
              return false;
            }
          }).length,
        },
        sessions: {
          total: safeSessions.length,
          active: safeSessions.filter(session => session?.isActive).length,
        }
      };
    } catch (error) {
      logger.error('Error calculating tab stats:', error);
      return {
        users: { total: 0, active: 0, inactive: 0 },
        activities: { total: 0, today: 0 },
        sessions: { total: 0, active: 0 }
      };
    }
  };

  // Early return if critical data is still loading to prevent undefined errors
  if (usersLoading && !usersData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState message="Fetching user data..." size="lg" />
      </div>
    );
  }

  const stats = getTabStats();
  const resolvedUserStats = userStatsData?.data || {
    totalUsers: Number(stats.users.total || 0),
    activeUsers: Number(stats.users.active || 0),
    inactiveUsers: Number(stats.users.inactive || 0),
    newUsersThisMonth: 0,
    usersByRole: [],
    usersByDepartment: [],
    recentLogins: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-gray-600">
            Manage users, roles, permissions, and monitor user activities
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {canViewUsersData && (
        <UserStatsCards stats={resolvedUserStats} />
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management System</CardTitle>
              <CardDescription>
                Comprehensive user administration and access control
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <TabsList
                className={cn(
                  'grid w-full min-w-max lg:w-auto',
                  canManageRbac ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3' : 'grid-cols-1'
                )}
              >
                <TabsTrigger value="users" className="text-xs sm:text-sm whitespace-nowrap">
                  <span className="hidden sm:inline">Users</span>
                  <span className="sm:hidden">Users</span>
                  {stats.users.total > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                      {stats.users.total}
                    </Badge>
                  )}
                </TabsTrigger>
                
                {canManageRbac && (
                  <>
                    <TabsTrigger value="activities" className="text-xs sm:text-sm whitespace-nowrap">
                      <span className="hidden sm:inline">Activities</span>
                      <span className="sm:hidden">Activity</span>
                      {stats.activities.total > 0 && (
                        <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                          {stats.activities.total}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="sessions" className="text-xs sm:text-sm whitespace-nowrap">
                      <span className="hidden sm:inline">Sessions</span>
                      <span className="sm:hidden">Sessions</span>
                      {stats.sessions.total > 0 && (
                        <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                          {stats.sessions.total}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </>
                )}
                
              </TabsList>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {/* Global action buttons moved to layout-specific actions prop for better consistency */}
              </div>
            </div>

            <TabsContent value="users" className="space-y-4">
              <UnifiedSearchFilterLayout
                searchValue={userSearch.searchValue}
                onSearchChange={userSearch.setSearchValue}
                onSearchClear={userSearch.clearSearch}
                isSearchLoading={userSearch.isDebouncing}
                searchPlaceholder="Search users by name, email, or phone..."
                hasActiveFilters={userFilters.hasActiveFilters}
                activeFilterCount={Object.keys(userFilters.filters).length}
                onClearFilters={userFilters.clearFilters}
                actions={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkImport(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportUsers('EXCEL')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateUser(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>
                }
                filterContent={
                  <FilterGrid columns={2}>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={userFilters.filters.role || 'all'}
                        onValueChange={(value) => userFilters.setFilter('role', value === 'all' ? undefined : (value as Role))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          {USER_ROLE_OPTIONS.map(option => (
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
                        value={userFilters.filters.status || 'all'}
                        onValueChange={(value) => userFilters.setFilter('status', value === 'all' ? undefined : value)}
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
                  </FilterGrid>
                }
              />

              <UsersTable
                data={Array.isArray(usersData?.data) ? usersData.data : []}
                isLoading={usersLoading}
              />

              {/* Pagination Controls */}
              {usersData?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-gray-600">
                    Showing {usersData.data?.length || 0} of {usersData.pagination.total} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                      disabled={userPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {userPage} of {usersData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserPage(prev => prev + 1)}
                      disabled={userPage >= (usersData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <UnifiedSearchFilterLayout
                searchValue={actSearch.searchValue}
                onSearchChange={actSearch.setSearchValue}
                onSearchClear={actSearch.clearSearch}
                isSearchLoading={actSearch.isDebouncing}
                searchPlaceholder="Search activities by action or details..."
                hasActiveFilters={actFilters.hasActiveFilters}
                onClearFilters={actFilters.clearFilters}
                filterContent={
                  <FilterGrid columns={2}>
                    <div className="space-y-2">
                      <Label>From Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !actFilters.filters.fromDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {actFilters.filters.fromDate ? format(new Date(actFilters.filters.fromDate), 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={actFilters.filters.fromDate ? new Date(actFilters.filters.fromDate) : undefined}
                            onSelect={(date) => actFilters.setFilter('fromDate', date ? date.toISOString() : undefined)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>To Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !actFilters.filters.toDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {actFilters.filters.toDate ? format(new Date(actFilters.filters.toDate), 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={actFilters.filters.toDate ? new Date(actFilters.filters.toDate) : undefined}
                            onSelect={(date) => actFilters.setFilter('toDate', date ? date.toISOString() : undefined)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </FilterGrid>
                }
              />

              <UserActivitiesTable
                data={Array.isArray(activitiesData?.data) ? activitiesData.data : []}
                isLoading={activitiesLoading}
              />

              {/* Pagination Controls */}
              {activitiesData?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-gray-600">
                    Showing {activitiesData.data?.length || 0} of {activitiesData.pagination.total} activities
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActPage(prev => Math.max(1, prev - 1))}
                      disabled={actPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {actPage} of {activitiesData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActPage(prev => prev + 1)}
                      disabled={actPage >= (activitiesData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <UnifiedSearchFilterLayout
                searchValue={sessSearch.searchValue}
                onSearchChange={sessSearch.setSearchValue}
                onSearchClear={sessSearch.clearSearch}
                isSearchLoading={sessSearch.isDebouncing}
                searchPlaceholder="Filter sessions by user or IP..."
                showFilters={false}
              />

              <UserSessionsTable
                data={Array.isArray(sessionsData?.data) ? sessionsData.data : []}
                isLoading={sessionsLoading}
              />

              {/* Pagination Controls (Placeholder if needed) */}
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateUserDialog
        open={showCreateUser}
        onOpenChange={setShowCreateUser}
      />
      
      <BulkImportUsersDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
      />
    </div>
  );
}
