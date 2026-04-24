import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
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
import { Form } from '@/components/ui/form';
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
    },
  });

  // Fetch the city details to get the full hierarchy
  const { data: cityData } = useQuery<ApiResponse<City>>({
    queryKey: ['city', pincode.cityId],
    queryFn: () => locationsService.getCityById(pincode.cityId),
    enabled: open && !!pincode.cityId,
  });

  // Fetch states to find the state ID
  const { data: statesData } = useQuery<ApiResponse<State[]>>({
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
  const { data: countriesData } = useQuery<ApiResponse<Country[]>>({
    queryKey: ['countries-for-edit'],
    queryFn: () => locationsService.getCountries({ limit: 100 }),
    enabled: open,
  });

  // Pre-populate form when data is loaded
  useEffect(() => {
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
        });
      }
    }
  }, [pincode, cityData, statesData, countriesData, form]);

  const updateMutation = useMutationWithInvalidation({
    mutationFn: (data: CascadingEditPincodeFormData) =>
      locationsService.updatePincode(pincode.id, {
        code: data.pincodeCode,
        cityId: data.cityId,
        // Note: Area-pincode relationships require a dedicated API endpoint (not yet available)
      }),
    invalidateKeys: [['pincodes'], ['cities']],
    successMessage: 'Pincode updated successfully',
    errorContext: 'Pincode Update',
    errorFallbackMessage: 'Failed to update pincode',
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CascadingEditPincodeFormData) => {
    updateMutation.mutate(data);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // Reset form to original values when closing
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

            <DialogFooter className="flex-col sm:flex-row gap-2">
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
      </DialogContent>
    </Dialog>
  );
}
