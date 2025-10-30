import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, Download } from 'lucide-react';
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
import { RolePermissionsTable } from '@/components/users/RolePermissionsTable';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchInput } from '@/components/ui/unified-search-input';
import { UnifiedFilterPanel, FilterGrid } from '@/components/ui/unified-filter-panel';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function UsersPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Unified search with 800ms debounce
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters
  const {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useUnifiedFilters({
    syncWithUrl: true,
  });

  const filterRole = filters.role || '';
  const filterStatus = filters.status || '';

  // Count active filters
  const activeFilterCount = Object.keys(filters).filter(
    key => filters[key as keyof typeof filters] !== undefined
  ).length;

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', debouncedSearchValue, filterRole, filterStatus],
    queryFn: () => usersService.getUsers({
      search: debouncedSearchValue || undefined,
      role: filterRole || undefined,
      isActive: filterStatus === 'active' ? true : filterStatus === 'inactive' ? false : undefined,
    }),
    enabled: activeTab === 'users',
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['user-activities', debouncedSearchValue],
    queryFn: () => usersService.getUserActivities({
      limit: 50,
      search: debouncedSearchValue || undefined,
    }),
    enabled: activeTab === 'activities',
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['user-sessions', debouncedSearchValue],
    queryFn: () => usersService.getUserSessions({
      limit: 50,
      search: debouncedSearchValue || undefined,
    }),
    enabled: activeTab === 'sessions',
  });

  const { data: userStatsData } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => usersService.getUserStats(),
    enabled: activeTab === 'users',
  });

  const { data: rolePermissionsData, isLoading: rolePermissionsLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => usersService.getRolePermissions(),
    enabled: activeTab === 'permissions',
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
      console.error('Failed to export users:', error);
    }
  };

  const getTabStats = () => {
    try {
      const users = usersData?.data || [];
      const activities = activitiesData?.data || [];
      const sessions = sessionsData?.data || [];

      // Ensure all arrays are properly defined
      const safeUsers = Array.isArray(users) ? users : [];
      const safeActivities = Array.isArray(activities) ? activities : [];
      const safeSessions = Array.isArray(sessions) ? sessions : [];

      return {
        users: {
          total: safeUsers.length,
          active: safeUsers.filter(user => user?.isActive).length,
          inactive: safeUsers.filter(user => !user?.isActive).length,
        },
        activities: {
          total: safeActivities.length,
          today: safeActivities.filter(activity => {
            if (!activity?.timestamp) return false;
            try {
              const activityDate = new Date(activity.timestamp);
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
      console.error('Error calculating tab stats:', error);
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  const stats = getTabStats();

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">User Management</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground">
            Manage users, roles, permissions, and monitor user activities
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {activeTab === 'users' && userStatsData?.data && (
        <UserStatsCards stats={userStatsData.data} />
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
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="users" className="flex-1 sm:flex-none">
                  <span className="hidden sm:inline">Users</span>
                  <span className="sm:hidden">Users</span>
                  {stats.users.total > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2">
                      {stats.users.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activities" className="flex-1 sm:flex-none">
                  <span className="hidden sm:inline">Activities</span>
                  <span className="sm:hidden">Activity</span>
                  {stats.activities.total > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2">
                      {stats.activities.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sessions" className="flex-1 sm:flex-none">
                  <span className="hidden sm:inline">Sessions</span>
                  <span className="sm:hidden">Sessions</span>
                  {stats.sessions.total > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2">
                      {stats.sessions.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex-1 sm:flex-none">
                  <span className="hidden sm:inline">Permissions</span>
                  <span className="sm:hidden">Perms</span>
                </TabsTrigger>
              </TabsList>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {activeTab === 'users' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkImport(true)}
                      className="w-full sm:w-auto"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportUsers('EXCEL')}
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateUser(true)}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </>
                )}
              </div>
            </div>



            <TabsContent value="users" className="space-y-4">
              {/* Search Section */}
              <div className="mb-6">
                <UnifiedSearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  onClear={clearSearch}
                  isLoading={isDebouncing}
                  placeholder="Search users by name, email, or phone..."
                />
              </div>

              {/* Filter Section */}
              <UnifiedFilterPanel
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
                onClearAll={clearFilters}
              >
                <FilterGrid columns={2}>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={filterRole}
                      onValueChange={(value) => setFilter('role', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Roles</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="FIELD_AGENT">Field Agent</SelectItem>
                        <SelectItem value="BACKEND_TEAM">Backend Team</SelectItem>
                        <SelectItem value="CLIENT">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={filterStatus}
                      onValueChange={(value) => setFilter('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </FilterGrid>
              </UnifiedFilterPanel>

              <UsersTable
                data={Array.isArray(usersData?.data) ? usersData.data : []}
                isLoading={usersLoading}
              />
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              {/* Search Section */}
              <div className="mb-6">
                <UnifiedSearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  onClear={clearSearch}
                  isLoading={isDebouncing}
                  placeholder="Search activities by user, action, or description..."
                />
              </div>

              <UserActivitiesTable
                data={Array.isArray(activitiesData?.data) ? activitiesData.data : []}
                isLoading={activitiesLoading}
              />
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              {/* Search Section */}
              <div className="mb-6">
                <UnifiedSearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  onClear={clearSearch}
                  isLoading={isDebouncing}
                  placeholder="Search sessions by user, IP address, or device..."
                />
              </div>

              <UserSessionsTable
                data={Array.isArray(sessionsData?.data) ? sessionsData.data : []}
                isLoading={sessionsLoading}
              />
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              {/* Search Section */}
              <div className="mb-6">
                <UnifiedSearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  onClear={clearSearch}
                  isLoading={isDebouncing}
                  placeholder="Search permissions by role or permission name..."
                />
              </div>

              <RolePermissionsTable
                data={Array.isArray(rolePermissionsData?.data) ? rolePermissionsData.data : []}
                isLoading={rolePermissionsLoading}
              />
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
