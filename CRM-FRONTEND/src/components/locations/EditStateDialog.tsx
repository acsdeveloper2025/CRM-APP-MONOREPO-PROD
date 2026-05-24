import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { editStateFormSchema, type EditStateFormData } from '@/forms/schemas/location.schema';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { locationsService } from '@/services/locations';
import type { State, UpdateStateData } from '@/types/location';

interface EditStateDialogProps {
  state: State;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStateDialog({ state, open, onOpenChange }: EditStateDialogProps) {
  const form = useForm<EditStateFormData>({
    resolver: zodResolver(editStateFormSchema),
    defaultValues: {
      name: state.name,
      code: state.code,
      country: state.country,
      isActive: state.isActive ?? true,
    },
  });

  useEffect(() => {
    if (state) {
      form.reset({
        name: state.name,
        code: state.code,
        country: state.country,
        isActive: state.isActive ?? true,
      });
    }
  }, [state, form]);

  const { data: countriesData, isLoading: countriesLoading } = useStandardizedQuery({
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
    additionalInvalidateKeys: [['state-stats']],
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: EditStateFormData) => {
    updateStateMutation.mutate(data);
  };

  // B4 fix: parent table renders `{selectedState && <Edit/>}` but never nulls
  // selectedState on close. Re-opening Edit on the same row keeps the same
  // `state` prop reference → useEffect [state, form] doesn't re-fire → dirty
  // form state persists. Reset on close prevents that.
  const handleOpenChange = (next: boolean) => {
    if (!next && !updateStateMutation.isPending) {
      form.reset({
        name: state.name,
        code: state.code,
        country: state.country,
        isActive: state.isActive ?? true,
      });
    }
    onOpenChange(next);
  };

  const countries = countriesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit State</DialogTitle>
          <DialogDescription>
            Update the state information. Changes will affect all associated cities.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter state name" {...field} />
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
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs bg-muted px-1 rounded">
                                {country.code}
                              </span>
                              <span>{country.name}</span>
                            </div>
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
                      Inactive states are hidden from the Active filter.
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
                disabled={updateStateMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateStateMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateStateMutation.isPending ? 'Updating...' : 'Update State'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
