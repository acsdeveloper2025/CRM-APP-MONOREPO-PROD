import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import {
  editVerificationTypeFormSchema,
  type EditVerificationTypeFormData,
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
import { clientsService } from '@/services/clients';
import { VerificationType } from '@/types/client';

interface EditVerificationTypeDialogProps {
  verificationType: VerificationType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditVerificationTypeDialog({
  verificationType,
  open,
  onOpenChange,
}: EditVerificationTypeDialogProps) {
  const form = useForm<EditVerificationTypeFormData>({
    resolver: zodResolver(editVerificationTypeFormSchema),
    defaultValues: {
      name: verificationType.name,
      code: verificationType.code || '',
    },
  });

  useEffect(() => {
    if (verificationType) {
      form.reset({
        name: verificationType.name,
        code: verificationType.code || '',
      });
    }
  }, [verificationType, form]);

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditVerificationTypeFormData) =>
      clientsService.updateVerificationType(verificationType.id, data),
    queryKey: ['verification-types'],
    resourceName: 'Verification Type',
    operation: 'update',
    additionalInvalidateKeys: [['verification-types-stats'], ['dashboard']],
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditVerificationTypeFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Verification Type</DialogTitle>
          <DialogDescription>Update the verification type information.</DialogDescription>
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
                  <FormDescription>The name of the verification type</FormDescription>
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
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
