import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { departmentFormSchema, type DepartmentFormData } from '@/forms/schemas/department.schema';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { departmentsService } from '@/services/departments';

interface CreateDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDepartmentDialog({ open, onOpenChange }: CreateDepartmentDialogProps) {
  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset({ name: '', description: '' });
    }
    onOpenChange(next);
  };

  const createMutation = useCRUDMutation({
    mutationFn: (data: DepartmentFormData) =>
      departmentsService.createDepartment({
        name: data.name,
        description: data.description || undefined,
      }),
    queryKey: ['departments'],
    resourceName: 'Department',
    operation: 'create',
    additionalInvalidateKeys: [['department-stats']],
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: DepartmentFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Department</DialogTitle>
          <DialogDescription>Add a new department to organize users.</DialogDescription>
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
                {createMutation.isPending ? 'Creating…' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
