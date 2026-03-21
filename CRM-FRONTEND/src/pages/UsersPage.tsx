import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Role } from '@/types/auth';
import { Plus, Upload, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Badge } from '@/ui/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { usersService } from '@/services/users';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { BulkImportUsersDialog } from '@/components/users/BulkImportUsersDialog';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { UsersActivitiesTabPanel } from '@/components/users/UsersActivitiesTabPanel';
import { UsersSessionsTabPanel } from '@/components/users/UsersSessionsTabPanel';
import { UsersUsersTabPanel } from '@/components/users/UsersUsersTabPanel';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { LoadingState } from '@/ui/components/loading';
import { useUserActivities } from '@/hooks/useUserActivities';
import { useUserSessions } from '@/hooks/useUserSessions';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/Button';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';

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
      console.error('Failed to export users:', error);
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
      <Page shell title="User Management" subtitle="Manage users, roles, permissions, and monitor user activities.">
        <Section>
          <div {...{ className: "flex items-center justify-center min-h-[400px]" }}>
            <LoadingState message="Fetching user data..." size="lg" />
          </div>
        </Section>
      </Page>
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

  const headerActions = activeTab === 'users' ? (
    <>
      <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setShowBulkImport(true)}>
        Import
      </Button>
      <Button variant="secondary" icon={<Download size={16} />} onClick={() => handleExportUsers('EXCEL')}>
        Export
      </Button>
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateUser(true)}>
        Add User
      </Button>
    </>
  ) : undefined;

  return (
    <Page
      shell
      title="User Management"
      subtitle="Manage users, roles, permissions, and monitor user activities."
      actions={headerActions}
    >
      <Section>
        <div {...{ className: "space-y-6" }}>

          {canViewUsersData && (
            <UserStatsCards stats={resolvedUserStats} />
          )}

          <Card>
            <CardHeader>
              <div {...{ className: "flex items-center justify-between" }}>
                <div>
                  <CardTitle>User Management System</CardTitle>
                  <CardDescription>
                    Comprehensive user administration and access control
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent {...{ className: "p-4 sm:p-6" }}>
              <Tabs value={activeTab} onValueChange={handleTabChange} {...{ className: "space-y-4" }}>
                <div {...{ className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" }}>
                  <TabsList
                    {...{
                      className: cn(
                        'grid w-full min-w-max lg:w-auto',
                        canManageRbac ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3' : 'grid-cols-1'
                      ),
                    }}
                  >
                    <TabsTrigger value="users" {...{ className: "text-xs sm:text-sm whitespace-nowrap" }}>
                      <span {...{ className: "hidden sm:inline" }}>Users</span>
                      <span {...{ className: "sm:hidden" }}>Users</span>
                      {stats.users.total > 0 && (
                        <Badge variant="secondary" {...{ className: "ml-1 sm:ml-2 text-xs" }}>
                          {stats.users.total}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {canManageRbac && (
                      <>
                        <TabsTrigger value="activities" {...{ className: "text-xs sm:text-sm whitespace-nowrap" }}>
                          <span {...{ className: "hidden sm:inline" }}>Activities</span>
                          <span {...{ className: "sm:hidden" }}>Activity</span>
                          {stats.activities.total > 0 && (
                            <Badge variant="secondary" {...{ className: "ml-1 sm:ml-2 text-xs" }}>
                              {stats.activities.total}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="sessions" {...{ className: "text-xs sm:text-sm whitespace-nowrap" }}>
                          <span {...{ className: "hidden sm:inline" }}>Sessions</span>
                          <span {...{ className: "sm:hidden" }}>Sessions</span>
                          {stats.sessions.total > 0 && (
                            <Badge variant="secondary" {...{ className: "ml-1 sm:ml-2 text-xs" }}>
                              {stats.sessions.total}
                            </Badge>
                          )}
                        </TabsTrigger>
                      </>
                    )}
                  </TabsList>
                </div>

                <TabsContent value="users" {...{ className: "space-y-4" }}>
                  <UsersUsersTabPanel
                    userSearch={userSearch}
                    userFilters={userFilters}
                    usersData={usersData}
                    usersLoading={usersLoading}
                    userPage={userPage}
                    setUserPage={setUserPage}
                    onBulkImport={() => setShowBulkImport(true)}
                    onExport={() => handleExportUsers('EXCEL')}
                    onAddUser={() => setShowCreateUser(true)}
                  />
                </TabsContent>

                <TabsContent value="activities" {...{ className: "space-y-4" }}>
                  <UsersActivitiesTabPanel
                    actSearch={actSearch}
                    actFilters={actFilters}
                    activitiesData={activitiesData}
                    activitiesLoading={activitiesLoading}
                    actPage={actPage}
                    setActPage={setActPage}
                  />
                </TabsContent>

                <TabsContent value="sessions" {...{ className: "space-y-4" }}>
                  <UsersSessionsTabPanel
                    sessSearch={sessSearch}
                    sessionsData={sessionsData}
                    sessionsLoading={sessionsLoading}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <CreateUserDialog
            open={showCreateUser}
            onOpenChange={setShowCreateUser}
          />

          <BulkImportUsersDialog
            open={showBulkImport}
            onOpenChange={setShowBulkImport}
          />
        </div>
      </Section>
    </Page>
  );
}
