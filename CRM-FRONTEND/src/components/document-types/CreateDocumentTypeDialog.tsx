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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { documentTypesService } from '@/services/documentTypes';
import { DOCUMENT_CATEGORIES, DOCUMENT_TYPE_DISPLAY_NAMES } from '@/types/documentType';

const createDocumentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  code: z.string()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be at most 50 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
  description: z.string().max(1000, 'Description too long').optional(),
  category: z.enum(['IDENTITY', 'ADDRESS', 'FINANCIAL', 'EDUCATION', 'BUSINESS', 'OTHER']),
  isGovernmentIssued: z.boolean().default(false),
  requiresVerification: z.boolean().default(true),
  validityPeriodMonths: z.number().min(1).max(1200).optional(),
  formatPattern: z.string().max(500, 'Pattern too long').optional(),
  minLength: z.number().min(1).max(100).optional(),
  maxLength: z.number().min(1).max(100).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().min(0).max(9999).default(0),
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
      description: '',
      category: 'IDENTITY',
      isGovernmentIssued: false,
      requiresVerification: true,
      isActive: true,
      sortOrder: 0,
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
      console.error('Failed to create document type:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Document Type</DialogTitle>
          <DialogDescription>
            Add a new document type for verification processes
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Aadhaar Card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of the document type..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(DOCUMENT_CATEGORIES).map((category) => (
                        <SelectItem key={category} value={category}>
                          {DOCUMENT_TYPE_DISPLAY_NAMES[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="validityPeriodMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validity Period (Months)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 120"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription>Leave empty for permanent documents</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isGovernmentIssued"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Government Issued</FormLabel>
                      <FormDescription>
                        Is this document issued by a government authority?
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

              <FormField
                control={form.control}
                name="requiresVerification"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Requires Verification</FormLabel>
                      <FormDescription>
                        Does this document require verification?
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

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Is this document type currently active?
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
            </div>

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
