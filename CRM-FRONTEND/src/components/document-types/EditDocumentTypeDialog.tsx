import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import {
  editDocumentTypeFormSchema,
  type EditDocumentTypeFormData,
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
  const form = useForm<EditDocumentTypeFormData>({
    resolver: zodResolver(editDocumentTypeFormSchema),
    defaultValues: { name: '', code: '', isActive: true },
  });

  useEffect(() => {
    if (documentType) {
      form.reset({
        name: documentType.name,
        code: documentType.code,
        isActive: documentType.isActive ?? true,
      });
    }
  }, [documentType, form]);

  const updateDocumentTypeMutation = useMutationWithInvalidation({
    mutationFn: (data: EditDocumentTypeFormData) => {
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

  const onSubmit = (data: EditDocumentTypeFormData) => {
    if (!documentType) {
      return;
    }
    updateDocumentTypeMutation.mutate(data);
  };

  const handleClose = () => {
    // Don't reset / close while a mutation is in flight — Esc + Cancel
    // both route through here, and resetting form state mid-update can
    // surface stale values if the mutation later errors.
    if (updateDocumentTypeMutation.isPending) {
      return;
    }
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

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive document types are hidden from the Active filter and excluded from
                      new product/client mappings.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateDocumentTypeMutation.isPending}
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
