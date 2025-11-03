import React, { useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import toast from 'react-hot-toast';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { documentTypesService } from '@/services/documentTypes';
import type { Client } from '@/types/client';

const editClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(100, 'Name too long'),
  code: z.string()
    .min(2, 'Client code must be at least 2 characters')
    .max(10, 'Client code must be at most 10 characters')
    .regex(/^[A-Z0-9_]+$/, 'Client code must contain only uppercase letters, numbers, and underscores'),
  productIds: z.array(z.string()).optional(),
  verificationTypeIds: z.array(z.number()).optional(),
  documentTypeIds: z.array(z.number()).optional(),
});

type EditClientFormData = z.infer<typeof editClientSchema>;

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function EditClientDialog({ open, onOpenChange, client }: EditClientDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditClientFormData>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      name: '',
      code: '',
      productIds: [],
      verificationTypeIds: [],
      documentTypeIds: [],
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

  // Fetch document types for selection
  const { data: documentTypesData } = useQuery({
    queryKey: ['document-types'],
    queryFn: () => documentTypesService.getDocumentTypes({ isActive: true }),
    enabled: open,
  });

  // Fetch client details with current associations
  const { data: clientData } = useQuery({
    queryKey: ['client', client?.id],
    queryFn: () => clientsService.getClientById(client!.id),
    enabled: open && !!client?.id,
  });

  // Update form when client data changes
  useEffect(() => {
    if (clientData?.data) {
      const clientDetails = clientData.data;
      form.reset({
        name: clientDetails.name,
        code: clientDetails.code,
        productIds: clientDetails.products?.map((p: any) => String(p.id)) || [],
        verificationTypeIds: clientDetails.verificationTypes?.map((v: any) => v.id) || [],
        documentTypeIds: clientDetails.documentTypes?.map((d: any) => d.id) || [],
      });
    }
  }, [clientData, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditClientFormData) => {
      // Update client with replace-all semantics for mappings
      await clientsService.updateClient(client!.id, {
        name: data.name,
        code: data.code,
        productIds: data.productIds,
        verificationTypeIds: data.verificationTypeIds,
        documentTypeIds: data.documentTypeIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', client?.id] });
      toast.success('Client updated successfully');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update client');
    },
  });

  const onSubmit = (data: EditClientFormData) => {
    updateMutation.mutate(data);
  };

  if (!client) return null;

  const products = productsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];
  const documentTypes = documentTypesData?.data || [];
  const currentProducts = clientData?.data?.products || [];
  const currentVerificationTypes = clientData?.data?.verificationTypes || [];
  const currentDocumentTypes = clientData?.data?.documentTypes || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update client information and manage product/verification type connections.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="verification-types">Verification Types</TabsTrigger>
                <TabsTrigger value="document-types">Document Types</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter client name" {...field} />
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
                      <FormLabel>Client Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ACME_CORP" {...field} />
                      </FormControl>
                      <FormDescription>
                        Unique identifier for this client (uppercase letters, numbers, and underscores only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Current Products</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentProducts.map((product: any) => (
                      <Badge key={product.id} variant="secondary">
                        {product.name} ({product.code})
                      </Badge>
                    ))}
                    {currentProducts.length === 0 && (
                      <span className="text-sm text-gray-600">No products assigned</span>
                    )}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="productIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Products</FormLabel>
                      <FormDescription>
                        Select products to assign to this client
                      </FormDescription>
                      <ScrollArea className="h-48 w-full border rounded-md p-3">
                        {products.length ? (
                          <div className="space-y-2">
                            {products.map((product) => (
                              <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`product-${product.id}`}
                                  checked={field.value?.includes(String(product.id)) || false}
                                  onCheckedChange={(checked) => {
                                    const currentIds = field.value || [];
                                    const productIdStr = String(product.id);
                                    if (checked) {
                                      field.onChange([...currentIds, productIdStr]);
                                    } else {
                                      field.onChange(currentIds.filter(id => id !== productIdStr));
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
                          <div className="text-sm text-gray-600">
                            No products available. Create products first.
                          </div>
                        )}
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="verification-types" className="space-y-4">
                <FormField
                  control={form.control}
                  name="verificationTypeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Types</FormLabel>
                      <FormDescription>
                        Select verification types to assign to this client
                      </FormDescription>
                      <ScrollArea className="h-48 w-full border rounded-md p-3">
                        {verificationTypes.length ? (
                          <div className="space-y-2">
                            {verificationTypes.map((verificationType) => (
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
                          <div className="text-sm text-gray-600">
                            No verification types available. Create verification types first.
                          </div>
                        )}
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="document-types" className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Current Document Types</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentDocumentTypes.map((documentType: any) => (
                      <Badge key={documentType.id} variant="secondary">
                        {documentType.name}
                        <span className="ml-1 text-xs">({documentType.category})</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="documentTypeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Document Types</FormLabel>
                      <FormDescription>
                        Select document types to assign to this client
                      </FormDescription>
                      <ScrollArea className="h-48 w-full border rounded-md p-3">
                        {documentTypesData?.data?.length ? (
                          <div className="space-y-2">
                            {documentTypesData.data.map((documentType) => (
                              <div key={documentType.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`dtype-${documentType.id}`}
                                  checked={field.value?.includes(documentType.id) || false}
                                  onCheckedChange={(checked) => {
                                    const currentIds = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentIds, documentType.id]);
                                    } else {
                                      field.onChange(currentIds.filter(id => id !== documentType.id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`dtype-${documentType.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div>{documentType.name}</div>
                                      <div className="text-xs text-gray-600">
                                        {documentType.code} • {documentType.category}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      {documentType.isGovernmentIssued && (
                                        <Badge variant="outline" className="text-xs">Govt</Badge>
                                      )}
                                      {documentType.requiresVerification && (
                                        <Badge variant="outline" className="text-xs">Verify</Badge>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">
                            No document types available. Create document types first.
                          </div>
                        )}
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
