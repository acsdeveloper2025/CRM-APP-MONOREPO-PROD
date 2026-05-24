import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import {
  editCountryFormSchema,
  type EditCountryFormData,
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
import { Country } from '@/types/location';

interface EditCountryDialogProps {
  country: Country;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCountryDialog({ country, open, onOpenChange }: EditCountryDialogProps) {
  const form = useForm<EditCountryFormData>({
    resolver: zodResolver(editCountryFormSchema),
    defaultValues: {
      name: country.name,
      code: country.code,
      continent: country.continent,
      isActive: country.isActive ?? true,
    },
  });

  useEffect(() => {
    if (country) {
      form.reset({
        name: country.name,
        code: country.code,
        continent: country.continent,
        isActive: country.isActive ?? true,
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
    additionalInvalidateKeys: [['country-stats']],
    onSuccess: () => {
      handleOpenChange(false);
    },
  });

  const onSubmit = (data: EditCountryFormData) => {
    updateCountryMutation.mutate(data);
  };

  // B4 fix: parent table renders `{selectedCountry && <Edit... />}` but never
  // nulls selectedCountry on close. Re-opening Edit on the SAME row keeps the
  // same `country` prop reference → useEffect [country, form] doesn't re-fire
  // → dirty edit state persists. Reset on close prevents that.
  const handleOpenChange = (next: boolean) => {
    if (!next && !updateCountryMutation.isPending) {
      form.reset({
        name: country.name,
        code: country.code,
        continent: country.continent,
        isActive: country.isActive ?? true,
      });
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Country</DialogTitle>
          <DialogDescription>Update the country information.</DialogDescription>
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

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive countries are hidden from the Active filter.
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
                disabled={updateCountryMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateCountryMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateCountryMutation.isPending ? 'Updating...' : 'Update Country'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
