import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
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
import { Country } from '@/types/location';

const editCountrySchema = z.object({
  name: z.string().min(1, 'Country name is required').max(100, 'Country name is too long'),
  code: z.string()
    .min(2, 'Country code must be at least 2 characters')
    .max(3, 'Country code must be at most 3 characters')
    .regex(/^[A-Z]{2,3}$/, 'Country code must be uppercase letters only (ISO format)'),
  continent: z.string().min(1, 'Continent is required'),
});

type EditCountryFormData = z.infer<typeof editCountrySchema>;

interface EditCountryDialogProps {
  country: Country;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const continents = [
  'Africa',
  'Antarctica', 
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America'
];

export function EditCountryDialog({ country, open, onOpenChange }: EditCountryDialogProps) {
  const form = useForm<EditCountryFormData>({
    resolver: zodResolver(editCountrySchema),
    defaultValues: {
      name: country.name,
      code: country.code,
      continent: country.continent,
    },
  });

  // Update form when country changes
  useEffect(() => {
    if (country) {
      form.reset({
        name: country.name,
        code: country.code,
        continent: country.continent,
      });
    }
  }, [country, form]);

  const updateCountryMutation = useCRUDMutation({
    mutationFn: (data: EditCountryFormData) =>
      locationsService.updateCountry(country.id.toString(), {
        ...data,
        code: data.code.toUpperCase(),
      }),
    queryKey: ['countries'],
    resourceName: 'Country',
    operation: 'update',
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditCountryFormData) => {
    updateCountryMutation.mutate(data);
  };

  const handleCodeChange = (value: string) => {
    // Auto-uppercase the country code
    form.setValue('code', value.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Edit Country</DialogTitle>
          <DialogDescription>
            Update the country information.
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
                  <FormLabel>Country Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., United States" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country Code (ISO)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., US, IN, GB" 
                      maxLength={3}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleCodeChange(e.target.value);
                      }}
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', textTransform: 'uppercase' }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="continent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Continent</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a continent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {continents.map((continent) => (
                        <SelectItem key={continent} value={continent}>
                          {continent}
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
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateCountryMutation.isPending}
                fullWidth>
                {updateCountryMutation.isPending ? 'Updating...' : 'Update Country'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
