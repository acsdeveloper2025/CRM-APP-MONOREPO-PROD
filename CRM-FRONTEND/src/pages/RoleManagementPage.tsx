import React, { useState } from 'react';
import { Plus, Shield, Building, Users } from 'lucide-react';
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

export default function RoleManagementPage() {
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showCreateDepartment, setShowCreateDepartment] = useState(false);
  const [showCreateDesignation, setShowCreateDesignation] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);

  const handleEditRole = (role: RoleData) => {
    setEditingRole(role);
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
  };

  const handleEditDesignation = (designation: Designation) => {
    setEditingDesignation(designation);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role & Department Management</h1>
          <p className="text-muted-foreground">
            Manage roles, permissions, and organizational structure
          </p>
        </div>
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
