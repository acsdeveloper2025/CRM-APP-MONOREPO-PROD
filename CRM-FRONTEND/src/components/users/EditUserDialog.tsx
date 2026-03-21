import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { Button } from '@/ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/Form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { Input } from '@/ui/components/Input';
import { Switch } from '@/ui/components/Switch';
import { usersService } from '@/services/users';
import { rolesService } from '@/services/roles';
import { departmentsService } from '@/services/departments';
import { designationsService } from '@/services/designations';
import { USER_ROLES } from '@/types/constants';
import { User } from '@/types/user';

const editUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  roleId: z.string().min(1, 'Role is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  designationId: z.string().min(1, 'Designation is required'),
  departmentId: z.string().min(1, 'Department is required'),
  teamLeaderId: z.string().optional(),
  managerId: z.string().optional(),
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
      teamLeaderId: user.teamLeaderId || '',
      managerId: user.managerId || '',
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

  const { data: managersData, isLoading: managersLoading } = useStandardizedQuery({
    queryKey: ['users', 'hierarchy', 'managers'],
    queryFn: () => usersService.getUsers({ role: USER_ROLES.MANAGER, isActive: true, limit: 200 }),
    enabled: open,
    errorContext: 'Loading Managers',
    errorFallbackMessage: 'Failed to load managers',
  });

  const { data: teamLeadersData, isLoading: teamLeadersLoading } = useStandardizedQuery({
    queryKey: ['users', 'hierarchy', 'team-leaders'],
    queryFn: () =>
      usersService.getUsers({ role: USER_ROLES.TEAM_LEADER, isActive: true, limit: 200 }),
    enabled: open,
    errorContext: 'Loading Team Leaders',
    errorFallbackMessage: 'Failed to load team leaders',
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
        teamLeaderId: user.teamLeaderId || '',
        managerId: user.managerId || '',
        isActive: user.isActive ?? false,
      });
    }
  }, [user, form]);

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditUserFormData) => {
      const cleanData = {
        ...data,
        roleId: data.roleId || undefined,
        departmentId: data.departmentId ? parseInt(data.departmentId, 10) : undefined,
        designationId: data.designationId ? parseInt(data.designationId, 10) : undefined,
        teamLeaderId: data.teamLeaderId || null,
        managerId: data.managerId || null,
      };
      return usersService.updateUser(user.id, cleanData as import('@/types/user').UpdateUserData);
    },
    queryKey: ['users'],
    resourceName: 'User',
    operation: 'update',
    additionalInvalidateKeys: [['user-stats'], ['dashboard']],
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const roles = rolesData?.data || [];
  const departments = departmentsData?.data || [];
  const designations = designationsData?.data || [];
  const managers = managersData?.data || [];
  const teamLeaders = teamLeadersData?.data || [];
  const selectedRoleId = form.watch('roleId');
  const selectedRoleName = roles.find(role => String(role.id) === selectedRoleId)?.name?.toUpperCase();
  const requiresTeamLeader =
    selectedRoleName === USER_ROLES.FIELD_AGENT || selectedRoleName === USER_ROLES.BACKEND_USER;
  const requiresManager = requiresTeamLeader || selectedRoleName === USER_ROLES.TEAM_LEADER;
  const disableTeamLeader = !requiresTeamLeader;
  const disableManager =
    selectedRoleName === USER_ROLES.MANAGER || selectedRoleName === USER_ROLES.SUPER_ADMIN;

  useEffect(() => {
    if (disableTeamLeader) {
      form.setValue('teamLeaderId', '');
      form.clearErrors('teamLeaderId');
    }
    if (disableManager) {
      form.setValue('managerId', '');
      form.clearErrors('managerId');
    }
  }, [disableManager, disableTeamLeader, form]);

  const onSubmit = (data: EditUserFormData) => {
    if (requiresTeamLeader && !data.teamLeaderId) {
      form.setError('teamLeaderId', { message: 'Team Leader is required for this role' });
      return;
    }
    if (requiresManager && !data.managerId) {
      form.setError('managerId', { message: 'Manager is required for this role' });
      return;
    }
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...{ className: "max-w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto" }}>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information. Use &quot;Manage Permissions&quot; to assign clients, products, pincodes, or areas.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} {...{ className: "space-y-4" }}>
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

            <div {...{ className: "grid grid-cols-1 sm:grid-cols-2 gap-4" }}>
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

            <div {...{ className: "grid grid-cols-1 sm:grid-cols-2 gap-4" }}>
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

            <div {...{ className: "grid grid-cols-1 sm:grid-cols-2 gap-4" }}>
              <FormField
                control={form.control}
                name="teamLeaderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Team Leader {requiresTeamLeader ? <span {...{ className: "text-red-500" }}>*</span> : null}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={disableTeamLeader}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={disableTeamLeader ? 'Not applicable for selected role' : 'Select team leader'}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teamLeadersLoading ? (
                          <SelectItem value="loading" disabled>Loading team leaders...</SelectItem>
                        ) : teamLeaders.length === 0 ? (
                          <SelectItem value="empty" disabled>No team leaders available</SelectItem>
                        ) : (
                          teamLeaders.map((leader) => (
                            <SelectItem key={leader.id} value={leader.id}>
                              {leader.name} ({leader.employeeId})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Manager {requiresManager ? <span {...{ className: "text-red-500" }}>*</span> : null}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={disableManager}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={disableManager ? 'Not applicable for selected role' : 'Select manager'}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {managersLoading ? (
                          <SelectItem value="loading" disabled>Loading managers...</SelectItem>
                        ) : managers.length === 0 ? (
                          <SelectItem value="empty" disabled>No managers available</SelectItem>
                        ) : (
                          managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.name} ({manager.employeeId})
                            </SelectItem>
                          ))
                        )}
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
                <FormItem {...{ className: "flex flex-row items-center justify-between rounded-lg border p-4" }}>
                  <div {...{ className: "space-y-0.5" }}>
                    <FormLabel {...{ className: "text-base" }}>Active Status</FormLabel>
                    <div {...{ className: "text-sm text-gray-600" }}>
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

            <DialogFooter {...{ className: "flex-col sm:flex-row gap-2" }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                {...{ className: "w-full sm:w-auto" }}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} {...{ className: "w-full sm:w-auto" }}>
                {updateMutation.isPending ? 'Updating...' : 'Update User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
