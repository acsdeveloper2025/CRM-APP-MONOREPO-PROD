import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { rolesService } from '@/services/roles';
import { UpdateRoleRequest, RoleData } from '@/types/user';

const updateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  isActive: z.boolean(),
  permissions: z.object({
    users: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    roles: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    departments: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    locations: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    clients: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    cases: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    reports: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    settings: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    products: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    verification_types: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    document_types: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    rate_management: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    commissions: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    billing: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    forms: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    analytics: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    tasks: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    designations: z.object({
      create: z.boolean(),
      read: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
  }),
});

type UpdateRoleFormData = z.infer<typeof updateRoleSchema>;

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleData | null;
}

export function EditRoleDialog({ open, onOpenChange, role }: EditRoleDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<UpdateRoleFormData>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
      permissions: {
        users: { create: false, read: false, update: false, delete: false },
        roles: { create: false, read: false, update: false, delete: false },
        departments: { create: false, read: false, update: false, delete: false },
        locations: { create: false, read: false, update: false, delete: false },
        clients: { create: false, read: false, update: false, delete: false },
        cases: { create: false, read: false, update: false, delete: false },
        reports: { create: false, read: false, update: false, delete: false },
        settings: { create: false, read: false, update: false, delete: false },
        products: { create: false, read: false, update: false, delete: false },
        verification_types: { create: false, read: false, update: false, delete: false },
        document_types: { create: false, read: false, update: false, delete: false },
        rate_management: { create: false, read: false, update: false, delete: false },
        commissions: { create: false, read: false, update: false, delete: false },
        billing: { create: false, read: false, update: false, delete: false },
        forms: { create: false, read: false, update: false, delete: false },
        analytics: { create: false, read: false, update: false, delete: false },
        tasks: { create: false, read: false, update: false, delete: false },
        designations: { create: false, read: false, update: false, delete: false },
      },
    },
  });

  // Update form when role changes
  useEffect(() => {
    if (role) {
      // Merge role permissions with default structure to ensure all resources are present
      const defaultPermissions = {
        users: { create: false, read: false, update: false, delete: false },
        roles: { create: false, read: false, update: false, delete: false },
        departments: { create: false, read: false, update: false, delete: false },
        locations: { create: false, read: false, update: false, delete: false },
        clients: { create: false, read: false, update: false, delete: false },
        cases: { create: false, read: false, update: false, delete: false },
        reports: { create: false, read: false, update: false, delete: false },
        settings: { create: false, read: false, update: false, delete: false },
        products: { create: false, read: false, update: false, delete: false },
        verification_types: { create: false, read: false, update: false, delete: false },
        document_types: { create: false, read: false, update: false, delete: false },
        rate_management: { create: false, read: false, update: false, delete: false },
        commissions: { create: false, read: false, update: false, delete: false },
        billing: { create: false, read: false, update: false, delete: false },
        forms: { create: false, read: false, update: false, delete: false },
        analytics: { create: false, read: false, update: false, delete: false },
        tasks: { create: false, read: false, update: false, delete: false },
        designations: { create: false, read: false, update: false, delete: false },
      };

      // Merge existing permissions with defaults
      const mergedPermissions = { ...defaultPermissions };
      Object.keys(role.permissions).forEach((resource) => {
        if (mergedPermissions[resource as keyof typeof mergedPermissions]) {
          mergedPermissions[resource as keyof typeof mergedPermissions] = {
            ...defaultPermissions[resource as keyof typeof defaultPermissions],
            ...role.permissions[resource as keyof typeof role.permissions],
          };
        }
      });

      form.reset({
        name: role.name,
        description: role.description || '',
        isActive: role.isActive,
        permissions: mergedPermissions,
      });
    }
  }, [role, form]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRoleRequest) => {
      if (!role) {throw new Error('No role selected');}
      return rolesService.updateRole(role.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role updated successfully');
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(error.response?.data?.message || 'Failed to update role');
    },
  });

  const onSubmit = (data: UpdateRoleFormData) => {
    updateMutation.mutate(data);
  };

  const resources = [
    { key: 'users', label: 'Users', description: 'Manage user accounts and profiles' },
    { key: 'roles', label: 'Roles', description: 'Manage roles and permissions' },
    { key: 'departments', label: 'Departments', description: 'Manage organizational departments' },
    { key: 'designations', label: 'Designations', description: 'Manage job designations and titles' },
    { key: 'locations', label: 'Locations', description: 'Manage cities, states, areas, and pincodes' },
    { key: 'clients', label: 'Clients', description: 'Manage client information and relationships' },
    { key: 'products', label: 'Products', description: 'Manage products and services' },
    { key: 'verification_types', label: 'Verification Types', description: 'Manage verification type configurations' },
    { key: 'document_types', label: 'Document Types', description: 'Manage document type configurations' },
    { key: 'rate_management', label: 'Rate Management', description: 'Manage pricing and rates' },
    { key: 'cases', label: 'Cases', description: 'Manage cases and case workflows' },
    { key: 'tasks', label: 'Tasks', description: 'Manage verification tasks' },
    { key: 'forms', label: 'Forms', description: 'Access and manage form submissions' },
    { key: 'reports', label: 'Reports', description: 'Access and generate reports' },
    { key: 'analytics', label: 'Analytics', description: 'Access analytics and MIS dashboard' },
    { key: 'billing', label: 'Billing', description: 'Manage billing and invoices' },
    { key: 'commissions', label: 'Commissions', description: 'Manage commission calculations and payments' },
    { key: 'settings', label: 'Settings', description: 'Manage system settings and configuration' },
  ];

  const actions = [
    { key: 'create', label: 'Create', description: 'Add new records' },
    { key: 'read', label: 'Read', description: 'View and access records' },
    { key: 'update', label: 'Update', description: 'Modify existing records' },
    { key: 'delete', label: 'Delete', description: 'Remove records' },
  ];

  if (!role) {return null;}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Role: {role.name}</DialogTitle>
          <DialogDescription>
            Modify role permissions and settings. {role.isSystemRole && 'Note: This is a system role - name changes are restricted.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Sales Manager" 
                        disabled={role.isSystemRole}
                        {...field} 
                      />
                    </FormControl>
                    {role.isSystemRole && (
                      <p className="text-xs text-gray-600">System role names cannot be changed</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of this role..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <div className="text-sm text-gray-600">
                      Enable or disable this role
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div>
              <h3 className="text-lg font-medium mb-4">Permissions</h3>
              <div className="space-y-4">
                {resources.map((resource) => (
                  <Card key={resource.key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{resource.label}</CardTitle>
                      <CardDescription>{resource.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {actions.map((action) => (
                          <FormField
                            key={`${resource.key}.${action.key}`}
                            control={form.control}
                            name={`permissions.${resource.key}.${action.key}` as unknown}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-normal">
                                    {action.label}
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto">
                {updateMutation.isPending ? 'Updating...' : 'Update Role'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
