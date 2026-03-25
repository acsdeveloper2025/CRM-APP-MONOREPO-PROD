import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { rbacAdminService, type RbacRole } from '@/services/rbacAdmin';
import { PAGE_PERMISSION_GUIDE, RBAC_PERMISSION_MODULES } from '@/constants/rbac';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type RoleFormState = {
  name: string;
  description: string;
  cloneFromRoleId: string;
};

function RoleModal({
  open,
  onOpenChange,
  roles,
  mode,
  initialRole,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RbacRole[];
  mode: 'create' | 'edit';
  initialRole?: RbacRole | null;
  onSubmit: (payload: { name: string; description?: string; parentRoleId?: string | null }) => void;
}) {
  const [form, setForm] = React.useState<RoleFormState>({
    name: '',
    description: '',
    cloneFromRoleId: 'none',
  });

  React.useEffect(() => {
    if (!open) {return;}
    setForm({
      name: initialRole?.name || '',
      description: initialRole?.description || '',
      cloneFromRoleId: 'none',
    });
  }, [open, initialRole]);

  const title = mode === 'create' ? 'Create Role' : 'Edit Role';
  const description =
    mode === 'create'
      ? 'Create a new role and optionally clone permissions from an existing role.'
      : 'Update role metadata. Permissions are edited in the matrix.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role Name</Label>
            <Input value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
            />
          </div>
          {mode === 'create' && (
            <div className="space-y-2">
              <Label>Clone From (Optional)</Label>
              <Select
                value={form.cloneFromRoleId}
                onValueChange={value => setForm(s => ({ ...s, cloneFromRoleId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Do not clone permissions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Do not clone</SelectItem>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                parentRoleId:
                  mode === 'create' && form.cloneFromRoleId !== 'none' ? form.cloneFromRoleId : null,
              })
            }
          >
            {mode === 'create' ? 'Create Role' : 'Save Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RBACAdminPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = React.useState<string[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<RbacRole | null>(null);

  const rolesQuery = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => rbacAdminService.getRoles(),
  });

  const permissionsCatalogQuery = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: () => rbacAdminService.getPermissions(),
  });

  const roles = React.useMemo(() => rolesQuery.data?.data || [], [rolesQuery.data]);
  const selectedRole = roles.find(r => r.id === selectedRoleId) || null;

  React.useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const rolePermissionsQuery = useQuery({
    queryKey: ['rbac-role-permissions', selectedRoleId],
    queryFn: () => rbacAdminService.getRolePermissions(selectedRoleId as string),
    enabled: !!selectedRoleId,
  });

  React.useEffect(() => {
    setSelectedPermissionCodes(rolePermissionsQuery.data?.data?.permissions || []);
  }, [rolePermissionsQuery.data]);

  const refreshRoleData = async (roleId?: string | null) => {
    await queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
    if (roleId) {
      await queryClient.invalidateQueries({ queryKey: ['rbac-role-permissions', roleId] });
    }
  };

  const createRoleMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; parentRoleId?: string | null }) =>
      rbacAdminService.createRole(payload),
    onSuccess: async response => {
      toast.success('Role created');
      setShowCreate(false);
      const newId = response.data?.id || null;
      await refreshRoleData(newId);
      if (newId) {setSelectedRoleId(newId);}
    },
    onError: (error: unknown) => {
      toast.error((error as { message?: string }).message || 'Failed to create role');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (payload: { id: string; data: { name?: string; description?: string; parentRoleId?: string | null } }) =>
      rbacAdminService.updateRole(payload.id, payload.data),
    onSuccess: async () => {
      toast.success('Role updated');
      setEditingRole(null);
      await refreshRoleData(selectedRoleId);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rbacAdminService.deleteRole(id),
    onSuccess: async () => {
      toast.success('Role deleted');
      const deleted = selectedRoleId;
      setSelectedRoleId(null);
      await refreshRoleData(deleted);
    },
    onError: (error: unknown) => {
      toast.error((error as { message?: string }).message || 'Failed to delete role');
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: () => rbacAdminService.updateRolePermissions(selectedRoleId as string, selectedPermissionCodes),
    onSuccess: async () => {
      toast.success('Permissions updated');
      await refreshRoleData(selectedRoleId);
    },
    onError: (error: unknown) => {
      toast.error((error as { message?: string }).message || 'Failed to update permissions');
    },
  });

  const togglePermission = (code: string, checked: boolean) => {
    setSelectedPermissionCodes(prev =>
      checked ? Array.from(new Set([...prev, code])) : prev.filter(p => p !== code)
    );
  };

  const permissionMeta = React.useMemo(
    () => permissionsCatalogQuery.data?.data || [],
    [permissionsCatalogQuery.data]
  );
  const stats = React.useMemo(() => {
    const totalRoles = roles.length;
    const systemRoles = roles.filter(role => role.isSystem).length;
    const customRoles = totalRoles - systemRoles;
    const totalAssignedUsers = roles.reduce((sum, role) => sum + (role.userCount || 0), 0);
    const totalPermissions = permissionMeta.length;
    const selectedRolePermissions = selectedPermissionCodes.length;

    return {
      totalRoles,
      systemRoles,
      customRoles,
      totalAssignedUsers,
      totalPermissions,
      selectedRolePermissions,
    };
  }, [roles, permissionMeta, selectedPermissionCodes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">RBAC Administration</h1>
        <p className="text-gray-600">
          Manage roles and permission assignments for the system.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRoles}</div>
            <p className="text-xs text-gray-600">Configured roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.systemRoles}</div>
            <p className="text-xs text-gray-600">Protected defaults</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customRoles}</div>
            <p className="text-xs text-gray-600">User-defined roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mapped Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignedUsers}</div>
            <p className="text-xs text-gray-600">Users across roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPermissions}</div>
            <p className="text-xs text-gray-600">
              {selectedRole ? `${stats.selectedRolePermissions} selected for ${selectedRole.name}` : 'Catalog size'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>RBAC Management Console</CardTitle>
              <CardDescription>
                Manage roles, assign permissions, and review page access mapping.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <Card className="xl:col-span-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Role List</CardTitle>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Role
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {roles.map(role => (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`rounded-lg border p-3 cursor-pointer ${
                      selectedRoleId === role.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{role.name}</div>
                        <div className="text-xs text-gray-500 line-clamp-2">{role.description || 'No description'}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {role.parentRoleName && <Badge variant="outline">Parent: {role.parentRoleName}</Badge>}
                          <Badge variant="secondary">Users: {role.userCount || 0}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingRole(role);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!!role.isSystem}
                          onClick={e => {
                            e.stopPropagation();
                            // eslint-disable-next-line no-alert
                            if (window.confirm(`Delete role "${role.name}"?`)) {
                              deleteRoleMutation.mutate(role.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {roles.length === 0 && (
                  <div className="text-sm text-gray-500">No roles found.</div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-8">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Permission Matrix</CardTitle>
                  <div className="text-sm text-gray-500 mt-1">
                    {selectedRole ? `Editing permissions for ${selectedRole.name}` : 'Select a role to edit permissions'}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => savePermissionsMutation.mutate()}
                  disabled={!selectedRoleId || savePermissionsMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {!selectedRoleId ? (
                  <div className="text-sm text-gray-500">Select a role from the left panel.</div>
                ) : (
                  Object.entries(RBAC_PERMISSION_MODULES).map(([moduleName, codes]) => (
                    <div key={moduleName} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-gray-500" />
                        <h3 className="font-semibold text-sm text-gray-700">{moduleName}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {codes.map(code => {
                          const checked = selectedPermissionCodes.includes(code);
                          const meta = permissionMeta.find(p => p.code === code);
                          return (
                            <label
                              key={code}
                              className="flex items-start gap-2 rounded border p-2 hover:bg-gray-50"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={value => togglePermission(code, value === true)}
                              />
                              <div>
                                <div className="text-sm font-medium">{code}</div>
                                <div className="text-xs text-gray-500">
                                  {meta?.description || 'Permission'}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Page Access Guide</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {PAGE_PERMISSION_GUIDE.map(item => (
                <div key={item.page} className="rounded border p-3">
                  <div className="font-medium text-sm">{item.page}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.permissions.map(code => (
                      <Badge key={code} variant="outline" className="text-xs">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <RoleModal
        open={showCreate}
        onOpenChange={setShowCreate}
        roles={roles}
        mode="create"
        onSubmit={payload => createRoleMutation.mutate(payload)}
      />

      <RoleModal
        open={!!editingRole}
        onOpenChange={open => {
          if (!open) {setEditingRole(null);}
        }}
        roles={roles}
        mode="edit"
        initialRole={editingRole}
        onSubmit={payload => {
          if (!editingRole) {return;}
          updateRoleMutation.mutate({ id: editingRole.id, data: payload });
        }}
      />
    </div>
  );
}

export default RBACAdminPage;
