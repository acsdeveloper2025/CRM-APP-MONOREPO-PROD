import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { areaFormSchema, type AreaFormData } from '@/forms/schemas/location.schema';
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
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { locationsService } from '@/services/locations';

interface CreateAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAreaDialog({ open, onOpenChange }: CreateAreaDialogProps) {
  const form = useForm<AreaFormData>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const createMutation = useCRUDMutation({
    mutationFn: async (data: AreaFormData) => {
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
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: AreaFormData) => {
    createMutation.mutate(data);
  };

  // B4 fix: route every close path (Cancel, Esc, click-outside, mutation
  // success) through this wrapper so half-filled form doesn't persist
  // across Cancel + reopen.
  const handleOpenChange = (next: boolean) => {
    if (!next && !createMutation.isPending) {
      form.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Area</DialogTitle>
          <DialogDescription>
            Create a new area that can be used across different pincodes. Areas help organize
            localities and neighborhoods.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    The name of the area or locality. This area can be used across multiple
                    pincodes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
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
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Area
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
