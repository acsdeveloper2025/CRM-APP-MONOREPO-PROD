import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import {
  createVerificationTypeFormSchema,
  type CreateVerificationTypeFormData,
} from '@/forms/schemas/client.schema';
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
import { verificationTypesService } from '@/services/verificationTypes';

interface CreateVerificationTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVerificationTypeDialog({
  open,
  onOpenChange,
}: CreateVerificationTypeDialogProps) {
  const form = useForm<CreateVerificationTypeFormData>({
    resolver: zodResolver(createVerificationTypeFormSchema),
    defaultValues: {
      name: '',
      code: '',
      category: 'General',
    },
  });

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateVerificationTypeFormData) =>
      verificationTypesService.createVerificationType({
        name: data.name,
        code: data.code,
        category: data.category,
      }),
    queryKey: ['verification-types'],
    resourceName: 'Verification Type',
    operation: 'create',
    additionalInvalidateKeys: [['verification-types-stats'], ['dashboard']],
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CreateVerificationTypeFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Verification Type</DialogTitle>
          <DialogDescription>
            Create a standalone verification type that can be assigned to products later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Type Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., RESIDENCE_VERIFICATION" {...field} />
                  </FormControl>
                  <FormDescription>Unique identifier for this verification type</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Type Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter verification type name" {...field} />
                  </FormControl>
                  <FormDescription>
                    The name of the verification type (e.g., &quot;Residence Verification&quot;,
                    &quot;Office Verification&quot;)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
