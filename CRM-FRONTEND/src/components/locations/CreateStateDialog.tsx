import React from 'react';
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
import type { CreateStateData } from '@/types/location';

const createStateSchema = z.object({
  name: z.string().min(1, 'State name is required').max(100, 'State name is too long'),
  code: z.string()
    .min(2, 'State code must be at least 2 characters')
    .max(10, 'State code is too long')
    .regex(/^[A-Z0-9]+$/, 'State code must contain only uppercase letters and numbers'),
  country: z.string().min(1, 'Country is required'),
});

type CreateStateFormData = z.infer<typeof createStateSchema>;

interface CreateStateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStateDialog({ open, onOpenChange }: CreateStateDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateStateFormData>({
    resolver: zodResolver(createStateSchema),
    defaultValues: {
      name: '',
      code: '',
      country: '',
    },
  });

  // Fetch countries for dropdown
  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: () => locationsService.getCountries(),
  });

  const createStateMutation = useMutation({
    mutationFn: (data: CreateStateData) => locationsService.createState(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] });
      toast.success('State created successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create state');
    },
  });

  const onSubmit = (data: CreateStateFormData) => {
    createStateMutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const countries = countriesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New State</DialogTitle>
          <DialogDescription>
            Add a new state to the location database. This will be available for city creation.
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
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createStateMutation.isPending}
              >
                {createStateMutation.isPending ? 'Creating...' : 'Create State'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
