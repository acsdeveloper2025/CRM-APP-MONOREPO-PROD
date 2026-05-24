import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import {
  editDesignationFormSchema,
  type EditDesignationFormData,
} from '@/forms/schemas/designation.schema';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { designationsService } from '@/services/designations';
import { departmentsService } from '@/services/departments';
import type { Designation } from '@/types/user';

interface EditDesignationDialogProps {
  designation: Designation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_DEPARTMENT = '__none__';

export function EditDesignationDialog({
  designation,
  open,
  onOpenChange,
}: EditDesignationDialogProps) {
  const form = useForm<EditDesignationFormData>({
    resolver: zodResolver(editDesignationFormSchema),
    defaultValues: {
      name: designation.name,
      description: designation.description ?? '',
      departmentId: designation.departmentId ? String(designation.departmentId) : '',
      isActive: designation.isActive ?? true,
    },
  });

  // Departments dropdown.
  const { data: departmentsRes } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
    enabled: open,
  });
  const departments = Array.isArray(departmentsRes?.data) ? departmentsRes.data : [];

  useEffect(() => {
    if (designation) {
      form.reset({
        name: designation.name,
        description: designation.description ?? '',
        departmentId: designation.departmentId ? String(designation.departmentId) : '',
        isActive: designation.isActive ?? true,
      });
    }
  }, [designation, form]);

  // Reset form to current prop on close so edit-then-cancel-then-reopen of
  // the same record doesn't show dirty values (Page 2/3/7 canonical pattern).
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset({
        name: designation.name,
        description: designation.description ?? '',
        departmentId: designation.departmentId ? String(designation.departmentId) : '',
        isActive: designation.isActive ?? true,
      });
    }
    onOpenChange(next);
  };

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditDesignationFormData) =>
      designationsService.updateDesignation(designation.id, {
        name: data.name,
        description: data.description || undefined,
        departmentId:
          data.departmentId && data.departmentId !== NO_DEPARTMENT
            ? Number(data.departmentId)
            : undefined,
        isActive: data.isActive,
      }),
    queryKey: ['designations'],
    resourceName: 'Designation',
    operation: 'update',
    additionalInvalidateKeys: [['designation-stats'], ['designation', designation.id]],
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: EditDesignationFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Designation</DialogTitle>
          <DialogDescription>Update the designation information.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Senior Verifier" {...field} />
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
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    value={field.value || NO_DEPARTMENT}
                    onValueChange={(v) => field.onChange(v === NO_DEPARTMENT ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
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
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive designations are hidden from the Active filter and excluded from new
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
                {updateMutation.isPending ? 'Updating…' : 'Update Designation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
