import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
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
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading';
import { locationsService } from '@/services/locations';
import { Pincode, City, State, Country } from '@/types/location';
import { ApiResponse } from '@/types/api';
import { CascadingLocationSelector } from './CascadingLocationSelector';

const cascadingEditPincodeSchema = z.object({
  countryId: z.string().min(1, 'Country selection is required'),
  stateId: z.string().min(1, 'State selection is required'),
  cityId: z.string().min(1, 'City selection is required'),
  pincodeCode: z
    .string()
    .min(6, 'Pincode must be 6 digits')
    .max(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only numbers'),
  areas: z
    .array(z.string())
    .min(1, 'At least one area must be selected')
    .max(15, 'Maximum 15 areas allowed'),
  isActive: z.boolean().optional(),
});

type CascadingEditPincodeFormData = z.infer<typeof cascadingEditPincodeSchema>;

interface CascadingEditPincodeDialogProps {
  pincode: Pincode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CascadingEditPincodeDialog({
  pincode,
  open,
  onOpenChange,
}: CascadingEditPincodeDialogProps) {
  const form = useForm<CascadingEditPincodeFormData>({
    resolver: zodResolver(cascadingEditPincodeSchema),
    defaultValues: {
      countryId: '',
      stateId: '',
      cityId: '',
      pincodeCode: '',
      areas: [],
      isActive: true,
    },
  });

  // Fetch the city details to get the full hierarchy
  const { data: cityData, isLoading: cityLoading } = useQuery<ApiResponse<City>>({
    queryKey: ['city', pincode.cityId],
    queryFn: () => locationsService.getCityById(pincode.cityId),
    enabled: open && !!pincode.cityId,
  });

  // Fetch states to find the state ID
  const { data: statesData, isLoading: statesLoading } = useQuery<ApiResponse<State[]>>({
    queryKey: ['states-for-edit', cityData?.data?.country],
    queryFn: () => {
      if (!cityData?.data?.country) {
        return Promise.resolve({ success: true, message: '', data: [] } as ApiResponse<State[]>);
      }
      return locationsService.getStates({ country: cityData.data.country, limit: 100 });
    },
    enabled: !!cityData?.data?.country,
  });

  // Fetch countries to find the country ID
  const { data: countriesData, isLoading: countriesLoading } = useQuery<ApiResponse<Country[]>>({
    queryKey: ['countries-for-edit'],
    queryFn: () => locationsService.getCountries({ limit: 100 }),
    enabled: open,
  });

  // B3: spinner shows while ANY of the 3 fetches is in flight; warning surfaces
  // when state/country lookup fails (e.g. legacy data where the city's state
  // or country was renamed or deleted). Without these, the dialog used to
  // render an empty form silently.
  const isHierarchyLoading = cityLoading || statesLoading || countriesLoading;
  const [lookupFailed, setLookupFailed] = useState(false);

  // Pre-populate form when data is loaded
  useEffect(() => {
    if (pincode && cityData?.data && statesData?.data && countriesData?.data) {
      const city = cityData.data;
      const state = statesData.data.find((s: State) => s.name === city.state);
      const country = countriesData.data.find((c: Country) => c.name === city.country);

      if (state && country) {
        setLookupFailed(false);
        form.reset({
          countryId: String(country.id),
          stateId: String(state.id),
          cityId: String(pincode.cityId),
          pincodeCode: String(pincode.code),
          areas: pincode.areas?.map((area) => String(area.id)) || [],
          isActive: pincode.isActive ?? true,
        });
      } else {
        setLookupFailed(true);
      }
    }
  }, [pincode, cityData, statesData, countriesData, form]);

  const updateMutation = useMutationWithInvalidation({
    mutationFn: async (data: CascadingEditPincodeFormData) => {
      // 1. Update core pincode fields (code + cityId + isActive).
      const result = await locationsService.updatePincode(pincode.id, {
        code: data.pincodeCode,
        cityId: data.cityId,
        isActive: data.isActive,
      });

      // 2. Diff selected areas against the originals and sync via the
      // dedicated endpoints (POST /pincodes/:id/areas + DELETE
      // /pincodes/:id/areas/:areaId). Without this, area edits in the
      // dialog were silently dropped.
      const originalAreaIds = new Set((pincode.areas ?? []).map((a) => String(a.id)));
      const selectedAreaIds = new Set(data.areas);
      const toAdd = data.areas.filter((id) => !originalAreaIds.has(id)).map(Number);
      const toRemove = [...originalAreaIds].filter((id) => !selectedAreaIds.has(id));

      for (const areaId of toRemove) {
        await locationsService.removePincodeArea(String(pincode.id), areaId);
      }
      if (toAdd.length > 0) {
        await locationsService.addPincodeAreas(String(pincode.id), { areaIds: toAdd });
      }

      return result;
    },
    invalidateKeys: [['pincodes'], ['cities'], ['pincode-stats']],
    successMessage: 'Pincode updated successfully',
    errorContext: 'Pincode Update',
    errorFallbackMessage: 'Failed to update pincode',
    onSuccess: () => {
      handleDialogClose(false);
    },
  });

  const onSubmit = (data: CascadingEditPincodeFormData) => {
    updateMutation.mutate(data);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !updateMutation.isPending) {
      // Reset form to original values when closing — include isActive so a
      // toggled Switch doesn't persist across Cancel + reopen.
      if (pincode && cityData?.data && statesData?.data && countriesData?.data) {
        const city = cityData.data;
        const state = statesData.data.find((s: State) => s.name === city.state);
        const country = countriesData.data.find((c: Country) => c.name === city.country);

        if (state && country) {
          form.reset({
            countryId: String(country.id),
            stateId: String(state.id),
            cityId: String(pincode.cityId),
            pincodeCode: String(pincode.code),
            areas: pincode.areas?.map((area) => String(area.id)) || [],
            isActive: pincode.isActive ?? true,
          });
        }
      }
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pincode</DialogTitle>
          <DialogDescription>
            Update the pincode information. You can change the location hierarchy and associated
            areas.
          </DialogDescription>
        </DialogHeader>

        {isHierarchyLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : lookupFailed ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Could not resolve the city&apos;s state or country (possibly renamed or deleted).
                Refresh data and try again; if the problem persists, fix the underlying state /
                country record first.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleDialogClose(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <CascadingLocationSelector
                form={form}
                mode="edit"
                showPincodeInput={true}
                showAreasSelect={true}
                disabled={updateMutation.isPending}
                countryField="countryId"
                stateField="stateId"
                cityField="cityId"
                pincodeField="pincodeCode"
                areasField="areas"
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive pincodes are hidden from the Active filter.
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
                  onClick={() => handleDialogClose(false)}
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
                  {updateMutation.isPending ? 'Updating...' : 'Update Pincode'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
