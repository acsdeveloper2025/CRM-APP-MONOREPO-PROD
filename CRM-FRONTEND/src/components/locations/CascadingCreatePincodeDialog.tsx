
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import { locationsService } from '@/services/locations';
import { CascadingLocationSelector } from './CascadingLocationSelector';

const cascadingCreatePincodeSchema = z.object({
  countryId: z.string().min(1, 'Country selection is required'),
  stateId: z.string().min(1, 'State selection is required'),
  cityId: z.string().min(1, 'City selection is required'),
  pincodeCode: z.string()
    .min(6, 'Pincode must be 6 digits')
    .max(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only numbers'),
  areas: z.array(z.string()).min(1, 'At least one area must be selected').max(15, 'Maximum 15 areas allowed'),
});

type CascadingCreatePincodeFormData = z.infer<typeof cascadingCreatePincodeSchema>;

interface CascadingCreatePincodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CascadingCreatePincodeDialog({ open, onOpenChange }: CascadingCreatePincodeDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CascadingCreatePincodeFormData>({
    resolver: zodResolver(cascadingCreatePincodeSchema),
    defaultValues: {
      countryId: '',
      stateId: '',
      cityId: '',
      pincodeCode: '',
      areas: [],
    },
    mode: 'onChange', // Enable real-time validation
  });



  const createMutation = useMutation({
    mutationFn: async (data: CascadingCreatePincodeFormData) => {
      // Transform cascading data to backend format
      const pincodeData = {
        code: data.pincodeCode,
        areas: data.areas,
        cityId: data.cityId,
      };
      return locationsService.createPincode(pincodeData);
    },
    onSuccess: () => {
      toast.success('Pincode created successfully');
      queryClient.invalidateQueries({ queryKey: ['pincodes'] });
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Create pincode error:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to create pincode';
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: CascadingCreatePincodeFormData) => {
    createMutation.mutate(data);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Pincode</DialogTitle>
          <DialogDescription>
            Create a new pincode by selecting the complete geographic hierarchy: Country → State → City → Pincode → Areas.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CascadingLocationSelector
              form={form}
              mode="create"
              showPincodeInput={true}
              showAreasSelect={true}
              disabled={createMutation.isPending}
              countryField="countryId"
              stateField="stateId"
              cityField="cityId"
              pincodeField="pincodeCode"
              areasField="areas"
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Pincode'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
