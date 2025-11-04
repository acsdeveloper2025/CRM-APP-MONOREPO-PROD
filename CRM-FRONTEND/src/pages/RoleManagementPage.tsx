import React, { useState } from 'react';
import { Plus, Shield, Building, Users, UserCheck, Briefcase } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateRoleDialog } from '@/components/users/CreateRoleDialog';
import { EditRoleDialog } from '@/components/users/EditRoleDialog';
import { CreateDepartmentDialog } from '@/components/users/CreateDepartmentDialog';
import { EditDepartmentDialog } from '@/components/users/EditDepartmentDialog';
import { DesignationList } from '@/components/users/DesignationList';
import { CreateDesignationDialog } from '@/components/users/CreateDesignationDialog';
import { EditDesignationDialog } from '@/components/users/EditDesignationDialog';
import { RolesTable } from '@/components/users/RolesTable';
import { DepartmentsTable } from '@/components/users/DepartmentsTable';
import { RoleData, Department, Designation } from '@/types/user';
import { rolesService } from '@/services/roles';
import { departmentsService } from '@/services/departments';
import { designationsService } from '@/services/designations';
import { usersService } from '@/services/users';

export default function RoleManagementPage() {
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showCreateDepartment, setShowCreateDepartment] = useState(false);
  const [showCreateDesignation, setShowCreateDesignation] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);

  // Fetch data for stat cards
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.getRoles({ limit: 100 }),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsService.getDepartments({ limit: 100 }),
  });

  const { data: designationsData } = useQuery({
    queryKey: ['designations'],
    queryFn: () => designationsService.getDesignations({ limit: 100 }),
  });

  const { data: userStatsData } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => usersService.getUserStats(),
  });

  const handleEditRole = (role: RoleData) => {
    setEditingRole(role);
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
  };

  const handleEditDesignation = (designation: Designation) => {
    setEditingDesignation(designation);
  };

  // Calculate statistics
  const totalRoles = rolesData?.pagination?.total || rolesData?.data?.length || 0;
  const totalDepartments = departmentsData?.pagination?.total || departmentsData?.data?.length || 0;
  const totalDesignations = designationsData?.pagination?.total || designationsData?.data?.length || 0;
  const activeUsers = userStatsData?.data?.activeUsers || 0;
  const totalPermissions = rolesData?.data?.reduce((acc, role) => {
    return acc + (role.permissions?.length || 0);
  }, 0) || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role & Department Management</h1>
          <p className="text-gray-600">
            Manage roles, permissions, and organizational structure
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRoles}</div>
            <p className="text-xs text-gray-600">
              System roles defined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepartments}</div>
            <p className="text-xs text-gray-600">
              Organizational units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Designations</CardTitle>
            <Briefcase className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDesignations}</div>
            <p className="text-xs text-gray-600">
              Job positions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-gray-600">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPermissions}</div>
            <p className="text-xs text-gray-600">
              Total permissions
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roles" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Roles & Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center space-x-2">
            <Building className="h-4 w-4" />
            <span>Departments</span>
          </TabsTrigger>
          <TabsTrigger value="designations" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Designations</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5" />
                    <span>Roles Management</span>
                  </CardTitle>
                  <CardDescription>
                    Create and manage user roles with specific permissions for different parts of the application.
                  </CardDescription>
                </div>
                <PermissionGuard resource="roles" action="create">
                  <Button onClick={() => setShowCreateRole(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Role
                  </Button>
                </PermissionGuard>
              </div>
            </CardHeader>
            <CardContent>
              <RolesTable onEditRole={handleEditRole} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="h-5 w-5" />
                    <span>Departments Management</span>
                  </CardTitle>
                  <CardDescription>
                    Organize your team structure with departments and assign department heads.
                  </CardDescription>
                </div>
                <PermissionGuard resource="departments" action="create">
                  <Button onClick={() => setShowCreateDepartment(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Department
                  </Button>
                </PermissionGuard>
              </div>
            </CardHeader>
            <CardContent>
              <DepartmentsTable onEditDepartment={handleEditDepartment} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="designations" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Designations Management
                  </CardTitle>
                  <CardDescription>
                    Manage organizational designations and their department associations
                  </CardDescription>
                </div>
                <PermissionGuard resource="designations" action="create">
                  <Button onClick={() => setShowCreateDesignation(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Designation
                  </Button>
                </PermissionGuard>
              </div>
            </CardHeader>
            <CardContent>
              <DesignationList onEdit={handleEditDesignation} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateRoleDialog
        open={showCreateRole}
        onOpenChange={setShowCreateRole}
      />

      <CreateDepartmentDialog
        open={showCreateDepartment}
        onOpenChange={setShowCreateDepartment}
      />

      <EditRoleDialog
        open={!!editingRole}
        onOpenChange={(open) => !open && setEditingRole(null)}
        role={editingRole}
      />

      <EditDepartmentDialog
        open={!!editingDepartment}
        onOpenChange={(open) => !open && setEditingDepartment(null)}
        department={editingDepartment}
      />

      <CreateDesignationDialog
        open={showCreateDesignation}
        onOpenChange={setShowCreateDesignation}
      />

      <EditDesignationDialog
        open={!!editingDesignation}
        onOpenChange={(open) => !open && setEditingDesignation(null)}
        designation={editingDesignation}
      />
    </div>
  );
}
