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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { documentTypesService } from '@/services/documentTypes';
import type { DocumentType } from '@/types/documentType';
import { logger } from '@/utils/logger';

const editDocumentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be at most 50 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
});

type EditDocumentTypeData = z.infer<typeof editDocumentTypeSchema>;

interface EditDocumentTypeDialogProps {
  documentType: DocumentType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditDocumentTypeDialog: React.FC<EditDocumentTypeDialogProps> = ({
  documentType,
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();

  const form = useForm<EditDocumentTypeData>({
    resolver: zodResolver(editDocumentTypeSchema),
    defaultValues: { name: '', code: '' },
  });

  useEffect(() => {
    if (documentType) {
      form.reset({
        name: documentType.name,
        code: documentType.code,
      });
    }
  }, [documentType, form]);

  const updateDocumentTypeMutation = useMutation({
    mutationFn: (data: EditDocumentTypeData) => {
      if (!documentType) {
        throw new Error('Document Type is missing');
      }
      return documentTypesService.updateDocumentType(documentType.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      queryClient.invalidateQueries({ queryKey: ['document-types-stats'] });
      onOpenChange(false);
    },
  });

  const onSubmit = async (data: EditDocumentTypeData) => {
    if (!documentType) {
      return;
    }
    try {
      await updateDocumentTypeMutation.mutateAsync(data);
    } catch (error) {
      logger.error('Failed to update document type:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  if (!documentType) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Document Type</DialogTitle>
          <DialogDescription>Update only name and code.</DialogDescription>
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
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateDocumentTypeMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateDocumentTypeMutation.isPending ? 'Updating...' : 'Update Document Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
