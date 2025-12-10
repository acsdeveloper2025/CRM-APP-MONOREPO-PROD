import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
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
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { documentTypesService } from '@/services/documentTypes';

const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(100, 'Name too long'),
  code: z.string()
    .min(2, 'Client code must be at least 2 characters')
    .max(10, 'Client code must be at most 10 characters')
    .regex(/^[A-Z0-9_]+$/, 'Client code must contain only uppercase letters, numbers, and underscores'),
  productIds: z.array(z.string()).optional(),
  verificationTypeIds: z.array(z.number()).optional(),
  documentTypeIds: z.array(z.number()).optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClientDialog({ open, onOpenChange }: CreateClientDialogProps) {
  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: '',
      code: '',
      productIds: [],
      verificationTypeIds: [],
      documentTypeIds: [],
    },
  });

  // Fetch products for selection
  const { data: productsData } = useStandardizedQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getProducts(),
    enabled: open,
    errorContext: 'Loading Products',
    errorFallbackMessage: 'Failed to load products',
  });

  // Fetch verification types for selection
  const { data: verificationTypesData } = useStandardizedQuery({
    queryKey: ['verification-types'],
    queryFn: () => verificationTypesService.getVerificationTypes(),
    enabled: open,
    errorContext: 'Loading Verification Types',
    errorFallbackMessage: 'Failed to load verification types',
  });

  // Fetch document types for selection
  const { data: documentTypesData } = useStandardizedQuery({
    queryKey: ['document-types'],
    queryFn: () => documentTypesService.getDocumentTypes({ isActive: true }),
    enabled: open,
    errorContext: 'Loading Document Types',
    errorFallbackMessage: 'Failed to load document types',
  });

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateClientFormData) => {
      // Convert productIds from string[] to number[]
      const cleanData = {
        ...data,
        productIds: data.productIds?.map(id => parseInt(id, 10)),
      };
      return clientsService.createClient(cleanData as unknown);
    },
    queryKey: ['clients'],
    resourceName: 'Client',
    operation: 'create',
    additionalInvalidateKeys: [['dashboard']],
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
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
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>
            Add a new client organization to the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1">
                <TabsTrigger value="basic" className="text-xs sm:text-sm">Basic Info</TabsTrigger>
                <TabsTrigger value="products" className="text-xs sm:text-sm">Products</TabsTrigger>
                <TabsTrigger value="verification-types" className="text-xs sm:text-sm">Verification</TabsTrigger>
                <TabsTrigger value="document-types" className="text-xs sm:text-sm">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
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
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
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
                    {productsData?.data?.length ? (
                      <div className="space-y-2">
                        {productsData.data.map((product) => (
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
                              className="text-sm font-medium leading-none text-gray-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
                      <FormLabel>Available Verification Types</FormLabel>
                      <FormDescription>
                        Select verification types to assign to this client
                      </FormDescription>
                      <ScrollArea className="h-48 w-full border rounded-md p-3">
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
                              className="text-sm font-medium leading-none text-gray-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
                              className="text-sm font-medium leading-none text-gray-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {documentType.name}
                              <Badge variant="outline" className="ml-2 text-xs">
                                {documentType.code}
                              </Badge>
                              <Badge variant="secondary" className="ml-1 text-xs">
                                {documentType.category}
                              </Badge>
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

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
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
