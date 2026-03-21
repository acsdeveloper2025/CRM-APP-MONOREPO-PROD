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
} from '@/ui/components/Select';
import { Input } from '@/ui/components/Input';
import { Stack } from '@/ui/primitives/Stack';
import { locationsService } from '@/services/locations';

const createCitySchema = z.object({
  name: z.string().min(1, 'City name is required').max(100, 'Name too long'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
});

type CreateCityFormData = z.infer<typeof createCitySchema>;

interface CreateCityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCityDialog({ open, onOpenChange }: CreateCityDialogProps) {
  const form = useForm<CreateCityFormData>({
    resolver: zodResolver(createCitySchema),
    defaultValues: {
      name: '',
      state: '',
      country: '',
    },
  });

  // Fetch states and countries for dropdowns
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

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateCityFormData) => locationsService.createCity(data),
    queryKey: ['cities'],
    resourceName: 'City',
    operation: 'create',
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CreateCityFormData) => {
    createMutation.mutate(data);
  };

  const states = statesData?.data || [];
  const countries = countriesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Create New City</DialogTitle>
          <DialogDescription>
            Add a new city to the location database. This will be available for pincode assignment.
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
                    <Input
                      placeholder="Enter city name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The official name of the city
                  </FormDescription>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormDescription>
                    The state or province where the city is located
                  </FormDescription>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormDescription>
                    The country where the city is located
                  </FormDescription>
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
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                fullWidth>
                {createMutation.isPending ? 'Creating...' : 'Create City'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
