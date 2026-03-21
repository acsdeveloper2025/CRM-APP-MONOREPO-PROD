import { useForm, type SubmitHandler } from 'react-hook-form';
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
import { Textarea } from '@/ui/components/Textarea';
import { Switch } from '@/ui/components/Switch';
import { Button } from '@/ui/components/Button';
import { rateTypesService, type CreateRateTypeData } from '@/services/rateTypes';

const createRateTypeSchema = z.object({
  name: z.string().min(1, 'Rate type name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  isActive: z.boolean(),
});

type CreateRateTypeFormData = z.infer<typeof createRateTypeSchema>;

interface CreateRateTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRateTypeDialog({ open, onOpenChange }: CreateRateTypeDialogProps) {
  const form = useForm<CreateRateTypeFormData>({
    resolver: zodResolver(createRateTypeSchema),
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
    },
  });

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateRateTypeData) => rateTypesService.createRateType(data),
    queryKey: ['rate-types'],
    resourceName: 'Rate Type',
    operation: 'create',
    additionalInvalidateKeys: [['rate-management-stats']],
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit: SubmitHandler<CreateRateTypeFormData> = (data) => {
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
      <DialogContent {...{ className: "max-w-[95vw] sm:max-w-[600px]" }}>
        <DialogHeader>
          <DialogTitle>Create Rate Type</DialogTitle>
          <DialogDescription>
            Create a new rate type for verification services. You can use predefined types or create custom ones.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} {...{ className: "space-y-6" }}>
            {/* Predefined Rate Types */}
            <div {...{ className: "space-y-3" }}>
              <FormLabel>Quick Select (Predefined Rate Types)</FormLabel>
              <div {...{ className: "grid grid-cols-1 sm:grid-cols-2 gap-2" }}>
                {predefinedRateTypes.map((rateType) => (
                  <Button
                    key={rateType.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fillPredefinedRateType(rateType)}
                    {...{ className: "justify-start text-left h-auto p-3" }}
                  >
                    <div>
                      <div {...{ className: "font-medium" }}>{rateType.name}</div>
                      <div {...{ className: "text-xs text-gray-600" }}>{rateType.description}</div>
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
                      {...{ className: "resize-none" }}
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
                <FormItem {...{ className: "flex flex-row items-center justify-between rounded-lg border p-4" }}>
                  <div {...{ className: "space-y-0.5" }}>
                    <FormLabel {...{ className: "text-base" }}>Active Status</FormLabel>
                    <FormDescription>
                      Enable this rate type for use in assignments and rate setting
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter {...{ className: "flex-col sm:flex-row gap-2" }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                {...{ className: "w-full sm:w-auto" }}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} {...{ className: "w-full sm:w-auto" }}>
                {createMutation.isPending ? 'Creating...' : 'Create Rate Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
