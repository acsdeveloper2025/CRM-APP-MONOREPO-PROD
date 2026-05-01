import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { editClientFormSchema, type EditClientFormData } from '@/forms/schemas/client.schema';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clientsService } from '@/services/clients';
import { ProductMappingsEditor, type ProductMapping } from './ProductMappingsEditor';
import type { Client, Product, VerificationType } from '@/types/client';
import type { DocumentType } from '@/types/documentType';

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function EditClientDialog({ open, onOpenChange, client }: EditClientDialogProps) {
  const form = useForm<EditClientFormData>({
    resolver: zodResolver(editClientFormSchema),
    defaultValues: {
      name: '',
      code: '',
      productMappings: [],
      primaryColor: '',
      headerColor: '',
    },
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

  // Update form when client data changes — collapse legacy flat associations into per-product mappings
  useEffect(() => {
    if (clientData?.data) {
      const clientDetails = clientData.data;
      const products: Product[] = clientDetails.products || [];
      const vtIds: number[] =
        clientDetails.verificationTypes?.map((v: VerificationType) => v.id) || [];
      const dtIds: number[] = clientDetails.documentTypes?.map((d: DocumentType) => d.id) || [];
      // Backend currently returns aggregated flat lists; spread same lists across each product
      // until per-product detail endpoint is added (Phase 3 follow-up).
      const productMappings: ProductMapping[] = products.map((p) => ({
        productId: Number(p.id),
        verificationTypeIds: vtIds,
        documentTypeIds: dtIds,
      }));
      form.reset({
        name: clientDetails.name,
        code: clientDetails.code,
        productMappings,
        primaryColor: clientDetails.primaryColor ?? '',
        headerColor: clientDetails.headerColor ?? '',
      });
    }
  }, [clientData, form]);

  const updateMutation = useCRUDMutation({
    mutationFn: async (data: EditClientFormData) => {
      const mappings = data.productMappings || [];
      // Backward-compat flat fields derived from per-product mappings
      const productIds = mappings.map((m) => m.productId);
      const verificationTypeIds = Array.from(
        new Set(mappings.flatMap((m) => m.verificationTypeIds))
      );
      const documentTypeIds = Array.from(new Set(mappings.flatMap((m) => m.documentTypeIds)));
      const cleanData = {
        name: data.name,
        code: data.code,
        productIds,
        verificationTypeIds,
        documentTypeIds,
        productMappings: mappings,
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

  const currentProducts = clientData?.data?.products || [];

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
              <TabsList className="grid w-full grid-cols-3 gap-1">
                <TabsTrigger value="basic" className="text-xs sm:text-sm">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="mappings" className="text-xs sm:text-sm">
                  Products & Mappings
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

              <TabsContent value="mappings" className="space-y-4">
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
                  name="productMappings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Products with Verification & Document Types</FormLabel>
                      <FormDescription>
                        Pick products this client uses, then assign verification and document types
                        for each (client, product) combination.
                      </FormDescription>
                      <ProductMappingsEditor
                        value={field.value || []}
                        onChange={field.onChange}
                        enabled={open}
                      />
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
