import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
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
import { Switch } from '@/components/ui/switch';
import { editAreaFormSchema, type EditAreaFormData } from '@/forms/schemas/location.schema';
import { locationsService } from '@/services/locations';
import type { Area } from '@/types/location';

interface EditAreaDialogProps {
  area: Area;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAreaDialog({ area, open, onOpenChange }: EditAreaDialogProps) {
  const form = useForm<EditAreaFormData>({
    resolver: zodResolver(editAreaFormSchema),
    defaultValues: {
      name: area.name,
      isActive: area.isActive ?? true,
    },
  });

  useEffect(() => {
    form.reset({
      name: area.name,
      isActive: area.isActive ?? true,
    });
  }, [area, form]);

  const updateMutation = useMutationWithInvalidation({
    mutationFn: (data: EditAreaFormData) =>
      locationsService.updateArea(String(area.id), {
        name: data.name,
        isActive: data.isActive,
      }),
    invalidateKeys: [['areas'], ['pincodes'], ['area-stats']],
    successMessage: 'Area updated successfully',
    errorContext: 'Area Update',
    errorFallbackMessage: 'Failed to update area',
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: EditAreaFormData) => {
    updateMutation.mutate(data);
  };

  // B4 fix: parent table renders `<EditAreaDialog area={areaToEdit} open=... />`
  // without nulling areaToEdit on close. Re-opening Edit on the same row keeps
  // the same `area` prop reference → useEffect [area, form] doesn't re-fire →
  // dirty form state persists. Reset on close prevents that.
  const handleOpenChange = (next: boolean) => {
    if (!next && !updateMutation.isPending) {
      form.reset({
        name: area.name,
        isActive: area.isActive ?? true,
      });
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Area</DialogTitle>
          <DialogDescription>
            Update the area name. This will affect all pincodes using this area.
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
                    <Input placeholder="Enter area name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {area.usageCount !== undefined && area.usageCount > 0 && (
              <p className="text-sm text-muted-foreground">
                This area is currently used in {area.usageCount} pincode(s).
              </p>
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive areas are hidden from the Active filter.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
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
                {updateMutation.isPending ? 'Updating...' : 'Update Area'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
