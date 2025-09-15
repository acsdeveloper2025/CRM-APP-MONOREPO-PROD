import React, { useEffect } from 'react';
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
import { toast } from 'sonner';
import { clientsService } from '@/services/clients';
import { VerificationType } from '@/types/client';

const editVerificationTypeSchema = z.object({
  name: z.string().min(1, 'Verification type name is required').max(100, 'Name too long'),
});

type EditVerificationTypeFormData = z.infer<typeof editVerificationTypeSchema>;

interface EditVerificationTypeDialogProps {
  verificationType: VerificationType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditVerificationTypeDialog({ verificationType, open, onOpenChange }: EditVerificationTypeDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditVerificationTypeFormData>({
    resolver: zodResolver(editVerificationTypeSchema),
    defaultValues: {
      name: verificationType.name,
    },
  });

  useEffect(() => {
    if (verificationType) {
      form.reset({
        name: verificationType.name,
      });
    }
  }, [verificationType, form]);

  const updateMutation = useMutation({
    mutationFn: (data: EditVerificationTypeFormData) => 
      clientsService.updateVerificationType(verificationType.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-types'] });
      toast.success('Verification type updated successfully');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update verification type');
    },
  });

  const onSubmit = (data: EditVerificationTypeFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Verification Type</DialogTitle>
          <DialogDescription>
            Update the verification type information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Type Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter verification type name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The name of the verification type
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
