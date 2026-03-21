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
} from '@/ui/components/Form';
import { Input } from '@/ui/components/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { locationsService } from '@/services/locations';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import type { State, UpdateStateData } from '@/types/location';

const updateStateSchema = z.object({
  name: z.string().min(1, 'State name is required').max(100, 'State name is too long'),
  code: z.string()
    .min(2, 'State code must be at least 2 characters')
    .max(10, 'State code is too long')
    .regex(/^[A-Z0-9]+$/, 'State code must contain only uppercase letters and numbers'),
  country: z.string().min(1, 'Country is required'),
});

type UpdateStateFormData = z.infer<typeof updateStateSchema>;

interface EditStateDialogProps {
  state: State;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStateDialog({ state, open, onOpenChange }: EditStateDialogProps) {
  const form = useForm<UpdateStateFormData>({
    resolver: zodResolver(updateStateSchema),
    defaultValues: {
      name: state.name,
      code: state.code,
      country: state.country,
    },
  });

  // Reset form when state changes
  useEffect(() => {
    if (state) {
      form.reset({
        name: state.name,
        code: state.code,
        country: state.country,
      });
    }
  }, [state, form]);

  // Fetch countries for dropdown
  const { data: countriesData } = useStandardizedQuery({
    queryKey: ['countries'],
    queryFn: () => locationsService.getCountries(),
    enabled: open,
    errorContext: 'Loading Countries',
    errorFallbackMessage: 'Failed to load countries',
  });

  const updateStateMutation = useCRUDMutation({
    mutationFn: (data: UpdateStateData) => locationsService.updateState(String(state.id), data),
    queryKey: ['states'],
    resourceName: 'State',
    operation: 'update',
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: UpdateStateFormData) => {
    updateStateMutation.mutate(data);
  };

  const countries = countriesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Edit State</DialogTitle>
          <DialogDescription>
            Update the state information. Changes will affect all associated cities.
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
                  <FormLabel>State Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter state name"
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
                  <FormLabel>State Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter state code (e.g., CA, NY, MH)"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
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
                          <Stack direction="horizontal" gap={2} align="center">
                            <Box
                              as="span"
                              style={{
                                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                                fontSize: '0.75rem',
                                paddingInline: '0.25rem',
                                borderRadius: '0.375rem',
                                background: 'color-mix(in srgb, var(--ui-accent) 14%, transparent)',
                                color: 'var(--ui-accent)',
                                border: '1px solid color-mix(in srgb, var(--ui-accent) 24%, transparent)',
                              }}
                            >
                              {country.code}
                            </Box>
                            <Text as="span">{country.name}</Text>
                          </Stack>
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
                disabled={updateStateMutation.isPending}
                fullWidth>
                {updateStateMutation.isPending ? 'Updating...' : 'Update State'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
