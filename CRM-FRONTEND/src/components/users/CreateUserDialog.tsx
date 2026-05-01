import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { createUserFormSchema, type CreateUserFormData } from '@/forms/schemas/user.schema';
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
  Form,
  FormControl,
  FormDescription,
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
import { PasswordPolicyChecklist } from '@/components/users/PasswordPolicyChecklist';
import { usersService } from '@/services/users';
import { rolesService } from '@/services/roles';
import { departmentsService } from '@/services/departments';
import { designationsService } from '@/services/designations';
import type { CreateUserData } from '@/types/user';
import { USER_ROLES } from '@/types/constants';
import { logger } from '@/utils/logger';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      roleId: '',
      departmentId: '',
      employeeId: '',
      designationId: '',
      teamLeaderId: '',
      managerId: '',
    },
  });

  // Fetch roles for dropdown
  const { data: rolesData, isLoading: rolesLoading } = useStandardizedQuery({
    queryKey: ['roles', 'active'],
    queryFn: () => rolesService.getActiveRoles(),
    enabled: open,
    errorContext: 'Loading Roles',
    errorFallbackMessage: 'Failed to load roles',
  });

  // Fetch departments for dropdown
  const { data: departmentsData, isLoading: departmentsLoading } = useStandardizedQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
    enabled: open,
    errorContext: 'Loading Departments',
    errorFallbackMessage: 'Failed to load departments',
  });

  // Fetch designations for dropdown
  const { data: designationsData, isLoading: designationsLoading } = useStandardizedQuery({
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

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateUserFormData) => {
      const cleanData = {
        ...data,
        // roleId can be RBAC UUID (preferred) or legacy numeric string
        roleId: data.roleId || undefined,
        employeeId: data.employeeId,
        // Optional fields - parse to number or undefined
        departmentId: data.departmentId ? parseInt(data.departmentId, 10) : undefined,
        designationId: data.designationId ? parseInt(data.designationId, 10) : undefined,
        teamLeaderId: data.teamLeaderId || undefined,
        managerId: data.managerId || undefined,
      };
      return usersService.createUser(cleanData as CreateUserData);
    },
    queryKey: ['users'],
    resourceName: 'User',
    operation: 'create',
    additionalInvalidateKeys: [['user-stats'], ['dashboard']],
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const roles = rolesData?.data || [];
  const departments = departmentsData?.data || [];
  const designations = designationsData?.data || [];
  const managers = managersData?.data || [];
  const teamLeaders = teamLeadersData?.data || [];
  const selectedRoleId = form.watch('roleId');
  const selectedRoleName = roles
    .find((role) => String(role.id) === selectedRoleId)
    ?.name?.toUpperCase();
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

  const onSubmit = (data: CreateUserFormData) => {
    if (requiresTeamLeader && !data.teamLeaderId) {
      form.setError('teamLeaderId', { message: 'Team Leader is required for this role' });
      return;
    }
    if (requiresManager && !data.managerId) {
      form.setError('managerId', { message: 'Manager is required for this role' });
      return;
    }
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system with appropriate role and permissions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter password" {...field} />
                  </FormControl>
                  <FormDescription>
                    Use a strong password matching all requirements below.
                  </FormDescription>
                  <PasswordPolicyChecklist password={field.value || ''} />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>

                    <Select
                      onValueChange={(value) => {
                        logger.warn('Role selected:', value);
                        field.onChange(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rolesLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading roles...
                          </SelectItem>
                        ) : roles.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            No roles available
                          </SelectItem>
                        ) : (
                          roles.map((role) => (
                            <SelectItem key={role.id} value={String(role.id)}>
                              {role.name}
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

                    <Select
                      onValueChange={(value) => {
                        logger.warn('Designation selected:', value);
                        field.onChange(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select designation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {designationsLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading designations...
                          </SelectItem>
                        ) : designations.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            No designations available
                          </SelectItem>
                        ) : (
                          designations.map((designation) => (
                            <SelectItem key={designation.id} value={String(designation.id)}>
                              {designation.name}
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
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        logger.warn('Department selected:', value);
                        field.onChange(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departmentsLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading departments...
                          </SelectItem>
                        ) : departments.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            No departments available
                          </SelectItem>
                        ) : (
                          departments.map((dept) => (
                            <SelectItem key={dept.id} value={String(dept.id)}>
                              {dept.name}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="teamLeaderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Team Leader{' '}
                      {requiresTeamLeader ? <span className="text-red-500">*</span> : null}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={disableTeamLeader}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              disableTeamLeader
                                ? 'Not applicable for selected role'
                                : 'Select team leader'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teamLeadersLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading team leaders...
                          </SelectItem>
                        ) : teamLeaders.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            No team leaders available
                          </SelectItem>
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
                      Manager {requiresManager ? <span className="text-red-500">*</span> : null}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={disableManager}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              disableManager ? 'Not applicable for selected role' : 'Select manager'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {managersLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading managers...
                          </SelectItem>
                        ) : managers.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            No managers available
                          </SelectItem>
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

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
