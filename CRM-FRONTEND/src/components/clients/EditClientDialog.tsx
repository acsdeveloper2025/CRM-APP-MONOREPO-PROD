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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading';
import { clientsService } from '@/services/clients';
import { ProductMappingsEditor, type ProductMapping } from './ProductMappingsEditor';
import type { Client, Product } from '@/types/client';

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
      isActive: true,
      productMappings: [],
      primaryColor: '',
      headerColor: '',
    },
  });

  // Fetch client details with current associations
  const { data: clientData, isLoading: clientLoading } = useStandardizedQuery({
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

  // Fetch per-(client, product) mappings from the dedicated endpoint so each
  // product gets its own VT + DocType ids (not the cross-spread flat list).
  const { data: mappingsData, isLoading: mappingsLoading } = useStandardizedQuery({
    queryKey: ['client', client?.id, 'product-mappings'],
    queryFn: () => {
      if (!client) {
        throw new Error('Client ID missing');
      }
      return clientsService.getClientProductMappings(client.id);
    },
    enabled: open && !!client?.id,
    errorContext: 'Loading Client Product Mappings',
    errorFallbackMessage: 'Failed to load client product mappings',
  });

  const isInitialLoading = open && (clientLoading || mappingsLoading);

  // Update form when client data + mappings arrive. Wait for BOTH so the
  // dropdown values aren't cross-spread before mappings land.
  useEffect(() => {
    if (clientData?.data && mappingsData?.data) {
      const clientDetails = clientData.data;
      const productMappings: ProductMapping[] = (mappingsData.data || []).map((m) => ({
        productId: Number(m.productId),
        verificationTypeIds: (m.verificationTypeIds || []).map(Number),
        documentTypeIds: (m.documentTypeIds || []).map(Number),
      }));
      form.reset({
        name: clientDetails.name,
        code: clientDetails.code,
        isActive: clientDetails.isActive ?? true,
        productMappings,
        primaryColor: clientDetails.primaryColor ?? '',
        headerColor: clientDetails.headerColor ?? '',
      });
    }
  }, [clientData, mappingsData, form]);

  // Reset form to empty defaults when the dialog closes so reopening a
  // different record doesn't briefly show stale data while the new fetch is
  // in-flight.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset({
        name: '',
        code: '',
        isActive: true,
        productMappings: [],
        primaryColor: '',
        headerColor: '',
      });
    }
    onOpenChange(next);
  };

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
        isActive: data.isActive,
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
      handleOpenChange(false);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update client information and manage product/verification type connections.
          </DialogDescription>
        </DialogHeader>

        {isInitialLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
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

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Inactive clients are hidden from the Active filter and excluded from
                            new-case scope.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="mappings" className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Current Products</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {currentProducts.map((product: Product) => (
                        <Badge key={product.id} variant="secondary">
                          {product.name} ({product.code})
                        </Badge>
                      ))}
                      {currentProducts.length === 0 && (
                        <span className="text-sm text-muted-foreground">No products assigned</span>
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
                          Pick products this client uses, then assign verification and document
                          types for each (client, product) combination.
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
                    <h4 className="text-sm font-medium text-foreground">Report Colors</h4>
                    <p className="text-xs text-muted-foreground">
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
                    <h4 className="text-sm font-medium text-foreground">Logo & Stamp</h4>
                    <p className="text-xs text-muted-foreground">
                      Logo and agency stamp are now attached at report-generation time rather than
                      stored per client. When you click <strong>Download Report</strong> on a case,
                      a dialog lets you pick the logo and stamp for that specific PDF. Your choices
                      are remembered for the browser session, so you don&apos;t re-pick across
                      consecutive reports.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={updateMutation.isPending}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
