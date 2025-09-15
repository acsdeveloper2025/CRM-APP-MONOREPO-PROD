import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { rateTypesService, type RateType, type UpdateRateTypeData } from '@/services/rateTypes';
import toast from 'react-hot-toast';

const updateRateTypeSchema = z.object({
  name: z.string().min(1, 'Rate type name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  isActive: z.boolean(),
});

type UpdateRateTypeFormData = z.infer<typeof updateRateTypeSchema>;

interface EditRateTypeDialogProps {
  rateType: RateType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRateTypeDialog({ rateType, open, onOpenChange }: EditRateTypeDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<UpdateRateTypeFormData>({
    resolver: zodResolver(updateRateTypeSchema),
    defaultValues: {
      name: rateType.name,
      description: rateType.description || '',
      isActive: rateType.isActive,
    },
  });

  // Update form when rateType changes
  useEffect(() => {
    form.reset({
      name: rateType.name,
      description: rateType.description || '',
      isActive: rateType.isActive,
    });
  }, [rateType, form]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRateTypeData) => rateTypesService.updateRateType(rateType.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-types'] });
      queryClient.invalidateQueries({ queryKey: ['rate-management-stats'] });
      toast.success('Rate type updated successfully');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update rate type');
    },
  });

  const onSubmit = (data: UpdateRateTypeFormData) => {
    updateMutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !updateMutation.isPending) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Rate Type</DialogTitle>
          <DialogDescription>
            Update the details for the rate type "{rateType.name}".
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Type Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter rate type name" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique name for this rate type (e.g., Local, OGL, Outstation)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description for this rate type"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description explaining when this rate type is used
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Enable this rate type for use in assignments and rate setting
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Rate Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
