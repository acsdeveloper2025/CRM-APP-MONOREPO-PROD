import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
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
import { toast } from 'sonner';
import { locationsService } from '@/services/locations';
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
  const queryClient = useQueryClient();

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
  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: () => locationsService.getCountries(),
  });

  const updateStateMutation = useMutation({
    mutationFn: (data: UpdateStateData) => locationsService.updateState(state.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] });
      toast.success('State updated successfully');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update state');
    },
  });

  const onSubmit = (data: UpdateStateFormData) => {
    updateStateMutation.mutate(data);
  };

  const countries = countriesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs bg-muted px-1 rounded">
                              {country.code}
                            </span>
                            <span>{country.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateStateMutation.isPending}
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
