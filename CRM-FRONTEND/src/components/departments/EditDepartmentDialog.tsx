import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import {
  editDepartmentFormSchema,
  type EditDepartmentFormData,
} from '@/forms/schemas/department.schema';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { departmentsService } from '@/services/departments';
import type { Department } from '@/types/user';

interface EditDepartmentDialogProps {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDepartmentDialog({
  department,
  open,
  onOpenChange,
}: EditDepartmentDialogProps) {
  const form = useForm<EditDepartmentFormData>({
    resolver: zodResolver(editDepartmentFormSchema),
    defaultValues: {
      name: department.name,
      description: department.description ?? '',
      isActive: department.isActive ?? true,
    },
  });

  useEffect(() => {
    if (department) {
      form.reset({
        name: department.name,
        description: department.description ?? '',
        isActive: department.isActive ?? true,
      });
    }
  }, [department, form]);

  // Reset form to current prop on close so edit-then-cancel-then-reopen of
  // the same record doesn't show dirty values (parent table may not null
  // out the prop on close — Page 2/3/7 canonical close-pattern).
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset({
        name: department.name,
        description: department.description ?? '',
        isActive: department.isActive ?? true,
      });
    }
    onOpenChange(next);
  };

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditDepartmentFormData) =>
      departmentsService.updateDepartment(department.id, {
        name: data.name,
        description: data.description || undefined,
        isActive: data.isActive,
      }),
    queryKey: ['departments'],
    resourceName: 'Department',
    operation: 'update',
    additionalInvalidateKeys: [['department-stats'], ['department', department.id]],
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: EditDepartmentFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>Update the department information.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Operations" {...field} />
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
                    <Textarea rows={3} placeholder="Short description (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive departments are hidden from the Active filter and excluded from new
                      user assignments.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateMutation.isPending ? 'Updating…' : 'Update Department'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
