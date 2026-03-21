import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/form';
import { Input } from '@/ui/components/Input';
import { Stack } from '@/ui/primitives/Stack';
import { clientsService } from '@/services/clients';
import { Product } from '@/types/client';

const editProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Name too long'),
  code: z.string().min(2, 'Product code is required').max(50, 'Code too long'),
});

type EditProductFormData = z.infer<typeof editProductSchema>;

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const form = useForm<EditProductFormData>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      name: product.name,
      code: product.code,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        code: product.code,
      });
    }
  }, [product, form]);

  const updateMutation = useCRUDMutation({
    mutationFn: (data: EditProductFormData) => clientsService.updateProduct(product.id, data),
    queryKey: ['products'],
    resourceName: 'Product',
    operation: 'update',
    additionalInvalidateKeys: [['product-stats'], ['dashboard']],
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditProductFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update the product information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Stack gap={4}>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., LOAN_VERIFICATION"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for this product
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
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter product name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The name of the product or service
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                fullWidth
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                fullWidth>
                {updateMutation.isPending ? 'Updating...' : 'Update Product'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
