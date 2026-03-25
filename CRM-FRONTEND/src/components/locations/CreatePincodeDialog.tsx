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
import { EnhancedAreasMultiSelect } from './EnhancedAreasMultiSelect';
import { toast } from 'sonner';

const createPincodeSchema = z.object({
  code: z.string()
    .min(6, 'Pincode must be 6 digits')
    .max(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only numbers'),
  areas: z.array(z.string()).min(1, 'At least one area must be selected').max(15, 'Maximum 15 areas allowed'),
  cityId: z.string().min(1, 'City selection is required'),
});

type CreatePincodeFormData = z.infer<typeof createPincodeSchema>;

interface CreatePincodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePincodeDialog({ open, onOpenChange }: CreatePincodeDialogProps) {
  const form = useForm<CreatePincodeFormData>({
    resolver: zodResolver(createPincodeSchema),
    defaultValues: {
      code: '',
      areas: [],
      cityId: '',
    },
  });

  // Fetch cities for the dropdown
  const { data: citiesData } = useStandardizedQuery({
    queryKey: ['cities'],
    queryFn: () => locationsService.getCities(),
    enabled: open,
    errorContext: 'Loading Cities',
    errorFallbackMessage: 'Failed to load cities',
  });

  // Areas will be loaded by AreasMultiSelect component

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreatePincodeFormData) => locationsService.createPincode(data),
    queryKey: ['pincodes'],
    resourceName: 'Pincode',
    operation: 'create',
    additionalInvalidateKeys: [['cities']],
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CreatePincodeFormData) => {
    // Find the selected city to get additional required fields
    const selectedCity = cities.find(city => String(city.id) === data.cityId);

    if (!selectedCity) {
      toast.error('Please select a valid city');
      return;
    }

    // Prepare data with areas for backend
    const pincodeData = {
      code: data.code,
      areas: data.areas, // Send area IDs
      cityId: data.cityId,
    };

    createMutation.mutate(pincodeData);
  };

  const cities = citiesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Pincode</DialogTitle>
          <DialogDescription>
            Add a new pincode to a city. This will be used for address verification.
          </DialogDescription>
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
                      disabled={createMutation.isPending}
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={String(city.id)}>
                          <div className="flex flex-col">
                            <span>{city.name}</span>
                            <span className="text-xs text-gray-600">
                              {city.state}, {city.country}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the city this pincode belongs to
                  </FormDescription>
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
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
               className="w-full sm:w-auto">
                {createMutation.isPending ? 'Creating...' : 'Create Pincode'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
