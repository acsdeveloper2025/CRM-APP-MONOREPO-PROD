import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
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
import { Button } from '@/ui/components/button';
import { Stack } from '@/ui/primitives/Stack';
import { Loader2 } from 'lucide-react';
import { locationsService } from '@/services/locations';

const createAreaSchema = z.object({
  name: z.string()
    .min(2, 'Area name must be at least 2 characters')
    .max(100, 'Area name must be less than 100 characters'),
});

type CreateAreaFormData = z.infer<typeof createAreaSchema>;

interface CreateAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAreaDialog({ open, onOpenChange }: CreateAreaDialogProps) {
  const form = useForm<CreateAreaFormData>({
    resolver: zodResolver(createAreaSchema),
    defaultValues: {
      name: '',
    },
  });

  const createMutation = useCRUDMutation({
    mutationFn: async (data: CreateAreaFormData) => {
      // Validate data before sending
      if (!data.name || data.name.trim() === '') {
        throw new Error('Please enter a valid area name');
      }

      // Create standalone area
      return locationsService.createArea({
        name: data.name.trim(),
      });
    },
    queryKey: ['areas'],
    resourceName: 'Area',
    operation: 'create',
    additionalInvalidateKeys: [['pincodes']],
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CreateAreaFormData) => {
    createMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent style={{ width: 'min(95vw, 500px)' }}>
        <DialogHeader>
          <DialogTitle>Create New Area</DialogTitle>
          <DialogDescription>
            Create a new area that can be used across different pincodes. Areas help organize localities and neighborhoods.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Stack gap={4}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter area name (e.g., Andheri East, Sector 1, Downtown, etc.)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The name of the area or locality. This area can be used across multiple pincodes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter style={{ display: 'flex', gap: 'var(--ui-gap-2)', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  fullWidth
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={createMutation.isPending}
                  icon={createMutation.isPending ? <Loader2 size={16} /> : undefined}
                >
                  Create Area
                </Button>
              </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
