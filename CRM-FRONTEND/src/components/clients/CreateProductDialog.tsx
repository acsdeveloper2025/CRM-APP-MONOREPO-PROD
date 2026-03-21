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
} from '@/ui/components/Form';
import { Input } from '@/ui/components/Input';
import { Stack } from '@/ui/primitives/Stack';
import { productsService } from '@/services/products';

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Name too long'),
  code: z.string().min(2, 'Product code is required').max(50, 'Code too long'),
});

type CreateProductFormData = z.infer<typeof createProductSchema>;

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProductDialog({ open, onOpenChange }: CreateProductDialogProps) {
  const form = useForm<CreateProductFormData>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      code: '',
    },
  });

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateProductFormData) => productsService.createProduct({
      name: data.name,
      code: data.code,
    }),
    queryKey: ['products'],
    resourceName: 'Product',
    operation: 'create',
    additionalInvalidateKeys: [['product-stats'], ['dashboard']],
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CreateProductFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
          <DialogDescription>
            Create a standalone product that can be assigned to clients later. Products define the verification services you offer.
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
                    <Input placeholder="e.g., LOAN_VERIFICATION" {...field} />
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
                disabled={createMutation.isPending}
                fullWidth
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                fullWidth
              >
                {createMutation.isPending ? 'Creating...' : 'Create Product'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
