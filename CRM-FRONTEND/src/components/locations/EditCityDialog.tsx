import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
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
} from '@/ui/components/Select';
import { Input } from '@/ui/components/Input';
import { Stack } from '@/ui/primitives/Stack';
import { locationsService } from '@/services/locations';
import { City } from '@/types/location';

const editCitySchema = z.object({
  name: z.string().min(1, 'City name is required').max(100, 'Name too long'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
});

type EditCityFormData = z.infer<typeof editCitySchema>;

interface EditCityDialogProps {
  city: City;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCityDialog({ city, open, onOpenChange }: EditCityDialogProps) {
  const form = useForm<EditCityFormData>({
    resolver: zodResolver(editCitySchema),
    defaultValues: {
      name: city.name,
      state: city.state,
      country: city.country,
    },
  });

  useEffect(() => {
    if (city) {
      form.reset({
        name: city.name,
        state: city.state,
        country: city.country,
      });
    }
  }, [city, form]);

  const { data: statesData } = useStandardizedQuery({
    queryKey: ['states'],
    queryFn: () => locationsService.getStates(),
    enabled: open,
    errorContext: 'Loading States',
    errorFallbackMessage: 'Failed to load states',
  });

  const { data: countriesData } = useStandardizedQuery({
    queryKey: ['countries'],
    queryFn: () => locationsService.getCountries(),
    enabled: open,
    errorContext: 'Loading Countries',
    errorFallbackMessage: 'Failed to load countries',
  });

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditCityFormData) => locationsService.updateCity(city.id.toString(), data),
    queryKey: ['cities'],
    resourceName: 'City',
    operation: 'update',
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditCityFormData) => {
    updateMutation.mutate(data);
  };

  const states = statesData?.data || [];
  const countries = countriesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Edit City</DialogTitle>
          <DialogDescription>
            Update the city information.
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
                  <FormLabel>City Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter city name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state.id} value={state.name}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.id} value={country.name}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <Button type="submit" disabled={updateMutation.isPending} fullWidth>
                {updateMutation.isPending ? 'Updating...' : 'Update City'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
