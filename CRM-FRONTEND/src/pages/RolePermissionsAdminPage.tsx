import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rbacAdminService, type RbacRole } from '@/services/rbacAdmin';
import { RBAC_PERMISSION_MODULES, ROUTE_ACCESS_OPTIONS } from '@/constants/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Textarea } from '@/ui/components/textarea';
import { Label } from '@/ui/components/label';
import { Checkbox } from '@/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/components/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { Badge } from '@/ui/components/badge';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Pencil } from 'lucide-react';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Badge as UiBadge } from '@/ui/components/Badge';
import { Button as UiButton } from '@/ui/components/Button';
import { Card as UiCard } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

type RoleFormState = { name: string; description: string; parentRoleId: string };

function RoleFormDialog({
  open,
  onOpenChange,
  roles,
  initialRole,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RbacRole[];
  initialRole?: RbacRole | null;
  onSubmit: (data: { name: string; description?: string; parentRoleId?: string | null }) => void;
}) {
  const [form, setForm] = React.useState<RoleFormState>({ name: '', description: '', parentRoleId: 'none' });

  React.useEffect(() => {
    if (!open) {return;}
    setForm({
      name: initialRole?.name || '',
      description: initialRole?.description || '',
      parentRoleId: initialRole?.parentRoleId || 'none',
    });
  }, [open, initialRole]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            {initialRole ? 'Update role metadata, hierarchy, permissions and routes.' : 'Create a new role and optionally inherit from a parent role.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role Name</Label>
            <Input value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Parent Role</Label>
            <Select value={form.parentRoleId} onValueChange={value => setForm(s => ({ ...s, parentRoleId: value }))}>
              <SelectTrigger><SelectValue placeholder="No parent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent</SelectItem>
                {roles
                  .filter(r => !initialRole || r.id !== initialRole.id)
                  .map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit({
              name: form.name,
              description: form.description || undefined,
              parentRoleId: form.parentRoleId === 'none' ? null : form.parentRoleId,
            })}
          >
            {initialRole ? 'Update Role' : 'Create Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RolePermissionsAdminPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<RbacRole | null>(null);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = React.useState<string[]>([]);
  const [selectedRoutes, setSelectedRoutes] = React.useState<Record<string, boolean>>({});

  const rolesQuery = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => rbacAdminService.getRoles(),
  });

  const permissionsQuery = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: () => rbacAdminService.getPermissions(),
  });

  const roles = React.useMemo(() => rolesQuery.data?.data || [], [rolesQuery.data]);

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

  const roleRoutesQuery = useQuery({
    queryKey: ['rbac-role-routes', selectedRoleId],
    queryFn: () => rbacAdminService.getRoleRoutes(selectedRoleId as string),
    enabled: !!selectedRoleId,
  });

  React.useEffect(() => {
    const codes = rolePermissionsQuery.data?.data?.permissions || [];
    setSelectedPermissionCodes(codes);
  }, [rolePermissionsQuery.data]);

  React.useEffect(() => {
    const entries = roleRoutesQuery.data?.data?.routes || [];
    const next: Record<string, boolean> = {};
    for (const item of ROUTE_ACCESS_OPTIONS) {next[item.key] = false;}
    for (const row of entries) {next[row.routeKey] = row.allowed;}
    setSelectedRoutes(next);
  }, [roleRoutesQuery.data]);

  const invalidateRoleData = async (roleId?: string | null) => {
    await queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
    if (roleId) {
      await queryClient.invalidateQueries({ queryKey: ['rbac-role-permissions', roleId] });
      await queryClient.invalidateQueries({ queryKey: ['rbac-role-routes', roleId] });
    }
  };

  const createRoleMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; parentRoleId?: string | null }) =>
      rbacAdminService.createRole(payload),
    onSuccess: async () => {
      toast.success('Role created');
      setShowCreate(false);
      await invalidateRoleData();
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
      await invalidateRoleData(selectedRoleId);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rbacAdminService.deleteRole(id),
    onSuccess: async () => {
      toast.success('Role deleted');
      const deleted = selectedRoleId;
      setSelectedRoleId(null);
      await invalidateRoleData(deleted);
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: () => rbacAdminService.updateRolePermissions(selectedRoleId as string, selectedPermissionCodes),
    onSuccess: async () => {
      toast.success('Permissions updated');
      await invalidateRoleData(selectedRoleId);
    },
  });

  const saveRoutesMutation = useMutation({
    mutationFn: () =>
      rbacAdminService.updateRoleRoutes(
        selectedRoleId as string,
        ROUTE_ACCESS_OPTIONS.map(item => ({ routeKey: item.key, allowed: !!selectedRoutes[item.key] }))
      ),
    onSuccess: async () => {
      toast.success('Route access updated');
      await invalidateRoleData(selectedRoleId);
    },
  });

  const togglePermission = (code: string, checked: boolean) => {
    setSelectedPermissionCodes(prev =>
      checked ? Array.from(new Set([...prev, code])) : prev.filter(c => c !== code)
    );
  };

  const groupedPermissions = permissionsQuery.data?.data || [];

  return (
    <Page
      title="Role & Permissions"
      subtitle="Configure RBAC permissions, route access, and role hierarchy."
      shell
      actions={
        <UiButton icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Create Role
        </UiButton>
      }
    >
      <Section>
        <Stack gap={3}>
          <UiBadge variant="accent">Access Control</UiBadge>
          <Text as="h2" variant="headline">Keep roles, permissions, and route access visible in one operational surface.</Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            {
              title: 'Roles',
              value: roles.length,
              detail: 'Configured RBAC roles',
              tone: 'accent',
            },
            {
              title: 'Permissions',
              value: groupedPermissions.length,
              detail: 'Available permission codes',
              tone: 'warning',
            },
            {
              title: 'Selected Role',
              value: roles.find((role) => role.id === selectedRoleId)?.name || 'None',
              detail: 'Current editing context',
              tone: 'neutral',
            },
            {
              title: 'Routes',
              value: ROUTE_ACCESS_OPTIONS.length,
              detail: 'Route access toggles',
              tone: 'positive',
            },
          ]}
        />
      </Section>

      <Section>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Roles</CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {roles.map(role => (
              <div
                key={role.id}
                className={`rounded border p-3 cursor-pointer ${selectedRoleId === role.id ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-gray-500">{role.description || 'No description'}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {role.parentRoleName && <Badge variant="outline">Parent: {role.parentRoleName}</Badge>}
                      <Badge variant="secondary">Users: {role.userCount || 0}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingRole(role); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!!role.isSystem}
                      onClick={(e) => {
                        e.stopPropagation();
                        // eslint-disable-next-line no-alert
                        if (confirm(`Delete role ${role.name}?`)) {deleteRoleMutation.mutate(role.id);}
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Permission Matrix</CardTitle>
            <Button
              size="sm"
              onClick={() => savePermissionsMutation.mutate()}
              disabled={!selectedRoleId || savePermissionsMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(RBAC_PERMISSION_MODULES).map(([moduleName, codes]) => (
              <div key={moduleName} className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-700">{moduleName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {codes.map(code => {
                    const meta = groupedPermissions.find(p => p.code === code);
                    const checked = selectedPermissionCodes.includes(code);
                    return (
                      <label key={code} className="flex items-start gap-2 rounded border p-2 hover:bg-gray-50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={value => togglePermission(code, value === true)}
                        />
                        <div>
                          <div className="text-sm font-medium">{code}</div>
                          <div className="text-xs text-gray-500">{meta?.description || meta?.module || 'Permission'}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Route Access</CardTitle>
            <Button
              size="sm"
              onClick={() => saveRoutesMutation.mutate()}
              disabled={!selectedRoleId || saveRoutesMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {ROUTE_ACCESS_OPTIONS.map(route => (
              <label key={route.key} className="flex items-center justify-between rounded border p-3 hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium">{route.label}</div>
                  <div className="text-xs text-gray-500">{route.key}</div>
                </div>
                <Checkbox
                  checked={!!selectedRoutes[route.key]}
                  onCheckedChange={value =>
                    setSelectedRoutes(prev => ({ ...prev, [route.key]: value === true }))
                  }
                />
              </label>
            ))}
          </CardContent>
        </Card>
      </div>
      </Section>

      <RoleFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        roles={roles}
        onSubmit={data => createRoleMutation.mutate(data)}
      />

      <RoleFormDialog
        open={!!editingRole}
        onOpenChange={open => !open && setEditingRole(null)}
        roles={roles}
        initialRole={editingRole}
        onSubmit={data => editingRole && updateRoleMutation.mutate({ id: editingRole.id, data })}
      />
    </Page>
  );
}
