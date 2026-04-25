import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clientsService } from '@/services/clients';
import { ProductMappingsEditor } from './ProductMappingsEditor';
import type { CreateClientData } from '@/types/client';

const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(100, 'Name too long'),
  code: z
    .string()
    .min(2, 'Client code must be at least 2 characters')
    .max(10, 'Client code must be at most 10 characters')
    .regex(
      /^[A-Z0-9_]+$/,
      'Client code must contain only uppercase letters, numbers, and underscores'
    ),
  productMappings: z
    .array(
      z.object({
        productId: z.number(),
        verificationTypeIds: z.array(z.number()),
        documentTypeIds: z.array(z.number()),
      })
    )
    .optional(),
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
      productMappings: [],
    },
  });

  const createMutation = useCRUDMutation({
    mutationFn: (data: CreateClientFormData) => {
      const mappings = data.productMappings || [];
      const productIds = mappings.map((m) => m.productId);
      const verificationTypeIds = Array.from(
        new Set(mappings.flatMap((m) => m.verificationTypeIds))
      );
      const documentTypeIds = Array.from(new Set(mappings.flatMap((m) => m.documentTypeIds)));
      const cleanData: CreateClientData = {
        name: data.name,
        code: data.code,
        productIds,
        verificationTypeIds,
        documentTypeIds,
        productMappings: mappings,
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
    const formattedCode = value.toUpperCase().replace(/\s+/g, '_');
    form.setValue('code', formattedCode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>Add a new client organization to the system.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-1">
                <TabsTrigger value="basic" className="text-xs sm:text-sm">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="mappings" className="text-xs sm:text-sm">
                  Products & Mappings
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
                        <Input
                          placeholder="Enter client name"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
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
                      <FormDescription>The full name of the client organization</FormDescription>
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
                        Unique identifier for the client (uppercase letters, numbers, and
                        underscores only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="mappings" className="space-y-4">
                <FormField
                  control={form.control}
                  name="productMappings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Products with Verification & Document Types</FormLabel>
                      <FormDescription>
                        Pick products this client will use, then assign verification and document
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
