import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import {
  documentTypeFormSchema,
  type DocumentTypeFormData,
} from '@/forms/schemas/documentType.schema';
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

interface CreateDocumentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateDocumentTypeDialog: React.FC<CreateDocumentTypeDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const form = useForm<DocumentTypeFormData>({
    resolver: zodResolver(documentTypeFormSchema),
    defaultValues: {
      name: '',
      code: '',
    },
  });

  const createDocumentTypeMutation = useMutationWithInvalidation({
    mutationFn: (data: DocumentTypeFormData) => documentTypesService.createDocumentType(data),
    invalidateKeys: [['document-types'], ['document-types-stats']],
    successMessage: 'Document type created',
    errorContext: 'Document Type Creation',
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = async (data: DocumentTypeFormData) => {
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
