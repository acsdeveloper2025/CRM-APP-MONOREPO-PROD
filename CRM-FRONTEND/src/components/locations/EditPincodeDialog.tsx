import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { Button } from '@/ui/components/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import { Input } from '@/ui/components/input';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';
import { Pincode } from '@/types/location';
import { EnhancedAreasMultiSelect } from './EnhancedAreasMultiSelect';

const editPincodeSchema = z.object({
  code: z.string()
    .min(6, 'Pincode must be 6 digits')
    .max(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only numbers'),
  areas: z.array(z.string()).min(1, 'At least one area must be selected').max(15, 'Maximum 15 areas allowed'),
  cityId: z.string().min(1, 'City selection is required'),
});

type EditPincodeFormData = z.infer<typeof editPincodeSchema>;

interface EditPincodeDialogProps {
  pincode: Pincode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPincodeDialog({ pincode, open, onOpenChange }: EditPincodeDialogProps) {
  const form = useForm<EditPincodeFormData>({
    resolver: zodResolver(editPincodeSchema),
    defaultValues: {
      code: String(pincode.code),
      areas: pincode.areas?.map(area => String(area.id)) || [], // Convert areas to IDs or empty array
      cityId: String(pincode.cityId),
    },
  });

  useEffect(() => {
    if (pincode) {
      form.reset({
        code: String(pincode.code),
        areas: pincode.areas?.map(area => String(area.id)) || [], // Convert areas to IDs or empty array
        cityId: String(pincode.cityId),
      });
    }
  }, [pincode, form]);

  const { data: citiesData } = useStandardizedQuery({
    queryKey: ['cities'],
    queryFn: () => locationsService.getCities(),
    enabled: open,
    errorContext: 'Loading Cities',
    errorFallbackMessage: 'Failed to load cities',
  });

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditPincodeFormData) => locationsService.updatePincode(pincode.id, data),
    queryKey: ['pincodes'],
    resourceName: 'Pincode',
    operation: 'update',
    additionalInvalidateKeys: [['cities']],
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditPincodeFormData) => {
    updateMutation.mutate(data);
  };

  const cities = citiesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Edit Pincode</DialogTitle>
          <DialogDescription>
            Update the pincode information.
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
                    <FormLabel>Pincode</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 6-digit pincode"
                        {...field}
                        style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}
                        maxLength={6}
                      />
                    </FormControl>
                    <FormDescription>
                      6-digit postal code (numbers only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="areas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Areas</FormLabel>
                    <FormControl>
                      <EnhancedAreasMultiSelect
                        selectedAreaIds={field.value}
                        onAreasChange={field.onChange}
                        disabled={updateMutation.isPending}
                        placeholder="Select areas for this pincode..."
                        maxAreas={15}
                      />
                    </FormControl>
                    <FormDescription>
                      Select one or more areas for this pincode (max 15)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a city" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city.id} value={String(city.id)}>
                            <Stack gap={1}>
                              <Text as="span">{city.name}</Text>
                              <Text as="span" variant="caption" tone="muted">
                                {city.state}, {city.country}
                              </Text>
                            </Stack>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter style={{ display: 'flex', gap: 'var(--ui-gap-2)', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  fullWidth
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" fullWidth disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Pincode'}
                </Button>
              </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
