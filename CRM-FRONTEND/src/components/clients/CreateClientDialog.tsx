import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';

const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(100, 'Name too long'),
  code: z.string()
    .min(2, 'Client code must be at least 2 characters')
    .max(10, 'Client code must be at most 10 characters')
    .regex(/^[A-Z0-9_]+$/, 'Client code must contain only uppercase letters, numbers, and underscores'),
  productIds: z.array(z.string()).optional(),
  verificationTypeIds: z.array(z.string()).optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClientDialog({ open, onOpenChange }: CreateClientDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: '',
      code: '',
      productIds: [],
      verificationTypeIds: [],
    },
  });

  // Fetch products for selection
  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getProducts(),
    enabled: open,
  });

  // Fetch verification types for selection
  const { data: verificationTypesData } = useQuery({
    queryKey: ['verification-types'],
    queryFn: () => verificationTypesService.getVerificationTypes(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateClientFormData) => clientsService.createClient(data),
    onMutate: async (newClient) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['clients'] });

      // Snapshot the previous value
      const previousClients = queryClient.getQueriesData({ queryKey: ['clients'] });

      // Optimistically update to the new value
      queryClient.setQueriesData(
        { queryKey: ['clients'] },
        (old: any) => {
          if (!old?.data) return old;

          const optimisticClient = {
            id: `temp_${Date.now()}`,
            name: newClient.name,
            code: newClient.code,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            ...old,
            data: [optimisticClient, ...old.data]
          };
        }
      );

      // Return a context object with the snapshotted value
      return { previousClients };
    },
    onSuccess: (response) => {
      // Invalidate all client-related queries to ensure the list updates with real data
      queryClient.invalidateQueries({
        queryKey: ['clients'],
        exact: false // This will invalidate all queries that start with ['clients']
      });
      toast.success('Client created successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any, newClient, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousClients) {
        context.previousClients.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      console.error('Error creating client:', error);

      // Handle different types of errors
      if (error.response?.status === 400 && error.response?.data?.error?.code === 'DUPLICATE_CODE') {
        toast.error('Client code already exists. Please choose a different code.');
      } else if (error.response?.status === 401) {
        toast.error('You are not authorized to create clients. Please log in again.');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to create clients.');
      } else if (error.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to create client. Please try again.');
      }
    },
  });

  const onSubmit = (data: CreateClientFormData) => {
    createMutation.mutate(data);
  };

  const handleCodeChange = (value: string) => {
    // Auto-format code to uppercase and replace spaces with underscores
    const formattedCode = value.toUpperCase().replace(/\s+/g, '_');
    form.setValue('code', formattedCode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>
            Add a new client organization to the system. The client code will be used for identification.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {createMutation.isPending && (
              <div className="text-sm text-muted-foreground">
                Creating client...
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter client name"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        // Auto-generate code from name if code is empty
                        if (!form.getValues('code')) {
                          const autoCode = e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9\s]/g, '')
                            .replace(/\s+/g, '_')
                            .substring(0, 10);
                          form.setValue('code', autoCode);
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    The full name of the client organization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter client code"
                      {...field}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for the client (uppercase letters, numbers, and underscores only)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Products Selection */}
            <FormField
              control={form.control}
              name="productIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Products</FormLabel>
                  <FormDescription>
                    Select products to assign to this client (optional)
                  </FormDescription>
                  <ScrollArea className="h-32 w-full border rounded-md p-3">
                    {productsData?.data?.length ? (
                      <div className="space-y-2">
                        {productsData.data.map((product) => (
                          <div key={product.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`product-${product.id}`}
                              checked={field.value?.includes(product.id) || false}
                              onCheckedChange={(checked) => {
                                const currentIds = field.value || [];
                                if (checked) {
                                  field.onChange([...currentIds, product.id]);
                                } else {
                                  field.onChange(currentIds.filter(id => id !== product.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`product-${product.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {product.name}
                              <Badge variant="outline" className="ml-2 text-xs">
                                {product.code}
                              </Badge>
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No products available. Create products first.
                      </div>
                    )}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Verification Types Selection */}
            <FormField
              control={form.control}
              name="verificationTypeIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Types</FormLabel>
                  <FormDescription>
                    Select verification types to assign to this client (optional)
                  </FormDescription>
                  <ScrollArea className="h-32 w-full border rounded-md p-3">
                    {verificationTypesData?.data?.length ? (
                      <div className="space-y-2">
                        {verificationTypesData.data.map((verificationType) => (
                          <div key={verificationType.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`vtype-${verificationType.id}`}
                              checked={field.value?.includes(verificationType.id) || false}
                              onCheckedChange={(checked) => {
                                const currentIds = field.value || [];
                                if (checked) {
                                  field.onChange([...currentIds, verificationType.id]);
                                } else {
                                  field.onChange(currentIds.filter(id => id !== verificationType.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`vtype-${verificationType.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {verificationType.name}
                              {verificationType.code && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {verificationType.code}
                                </Badge>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No verification types available. Create verification types first.
                      </div>
                    )}
                  </ScrollArea>
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
                {createMutation.isPending ? 'Creating...' : 'Create Client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
