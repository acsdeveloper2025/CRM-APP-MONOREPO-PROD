import { useEffect } from 'react';
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
import type { Client, Product, VerificationType } from '@/types/client';
import type { DocumentType } from '@/types/documentType';

// Hex color validator: #RGB or #RRGGBB (empty string allowed to clear).
const HEX_COLOR_REGEX = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/;

const editClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(100, 'Name too long'),
  code: z
    .string()
    .min(2, 'Client code must be at least 2 characters')
    .max(10, 'Client code must be at most 10 characters')
    .regex(
      /^[A-Z0-9_]+$/,
      'Client code must contain only uppercase letters, numbers, and underscores'
    ),
  productIds: z.array(z.string()).optional(),
  verificationTypeIds: z.array(z.number()).optional(),
  documentTypeIds: z.array(z.number()).optional(),
  primaryColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Must be a hex color like #FF9800 or empty')
    .optional(),
  headerColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Must be a hex color like #FFEB3B or empty')
    .optional(),
});

type EditClientFormData = z.infer<typeof editClientSchema>;

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function EditClientDialog({ open, onOpenChange, client }: EditClientDialogProps) {
  const form = useForm<EditClientFormData>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      name: '',
      code: '',
      productIds: [],
      verificationTypeIds: [],
      documentTypeIds: [],
      primaryColor: '',
      headerColor: '',
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
    queryFn: () => documentTypesService.getDocumentTypes(),
    enabled: open,
    errorContext: 'Loading Document Types',
    errorFallbackMessage: 'Failed to load document types',
  });

  // Fetch client details with current associations
  const { data: clientData } = useStandardizedQuery({
    queryKey: ['client', client?.id],
    queryFn: () => {
      if (!client) {
        throw new Error('Client ID missing');
      }
      return clientsService.getClientById(client.id);
    },
    enabled: open && !!client?.id,
    errorContext: 'Loading Client Details',
    errorFallbackMessage: 'Failed to load client details',
  });

  // Update form when client data changes
  useEffect(() => {
    if (clientData?.data) {
      const clientDetails = clientData.data;
      form.reset({
        name: clientDetails.name,
        code: clientDetails.code,
        productIds: clientDetails.products?.map((p: Product) => String(p.id)) || [],
        verificationTypeIds:
          clientDetails.verificationTypes?.map((v: VerificationType) => v.id) || [],
        documentTypeIds: clientDetails.documentTypes?.map((d: DocumentType) => d.id) || [],
        primaryColor: clientDetails.primaryColor ?? '',
        headerColor: clientDetails.headerColor ?? '',
      });
    }
  }, [clientData, form]);

  const updateMutation = useCRUDMutation({
    mutationFn: async (data: EditClientFormData) => {
      // Update client with replace-all semantics for mappings
      const cleanData = {
        name: data.name,
        code: data.code,
        productIds: data.productIds?.map((id) => parseInt(id, 10)),
        verificationTypeIds: data.verificationTypeIds,
        documentTypeIds: data.documentTypeIds,
        // Empty string means "clear the column" on the backend side.
        primaryColor: data.primaryColor ?? '',
        headerColor: data.headerColor ?? '',
      };
      if (!client) {
        throw new Error('Client ID missing');
      }
      return clientsService.updateClient(client.id, cleanData);
    },
    queryKey: ['clients'],
    resourceName: 'Client',
    operation: 'update',
    additionalInvalidateKeys: [['client', client?.id], ['dashboard']],
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditClientFormData) => {
    updateMutation.mutate(data);
  };

  if (!client) {
    return null;
  }

  const products = productsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];
  const currentProducts = clientData?.data?.products || [];
  const currentDocumentTypes = clientData?.data?.documentTypes || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update client information and manage product/verification type connections.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-1">
                <TabsTrigger value="basic" className="text-xs sm:text-sm">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="products" className="text-xs sm:text-sm">
                  Products
                </TabsTrigger>
                <TabsTrigger value="verification-types" className="text-xs sm:text-sm">
                  Verification
                </TabsTrigger>
                <TabsTrigger value="document-types" className="text-xs sm:text-sm">
                  Documents
                </TabsTrigger>
                <TabsTrigger value="branding" className="text-xs sm:text-sm">
                  Branding
                </TabsTrigger>
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
                        Unique identifier for this client (uppercase letters, numbers, and
                        underscores only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Current Products</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentProducts.map((product: Product) => (
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
                      <FormDescription>Select products to assign to this client</FormDescription>
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
                                      field.onChange(
                                        currentIds.includes(productIdStr)
                                          ? currentIds
                                          : [...currentIds, productIdStr]
                                      );
                                    } else {
                                      field.onChange(
                                        currentIds.filter((id) => id !== productIdStr)
                                      );
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
                      <FormLabel>Verification Types</FormLabel>
                      <FormDescription>
                        Select verification types to assign to this client
                      </FormDescription>
                      <ScrollArea className="h-48 w-full border rounded-md p-3">
                        {verificationTypes.length ? (
                          <div className="space-y-2">
                            {verificationTypes.map((verificationType) => (
                              <div
                                key={verificationType.id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`vtype-${verificationType.id}`}
                                  checked={field.value?.includes(verificationType.id) || false}
                                  onCheckedChange={(checked) => {
                                    const currentIds = field.value || [];
                                    if (checked) {
                                      field.onChange(
                                        currentIds.includes(verificationType.id)
                                          ? currentIds
                                          : [...currentIds, verificationType.id]
                                      );
                                    } else {
                                      field.onChange(
                                        currentIds.filter((id) => id !== verificationType.id)
                                      );
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
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Current Document Types</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentDocumentTypes.map((documentType: DocumentType) => (
                      <Badge key={documentType.id} variant="secondary">
                        {documentType.name}
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
                                      field.onChange(
                                        currentIds.includes(documentType.id)
                                          ? currentIds
                                          : [...currentIds, documentType.id]
                                      );
                                    } else {
                                      field.onChange(
                                        currentIds.filter((id) => id !== documentType.id)
                                      );
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`dtype-${documentType.id}`}
                                  className="text-sm font-medium leading-none text-gray-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-gray-900">{documentType.name}</div>
                                      <div className="text-xs text-gray-600">
                                        {documentType.code}
                                      </div>
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

              <TabsContent value="branding" className="space-y-6">
                <div className="rounded-md border p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Report Colors</h4>
                  <p className="text-xs text-gray-600">
                    Used by PDF report templates. Leave blank to keep the template defaults.
                  </p>
                  <FormField
                    control={form.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color (field labels, accents)</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="h-10 w-16 cursor-pointer p-1"
                              value={field.value || '#FF9800'}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                            <Input
                              type="text"
                              placeholder="#FF9800"
                              className="flex-1 font-mono"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => field.onChange('')}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="headerColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Color (title banner)</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="h-10 w-16 cursor-pointer p-1"
                              value={field.value || '#FFEB3B'}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                            <Input
                              type="text"
                              placeholder="#FFEB3B"
                              className="flex-1 font-mono"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => field.onChange('')}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-md border border-dashed p-4 space-y-2 bg-muted/20">
                  <h4 className="text-sm font-medium text-gray-900">Logo & Stamp</h4>
                  <p className="text-xs text-gray-600">
                    Logo and agency stamp are now attached at report-generation time rather than
                    stored per client. When you click <strong>Download Report</strong> on a case, a
                    dialog lets you pick the logo and stamp for that specific PDF. Your choices are
                    remembered for the browser session, so you don&apos;t re-pick across consecutive
                    reports.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
