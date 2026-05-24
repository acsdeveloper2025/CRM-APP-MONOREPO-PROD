import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import {
  countryFormSchema,
  type CountryFormData,
  CONTINENTS,
} from '@/forms/schemas/location.schema';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { locationsService } from '@/services/locations';
import type { CreateCountryData } from '@/types/location';

interface CreateCountryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCountryDialog({ open, onOpenChange }: CreateCountryDialogProps) {
  const form = useForm<CountryFormData>({
    resolver: zodResolver(countryFormSchema),
    defaultValues: {
      name: '',
      code: '',
      continent: '',
    },
  });

  const createCountryMutation = useCRUDMutation({
    mutationFn: (data: CreateCountryData) =>
      locationsService.createCountry({
        ...data,
        code: data.code.toUpperCase(),
      }),
    queryKey: ['countries'],
    resourceName: 'Country',
    operation: 'create',
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: CountryFormData) => {
    createCountryMutation.mutate(data);
  };

  // B4 fix: route every close path (Cancel, Esc, click-outside, mutation
  // success) through this wrapper so a half-filled form doesn't persist
  // across Cancel + reopen (parent doesn't unmount the dialog).
  const handleOpenChange = (next: boolean) => {
    if (!next && !createCountryMutation.isPending) {
      form.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Country</DialogTitle>
          <DialogDescription>
            Add a new country to the location management system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., United States" {...field} />
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
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="font-mono uppercase"
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
                      {CONTINENTS.map((continent) => (
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

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createCountryMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCountryMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createCountryMutation.isPending ? 'Creating...' : 'Create Country'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
