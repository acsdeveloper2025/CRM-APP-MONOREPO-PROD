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
} from '@/ui/components/Dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/form';
import { Input } from '@/ui/components/Input';
import { Stack } from '@/ui/primitives/Stack';
import { verificationTypesService } from '@/services/verificationTypes';

const createVerificationTypeSchema = z.object({
  name: z.string().min(1, 'Verification type name is required').max(100, 'Name too long'),
  code: z.string().min(2, 'Code is required').max(50, 'Code too long'),
  category: z.string().min(1, 'Category is required'), // Explicit string validation
});

type CreateVerificationTypeFormData = z.infer<typeof createVerificationTypeSchema>;

interface CreateVerificationTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVerificationTypeDialog({ open, onOpenChange }: CreateVerificationTypeDialogProps) {
  const form = useForm<CreateVerificationTypeFormData>({
    resolver: zodResolver(createVerificationTypeSchema),
    defaultValues: {
      name: '',
      code: '',
      category: 'General',
    },
  });

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateVerificationTypeFormData) => verificationTypesService.createVerificationType({
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
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Create New Verification Type</DialogTitle>
          <DialogDescription>
            Create a standalone verification type that can be assigned to products later.
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
                    <Input placeholder="e.g., RESIDENCE_VERIFICATION" {...field} />
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
                    The name of the verification type (e.g., &quot;Residence Verification&quot;, &quot;Office Verification&quot;)
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
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                fullWidth>
                {createMutation.isPending ? 'Creating...' : 'Create Type'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
