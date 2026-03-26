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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { documentTypesService } from '@/services/documentTypes';
import { logger } from '@/utils/logger';

const createDocumentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be at most 50 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
});

type CreateDocumentTypeData = z.infer<typeof createDocumentTypeSchema>;

interface CreateDocumentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateDocumentTypeDialog: React.FC<CreateDocumentTypeDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();

  const form = useForm<CreateDocumentTypeData>({
    resolver: zodResolver(createDocumentTypeSchema),
    defaultValues: {
      name: '',
      code: '',
    },
  });

  const createDocumentTypeMutation = useMutation({
    mutationFn: (data: CreateDocumentTypeData) => documentTypesService.createDocumentType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      queryClient.invalidateQueries({ queryKey: ['document-types-stats'] });
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = async (data: CreateDocumentTypeData) => {
    try {
      await createDocumentTypeMutation.mutateAsync(data);
    } catch (error) {
      logger.error('Failed to create document type:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Document Type</DialogTitle>
          <DialogDescription>Add a document type with only name and code.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type Code *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., AADHAAR"
                      {...field}
                      onChange={e => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Aadhaar Card" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createDocumentTypeMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createDocumentTypeMutation.isPending ? 'Creating...' : 'Create Document Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
