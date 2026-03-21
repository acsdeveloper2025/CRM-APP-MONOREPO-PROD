import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
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
import { Checkbox } from '@/ui/components/Checkbox';
import { ScrollArea } from '@/ui/components/ScrollArea';
import { Badge } from '@/ui/components/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { documentTypesService } from '@/services/documentTypes';
import type { CreateClientData } from '@/types/client';

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
    queryFn: () => documentTypesService.getDocumentTypes(),
    enabled: open,
    errorContext: 'Loading Document Types',
    errorFallbackMessage: 'Failed to load document types',
  });

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateClientFormData) => {
      // Convert productIds from string[] to number[]
      const cleanData: CreateClientData = {
        ...data,
        productIds: data.productIds?.map(id => parseInt(id, 10)),
      };
      return clientsService.createClient(cleanData);
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
  const selectionAreaStyle = {
    height: '12rem',
    width: '100%',
    border: '1px solid var(--ui-border)',
    borderRadius: 'var(--ui-radius-md)',
    padding: '0.75rem',
  } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 600px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>
            Add a new client organization to the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Stack gap={4}>
            <Tabs defaultValue="basic" style={{ width: '100%' }}>
              <TabsList style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.25rem' }}>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="verification-types">Verification</TabsTrigger>
                <TabsTrigger value="document-types">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="basic">
                <Stack gap={4}>
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
                          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                        />
                      </FormControl>
                      <FormDescription>
                        Unique identifier for the client (uppercase letters, numbers, and underscores only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </Stack>
              </TabsContent>

              <TabsContent value="products">
                <FormField
                  control={form.control}
                  name="productIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Products</FormLabel>
                      <FormDescription>
                        Select products to assign to this client
                      </FormDescription>
                      <ScrollArea style={selectionAreaStyle}>
                    {productsData?.data?.length ? (
                      <Stack gap={2}>
                        {productsData.data.map((product) => (
                          <Stack key={product.id} direction="horizontal" gap={2} align="center">
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
                              style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                            >
                              {product.name}
                              <Badge variant="outline" style={{ marginInlineStart: '0.5rem' }}>
                                {product.code}
                              </Badge>
                            </label>
                          </Stack>
                        ))}
                      </Stack>
                    ) : (
                      <Text variant="body-sm" tone="muted">
                        No products available. Create products first.
                      </Text>
                    )}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
              </TabsContent>

              <TabsContent value="verification-types">
                <FormField
                  control={form.control}
                  name="verificationTypeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Verification Types</FormLabel>
                      <FormDescription>
                        Select verification types to assign to this client
                      </FormDescription>
                      <ScrollArea style={selectionAreaStyle}>
                    {verificationTypesData?.data?.length ? (
                      <Stack gap={2}>
                        {verificationTypesData.data.map((verificationType) => (
                          <Stack key={verificationType.id} direction="horizontal" gap={2} align="center">
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
                              style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                            >
                              {verificationType.name}
                              {verificationType.code && (
                                <Badge variant="outline" style={{ marginInlineStart: '0.5rem' }}>
                                  {verificationType.code}
                                </Badge>
                              )}
                            </label>
                          </Stack>
                        ))}
                      </Stack>
                    ) : (
                      <Text variant="body-sm" tone="muted">
                        No verification types available. Create verification types first.
                      </Text>
                    )}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
              </TabsContent>

              <TabsContent value="document-types">
                <FormField
                  control={form.control}
                  name="documentTypeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Document Types</FormLabel>
                      <FormDescription>
                        Select document types to assign to this client
                      </FormDescription>
                      <ScrollArea style={selectionAreaStyle}>
                    {documentTypesData?.data?.length ? (
                      <Stack gap={2}>
                        {documentTypesData.data.map((documentType) => (
                          <Stack key={documentType.id} direction="horizontal" gap={2} align="center">
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
                              style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                            >
                              {documentType.name}
                              <Badge variant="outline" style={{ marginInlineStart: '0.5rem' }}>
                                {documentType.code}
                              </Badge>
                            </label>
                          </Stack>
                        ))}
                      </Stack>
                    ) : (
                      <Text variant="body-sm" tone="muted">
                        No document types available. Create document types first.
                      </Text>
                    )}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
              </TabsContent>
            </Tabs>

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
                {createMutation.isPending ? 'Creating...' : 'Create Client'}
              </Button>
            </DialogFooter>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
