import React, { useEffect } from 'react';
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
import type { DocumentType } from '@/types/documentType';

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
  const form = useForm<DocumentTypeFormData>({
    resolver: zodResolver(documentTypeFormSchema),
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

  const updateDocumentTypeMutation = useMutationWithInvalidation({
    mutationFn: (data: DocumentTypeFormData) => {
      if (!documentType) {
        throw new Error('Document Type is missing');
      }
      return documentTypesService.updateDocumentType(documentType.id, data);
    },
    invalidateKeys: [['document-types'], ['document-types-stats']],
    successMessage: 'Document type updated successfully',
    errorContext: 'Document Type Update',
    errorFallbackMessage: 'Failed to update document type',
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: DocumentTypeFormData) => {
    if (!documentType) {
      return;
    }
    updateDocumentTypeMutation.mutate(data);
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
