import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { departmentsService } from '@/services/departments';
import { usersService } from '@/services/users';
import { UpdateDepartmentRequest, Department } from '@/types/user';

const updateDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100, 'Department name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  departmentHeadId: z.string().optional(),
  isActive: z.boolean(),
});

type UpdateDepartmentFormData = z.infer<typeof updateDepartmentSchema>;

interface EditDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
}

export function EditDepartmentDialog({ open, onOpenChange, department }: EditDepartmentDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<UpdateDepartmentFormData>({
    resolver: zodResolver(updateDepartmentSchema),
    defaultValues: {
      name: '',
      description: '',
      departmentHeadId: '__none__',
      isActive: true,
    },
  });

  // Update form when department changes
  useEffect(() => {
    if (department) {
      form.reset({
        name: department.name,
        description: department.description || '',
        departmentHeadId: department.departmentHeadId || '__none__',
        isActive: department.isActive,
      });
    }
  }, [department, form]);

  // Fetch users for department head selection
  const { data: usersData } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => usersService.getUsers({ isActive: true, limit: 100 }),
    enabled: open,
  });

  // Fetch departments for parent selection (excluding current department)
  // Parent department selection removed as per requirements

  const updateMutation = useMutation({
    mutationFn: (data: UpdateDepartmentRequest) => {
      if (!department) throw new Error('No department selected');
      // Remove empty strings to send null values
      const cleanData = {
        ...data,
        departmentHeadId: data.departmentHeadId || undefined,
      };
      return departmentsService.updateDepartment(department.id, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] }); // Refresh user stats
      toast.success('Department updated successfully');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update department');
    },
  });

  const onSubmit = (data: UpdateDepartmentFormData) => {
    // Convert placeholder values back to null/undefined for API
    const submitData = {
      ...data,
      departmentHeadId: data.departmentHeadId === '__none__' ? undefined : data.departmentHeadId,
    };
    updateMutation.mutate(submitData);
  };

  const users = usersData?.data || [];

  if (!department) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Department: {department.name}</DialogTitle>
          <DialogDescription>
            Modify department information and organizational structure.
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
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Sales" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of this department's responsibilities..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departmentHeadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Head</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department head (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">No department head assigned</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Assign a user to manage this department
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable or disable this department
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Department'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
