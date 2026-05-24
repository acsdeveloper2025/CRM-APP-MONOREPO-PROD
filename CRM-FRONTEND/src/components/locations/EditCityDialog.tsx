import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { editCityFormSchema, type EditCityFormData } from '@/forms/schemas/location.schema';
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
import { Switch } from '@/components/ui/switch';
import { locationsService } from '@/services/locations';
import { City } from '@/types/location';

interface EditCityDialogProps {
  city: City;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCityDialog({ city, open, onOpenChange }: EditCityDialogProps) {
  const form = useForm<EditCityFormData>({
    resolver: zodResolver(editCityFormSchema),
    defaultValues: {
      name: city.name,
      state: city.state,
      country: city.country,
      isActive: city.isActive ?? true,
    },
  });

  useEffect(() => {
    if (city) {
      form.reset({
        name: city.name,
        state: city.state,
        country: city.country,
        isActive: city.isActive ?? true,
      });
    }
  }, [city, form]);

  const { data: statesData, isLoading: statesLoading } = useStandardizedQuery({
    queryKey: ['states'],
    queryFn: () => locationsService.getStates(),
    enabled: open,
    errorContext: 'Loading States',
    errorFallbackMessage: 'Failed to load states',
  });

  const { data: countriesData, isLoading: countriesLoading } = useStandardizedQuery({
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
    additionalInvalidateKeys: [['city-stats']],
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: EditCityFormData) => {
    updateMutation.mutate(data);
  };

  // B4 fix: parent table renders `{selectedCity && <Edit/>}` but never nulls
  // selectedCity on close. Re-opening Edit on the same row keeps the same
  // `city` prop reference → useEffect [city, form] doesn't re-fire → dirty
  // form state persists. Reset on close prevents that.
  const handleOpenChange = (next: boolean) => {
    if (!next && !updateMutation.isPending) {
      form.reset({
        name: city.name,
        state: city.state,
        country: city.country,
        isActive: city.isActive ?? true,
      });
    }
    onOpenChange(next);
  };

  const states = statesData?.data || [];
  const countries = countriesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit City</DialogTitle>
          <DialogDescription>Update the city information.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      {statesLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading states...
                        </SelectItem>
                      ) : states.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          No states available
                        </SelectItem>
                      ) : (
                        states.map((state) => (
                          <SelectItem key={state.id} value={state.name}>
                            {state.name}
                          </SelectItem>
                        ))
                      )}
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
                      {countriesLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading countries...
                        </SelectItem>
                      ) : countries.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          No countries available
                        </SelectItem>
                      ) : (
                        countries.map((country) => (
                          <SelectItem key={country.id} value={country.name}>
                            {country.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive cities are hidden from the Active filter.
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
                {updateMutation.isPending ? 'Updating...' : 'Update City'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
