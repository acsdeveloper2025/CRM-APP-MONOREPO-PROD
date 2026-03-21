import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/form';
import { Input } from '@/ui/components/input';
import { Stack } from '@/ui/primitives/Stack';
import { clientsService } from '@/services/clients';
import { VerificationType } from '@/types/client';

const editVerificationTypeSchema = z.object({
  name: z.string().min(1, 'Verification type name is required').max(100, 'Name too long'),
  code: z.string().min(2, 'Code is required').max(50, 'Code too long'),
});

type EditVerificationTypeFormData = z.infer<typeof editVerificationTypeSchema>;

interface EditVerificationTypeDialogProps {
  verificationType: VerificationType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditVerificationTypeDialog({ verificationType, open, onOpenChange }: EditVerificationTypeDialogProps) {
  const form = useForm<EditVerificationTypeFormData>({
    resolver: zodResolver(editVerificationTypeSchema),
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
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Edit Verification Type</DialogTitle>
          <DialogDescription>
            Update the verification type information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Stack gap={4}>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Type Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., RESIDENCE_VERIFICATION"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for this verification type
                  </FormDescription>
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
                    <Input
                      placeholder="Enter verification type name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The name of the verification type
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                fullWidth
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                fullWidth>
                {updateMutation.isPending ? 'Updating...' : 'Update Type'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
