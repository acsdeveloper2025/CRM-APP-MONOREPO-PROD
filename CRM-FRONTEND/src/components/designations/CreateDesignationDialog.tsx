import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import {
  designationFormSchema,
  type DesignationFormData,
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
import { designationsService } from '@/services/designations';
import { departmentsService } from '@/services/departments';

interface CreateDesignationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_DEPARTMENT = '__none__';

export function CreateDesignationDialog({ open, onOpenChange }: CreateDesignationDialogProps) {
  const form = useForm<DesignationFormData>({
    resolver: zodResolver(designationFormSchema),
    defaultValues: { name: '', description: '', departmentId: '' },
  });

  // Departments dropdown (active only).
  const { data: departmentsRes } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
    enabled: open,
  });
  const departments = Array.isArray(departmentsRes?.data) ? departmentsRes.data : [];

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset({ name: '', description: '', departmentId: '' });
    }
    onOpenChange(next);
  };

  const createMutation = useCRUDMutation({
    mutationFn: (data: DesignationFormData) =>
      designationsService.createDesignation({
        name: data.name,
        description: data.description || undefined,
        departmentId:
          data.departmentId && data.departmentId !== NO_DEPARTMENT
            ? Number(data.departmentId)
            : undefined,
      }),
    queryKey: ['designations'],
    resourceName: 'Designation',
    operation: 'create',
    additionalInvalidateKeys: [['designation-stats']],
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: DesignationFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Designation</DialogTitle>
          <DialogDescription>
            Add a new designation (job title) and optionally assign it to a department.
          </DialogDescription>
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
                        <SelectValue placeholder="Select department (optional)" />
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

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
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
                {createMutation.isPending ? 'Creating…' : 'Create Designation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
