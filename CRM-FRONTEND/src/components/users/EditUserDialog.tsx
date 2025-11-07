import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { usersService } from '@/services/users';
import { rolesService } from '@/services/roles';
import { departmentsService } from '@/services/departments';
import { designationsService } from '@/services/designations';
import { ClientAssignmentSection } from './ClientAssignmentSection';
import { ProductAssignmentSection } from './ProductAssignmentSection';
import { PincodeAssignmentSection } from './PincodeAssignmentSection';
import { AreaAssignmentSection } from './AreaAssignmentSection';

import { User } from '@/types/user';

const editUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  roleId: z.string().min(1, 'Role is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  designationId: z.string().min(1, 'Designation is required'),
  departmentId: z.string().min(1, 'Department is required'),

  isActive: z.boolean(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      roleId: user.roleId ? String(user.roleId) : '',
      employeeId: user.employeeId,
      designationId: user.designationId ? String(user.designationId) : '',
      departmentId: user.departmentId ? String(user.departmentId) : '',

      isActive: user.isActive ?? false,
    },
  });

  // Fetch roles for dropdown
  const { data: rolesData } = useStandardizedQuery({
    queryKey: ['roles', 'active'],
    queryFn: () => rolesService.getActiveRoles(),
    enabled: open,
    errorContext: 'Loading Roles',
    errorFallbackMessage: 'Failed to load roles',
  });

  // Fetch departments for dropdown
  const { data: departmentsData } = useStandardizedQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
    enabled: open,
    errorContext: 'Loading Departments',
    errorFallbackMessage: 'Failed to load departments',
  });

  // Fetch designations for dropdown
  const { data: designationsData } = useStandardizedQuery({
    queryKey: ['designations', 'active'],
    queryFn: () => designationsService.getActiveDesignations(),
    enabled: open,
    errorContext: 'Loading Designations',
    errorFallbackMessage: 'Failed to load designations',
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        roleId: user.roleId ? String(user.roleId) : '',
        employeeId: user.employeeId,
        designationId: user.designationId ? String(user.designationId) : '',
        departmentId: user.departmentId ? String(user.departmentId) : '',

        isActive: user.isActive ?? false,
      });
    }
  }, [user, form]);

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditUserFormData) => {
      // Convert string IDs to numbers for API
      const cleanData = {
        ...data,
        roleId: data.roleId ? parseInt(data.roleId, 10) : undefined,
        departmentId: data.departmentId ? parseInt(data.departmentId, 10) : undefined,
        designationId: data.designationId ? parseInt(data.designationId, 10) : undefined,
      };
      return usersService.updateUser(user.id, cleanData as any);
    },
    queryKey: ['users'],
    resourceName: 'User',
    operation: 'update',
    additionalInvalidateKeys: [['user-stats'], ['dashboard']],
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditUserFormData) => {
    updateMutation.mutate(data);
  };

  const roles = rolesData?.data || [];
  const departments = departmentsData?.data || [];
  const designations = designationsData?.data || [];





  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and manage permissions.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className={`grid w-full ${user.role === 'BACKEND_USER' ? 'grid-cols-3' : user.role === 'FIELD_AGENT' ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <TabsTrigger value="details">User Details</TabsTrigger>
            {user.role === 'BACKEND_USER' && (
              <>
                <TabsTrigger value="clients">Clients</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </>
            )}
            {user.role === 'FIELD_AGENT' && (
              <>
                <TabsTrigger value="pincodes">Pincodes</TabsTrigger>
                <TabsTrigger value="areas">Areas</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter employee ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="designationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select designation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {designations.map((designation) => (
                          <SelectItem key={designation.id} value={String(designation.id)}>
                            {designation.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      Enable or disable user access to the system
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
                    {updateMutation.isPending ? 'Updating...' : 'Update User'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4 mt-4">
            <ClientAssignmentSection user={user} />
          </TabsContent>

          <TabsContent value="products" className="space-y-4 mt-4">
            <ProductAssignmentSection user={user} />
          </TabsContent>

          <TabsContent value="pincodes" className="space-y-4 mt-4">
            <PincodeAssignmentSection user={user} />
          </TabsContent>

          <TabsContent value="areas" className="space-y-4 mt-4">
            <AreaAssignmentSection user={user} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
