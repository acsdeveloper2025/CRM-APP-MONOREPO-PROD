import React from 'react';
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
import toast from 'react-hot-toast';
import { verificationTypesService } from '@/services/verificationTypes';

const createVerificationTypeSchema = z.object({
  name: z.string().min(1, 'Verification type name is required').max(100, 'Name too long'),
  code: z.string().min(2, 'Code is required').max(50, 'Code too long'),
});

type CreateVerificationTypeFormData = z.infer<typeof createVerificationTypeSchema>;

interface CreateVerificationTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVerificationTypeDialog({ open, onOpenChange }: CreateVerificationTypeDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateVerificationTypeFormData>({
    resolver: zodResolver(createVerificationTypeSchema),
    defaultValues: {
      name: '',
      code: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateVerificationTypeFormData) => verificationTypesService.createVerificationType({
      name: data.name,
      code: data.code,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-types'] });
      queryClient.invalidateQueries({ queryKey: ['verification-types-stats'] });
      toast.success('Verification type created successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create verification type');
    },
  });

  const onSubmit = (data: CreateVerificationTypeFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Verification Type</DialogTitle>
          <DialogDescription>
            Create a standalone verification type that can be assigned to products later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Type Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., RESIDENCE_VERIFICATION" {...field} />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for this verification type
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    The name of the verification type (e.g., "Residence Verification", "Office Verification")
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
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
