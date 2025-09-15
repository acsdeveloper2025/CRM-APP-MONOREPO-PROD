import React from 'react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { rolesService } from '@/services/roles';
import { CreateRoleRequest, RolePermissions } from '@/types/user';

const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name too long'),
  description: z.string().max(500, 'Description too long').optional(),
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
  }),
});

type CreateRoleFormData = z.infer<typeof createRoleSchema>;

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultPermissions: RolePermissions = {
  users: { create: false, read: false, update: false, delete: false },
  roles: { create: false, read: false, update: false, delete: false },
  departments: { create: false, read: false, update: false, delete: false },
  locations: { create: false, read: false, update: false, delete: false },
  clients: { create: false, read: false, update: false, delete: false },
  cases: { create: false, read: false, update: false, delete: false },
  reports: { create: false, read: false, update: false, delete: false },
  settings: { create: false, read: false, update: false, delete: false },
};

export function CreateRoleDialog({ open, onOpenChange }: CreateRoleDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: defaultPermissions,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRoleRequest) => rolesService.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role created successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create role');
    },
  });

  const onSubmit = (data: CreateRoleFormData) => {
    createMutation.mutate(data);
  };

  const resources = [
    { key: 'users', label: 'Users', description: 'Manage user accounts and profiles' },
    { key: 'roles', label: 'Roles', description: 'Manage roles and permissions' },
    { key: 'departments', label: 'Departments', description: 'Manage organizational departments' },
    { key: 'locations', label: 'Locations', description: 'Manage cities, states, areas, and pincodes' },
    { key: 'clients', label: 'Clients', description: 'Manage client information and relationships' },
    { key: 'cases', label: 'Cases', description: 'Manage cases and case workflows' },
    { key: 'reports', label: 'Reports', description: 'Access and generate reports' },
    { key: 'settings', label: 'Settings', description: 'Manage system settings and configuration' },
  ];

  const actions = [
    { key: 'create', label: 'Create', description: 'Add new records' },
    { key: 'read', label: 'Read', description: 'View and access records' },
    { key: 'update', label: 'Update', description: 'Modify existing records' },
    { key: 'delete', label: 'Delete', description: 'Remove records' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>
            Define a new role with specific permissions for different parts of the application.
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
                      <Input placeholder="e.g., Sales Manager" {...field} />
                    </FormControl>
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
                            name={`permissions.${resource.key}.${action.key}` as any}
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
