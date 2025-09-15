import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Download, Upload, Users, UserCheck, UserX, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usersService } from '@/services/users';
import { rolesService } from '@/services/roles';
import { UsersTable } from '@/components/users/UsersTable';
import { UserActivitiesTable } from '@/components/users/UserActivitiesTable';
import { UserSessionsTable } from '@/components/users/UserSessionsTable';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { BulkImportUsersDialog } from '@/components/users/BulkImportUsersDialog';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { RolePermissionsTable } from '@/components/users/RolePermissionsTable';
import type { Role } from '@/types/auth';

export function UsersPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Fetch users data
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', searchQuery, selectedRole, selectedDepartment, selectedStatus],
    queryFn: () => usersService.getUsers({
      search: searchQuery,
      role: selectedRole !== 'all' ? selectedRole as Role : undefined,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
      isActive: selectedStatus === 'active' ? true : selectedStatus === 'inactive' ? false : undefined,
    }),
    enabled: activeTab === 'users',
  });

  // Fetch user activities
  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['user-activities', searchQuery],
    queryFn: () => usersService.getUserActivities({
      search: searchQuery,
      limit: 50,
    }),
    enabled: activeTab === 'activities',
  });

  // Fetch user sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: () => usersService.getUserSessions({
      limit: 50,
    }),
    enabled: activeTab === 'sessions',
  });

  // Fetch user statistics
  const { data: userStatsData } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => usersService.getUserStats(),
    enabled: activeTab === 'users',
  });

  // Fetch role permissions
  const { data: rolePermissionsData, isLoading: rolePermissionsLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => usersService.getRolePermissions(),
    enabled: activeTab === 'permissions',
  });

  // Fetch departments for filter
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => usersService.getDepartments(),
  });

  // Fetch roles for filter
  const { data: rolesData } = useQuery({
    queryKey: ['roles', 'active'],
    queryFn: () => rolesService.getActiveRoles(),
  });

  const handleExportUsers = async (format: 'CSV' | 'EXCEL' = 'EXCEL') => {
    try {
      const blob = await usersService.exportUsers({
        search: searchQuery,
        role: selectedRole !== 'all' ? selectedRole as Role : undefined,
        department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        isActive: selectedStatus === 'active' ? true : selectedStatus === 'inactive' ? false : undefined,
      }, format);

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

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRole('all');
    setSelectedDepartment('all');
    setSelectedStatus('all');
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
  const departments = Array.isArray(departmentsData?.data) ? departmentsData.data : [];
  const roles = Array.isArray(rolesData?.data) ? rolesData.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
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
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="users">
                  Users
                  {stats.users.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.users.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activities">
                  Activities
                  {stats.activities.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.activities.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sessions">
                  Sessions
                  {stats.sessions.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.sessions.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="permissions">
                  Permissions
                </TabsTrigger>
              </TabsList>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {activeTab === 'users' && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Filters */}
            {(activeTab === 'users' || activeTab === 'activities') && (
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                {activeTab === 'users' && (
                  <>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}

                {(searchQuery || selectedRole !== 'all' || selectedDepartment !== 'all' || selectedStatus !== 'all') && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            )}

            <TabsContent value="users" className="space-y-4">
              <UsersTable
                data={Array.isArray(usersData?.data) ? usersData.data : []}
                isLoading={usersLoading}
              />
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <UserActivitiesTable
                data={Array.isArray(activitiesData?.data) ? activitiesData.data : []}
                isLoading={activitiesLoading}
              />
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <UserSessionsTable
                data={Array.isArray(sessionsData?.data) ? sessionsData.data : []}
                isLoading={sessionsLoading}
              />
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
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
