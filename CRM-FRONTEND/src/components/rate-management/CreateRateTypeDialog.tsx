import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { rateTypeFormSchema, type RateTypeFormData } from '@/forms/schemas/rateType.schema';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { rateTypesService, type CreateRateTypeData } from '@/services/rateTypes';

interface CreateRateTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRateTypeDialog({ open, onOpenChange }: CreateRateTypeDialogProps) {
  const form = useForm<RateTypeFormData>({
    resolver: zodResolver(rateTypeFormSchema),
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
    },
  });

  const createMutation = useMutationWithInvalidation({
    mutationFn: (data: CreateRateTypeData) => rateTypesService.createRateType(data),
    invalidateKeys: [['rate-types'], ['rate-management-stats']],
    // Backend POST upserts on (name) — may create or update depending on
    // whether the name exists. Toast phrasing stays neutral for both.
    successMessage: 'Rate type saved successfully',
    errorContext: 'Rate Type Creation',
    errorFallbackMessage: 'Failed to save rate type',
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit: SubmitHandler<RateTypeFormData> = (data) => {
    createMutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !createMutation.isPending) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  // Predefined rate type suggestions
  const predefinedRateTypes = [
    { name: 'Local', description: 'Local area verification rates' },
    { name: 'Local1', description: 'Local area verification rates - Type 1' },
    { name: 'Local2', description: 'Local area verification rates - Type 2' },
    { name: 'OGL', description: 'Out of Geolocation verification rates' },
    { name: 'OGL1', description: 'Out of Geolocation verification rates - Type 1' },
    { name: 'OGL2', description: 'Out of Geolocation verification rates - Type 2' },
    { name: 'Outstation', description: 'Outstation verification rates' },
  ];

  const fillPredefinedRateType = (rateType: { name: string; description: string }) => {
    form.setValue('name', rateType.name);
    form.setValue('description', rateType.description);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Rate Type</DialogTitle>
          <DialogDescription>
            Create a new rate type for verification services. You can use predefined types or create
            custom ones.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Predefined Rate Types */}
            <div className="space-y-3">
              <FormLabel>Quick Select (Predefined Rate Types)</FormLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {predefinedRateTypes.map((rateType) => (
                  <Button
                    key={rateType.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fillPredefinedRateType(rateType)}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">{rateType.name}</div>
                      <div className="text-xs text-gray-600">{rateType.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Type Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter rate type name" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique name for this rate type (e.g., Local, OGL, Outstation)
                  </FormDescription>
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
                    <Textarea
                      placeholder="Enter description for this rate type"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description explaining when this rate type is used
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Enable this rate type for use in assignments and rate setting
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
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
                {createMutation.isPending ? 'Creating...' : 'Create Rate Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
