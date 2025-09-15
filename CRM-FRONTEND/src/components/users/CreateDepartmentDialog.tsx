import React from 'react';
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
import { toast } from 'sonner';
import { departmentsService } from '@/services/departments';
import { usersService } from '@/services/users';
import { CreateDepartmentRequest } from '@/types/user';

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100, 'Department name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  departmentHeadId: z.string().optional(),
});

type CreateDepartmentFormData = z.infer<typeof createDepartmentSchema>;

interface CreateDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDepartmentDialog({ open, onOpenChange }: CreateDepartmentDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateDepartmentFormData>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: '',
      description: '',
      departmentHeadId: '__none__',
    },
  });

  // Fetch users for department head selection
  const { data: usersData } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => usersService.getUsers({ isActive: true, limit: 100 }),
    enabled: open,
  });



  const createMutation = useMutation({
    mutationFn: (data: CreateDepartmentRequest) => {
      // Remove empty strings to send null values
      const cleanData = {
        ...data,
        departmentHeadId: data.departmentHeadId || undefined,
      };
      return departmentsService.createDepartment(cleanData);
    },
    onSuccess: (data) => {
      // Invalidate all department-related queries
      queryClient.invalidateQueries({
        queryKey: ['departments'],
        exact: false // This will invalidate all queries that start with ['departments']
      });

      // Specifically invalidate the active departments query used in this dialog
      queryClient.invalidateQueries({
        queryKey: ['departments', 'active']
      });

      queryClient.invalidateQueries({ queryKey: ['users'] }); // Refresh user stats

      // Also refetch the departments queries immediately
      queryClient.refetchQueries({
        queryKey: ['departments'],
        exact: false
      });

      toast.success('Department created successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to create department';
      const errorCode = error.response?.data?.error?.code;

      // Show specific error messages for different error types
      if (errorCode === 'DUPLICATE_DEPARTMENT_NAME') {
        toast.error('A department with this name already exists. Please choose a different name.');
      } else if (errorCode === 'VALIDATION_ERROR') {
        toast.error('Please check all required fields and try again.');
      } else {
        toast.error(errorMessage);
      }

      console.error('Department creation error:', error.response?.data || error);
    },
  });

  const onSubmit = (data: CreateDepartmentFormData) => {
    // Convert placeholder values back to null/undefined for API
    const submitData = {
      ...data,
      departmentHeadId: data.departmentHeadId === '__none__' ? undefined : data.departmentHeadId,
    };


    createMutation.mutate(submitData);
  };

  const users = usersData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Department</DialogTitle>
          <DialogDescription>
            Add a new department to organize your team structure.
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
                    <FormDescription>
                      Must be unique across all departments
                    </FormDescription>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                {createMutation.isPending ? 'Creating...' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
