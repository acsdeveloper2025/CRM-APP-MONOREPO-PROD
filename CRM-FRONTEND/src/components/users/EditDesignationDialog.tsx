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
import { designationsService } from '@/services/designations';
import { departmentsService } from '@/services/departments';
import { UpdateDesignationRequest, Designation } from '@/types/user';

const updateDesignationSchema = z.object({
  name: z.string().min(1, 'Designation name is required').max(100, 'Designation name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  departmentId: z.string().optional(),
  isActive: z.boolean(),
});

type UpdateDesignationFormData = z.infer<typeof updateDesignationSchema>;

interface EditDesignationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designation: Designation | null;
}

export function EditDesignationDialog({ open, onOpenChange, designation }: EditDesignationDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<UpdateDesignationFormData>({
    resolver: zodResolver(updateDesignationSchema),
    defaultValues: {
      name: '',
      description: '',
      departmentId: '',
      isActive: true,
    },
  });

  // Update form when designation changes
  useEffect(() => {
    if (designation) {
      form.reset({
        name: designation.name,
        description: designation.description || '',
        departmentId: designation.departmentId || '__all__',
        isActive: designation.isActive,
      });
    }
  }, [designation, form]);

  // Fetch departments for selection
  const { data: departmentsData } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateDesignationRequest) => {
      if (!designation) throw new Error('No designation selected');
      return designationsService.updateDesignation(designation.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      toast.success('Designation updated successfully');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update designation');
    },
  });

  const onSubmit = (data: UpdateDesignationFormData) => {
    const submitData: UpdateDesignationRequest = {
      name: data.name,
      description: data.description || undefined,
      departmentId: data.departmentId === "__all__" ? undefined : data.departmentId || undefined,
      isActive: data.isActive,
    };
    updateMutation.mutate(submitData);
  };

  const departments = departmentsData?.data || [];

  if (!designation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Designation: {designation.name}</DialogTitle>
          <DialogDescription>
            Modify designation details and department association.
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
                    <FormLabel>Designation Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Software Engineer" {...field} />
                    </FormControl>
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
                          <SelectValue placeholder="Select department (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__all__">All departments</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Leave empty to make this designation available across all departments
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
                      placeholder="Brief description of this designation's responsibilities and role..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide a clear description of the designation's role and responsibilities
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
                      Enable or disable this designation
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
                {updateMutation.isPending ? 'Updating...' : 'Update Designation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
