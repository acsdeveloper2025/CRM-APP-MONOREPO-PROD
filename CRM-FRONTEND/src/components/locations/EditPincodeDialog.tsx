import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { locationsService } from '@/services/locations';
import { Pincode } from '@/types/location';
import { EnhancedAreasMultiSelect } from './EnhancedAreasMultiSelect';

const editPincodeSchema = z.object({
  code: z
    .string()
    .min(6, 'Pincode must be 6 digits')
    .max(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only numbers'),
  areas: z
    .array(z.string())
    .min(1, 'At least one area must be selected')
    .max(15, 'Maximum 15 areas allowed'),
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
      areas: pincode.areas?.map((area) => String(area.id)) || [], // Convert areas to IDs or empty array
      cityId: String(pincode.cityId),
    },
  });

  useEffect(() => {
    if (pincode) {
      form.reset({
        code: String(pincode.code),
        areas: pincode.areas?.map((area) => String(area.id)) || [], // Convert areas to IDs or empty array
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
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Pincode</DialogTitle>
          <DialogDescription>Update the pincode information.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      className="font-mono"
                      maxLength={6}
                    />
                  </FormControl>
                  <FormDescription>6-digit postal code (numbers only)</FormDescription>
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
                          {city.name} ({city.state}, {city.country})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                {updateMutation.isPending ? 'Updating...' : 'Update Pincode'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
