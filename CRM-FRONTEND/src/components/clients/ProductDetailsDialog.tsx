import { useQuery } from '@tanstack/react-query';
import { Package, Building2, CheckCircle, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Badge } from '@/ui/components/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { LoadingSpinner } from '@/ui/components/loading';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { clientsService } from '@/services/clients';
import { Product } from '@/types/client';

interface ProductDetailsDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailsDialog({ product, open, onOpenChange }: ProductDetailsDialogProps) {
  const { data: productDetails, isLoading } = useQuery({
    queryKey: ['product', product.id],
    queryFn: () => clientsService.getProductById(product.id),
    enabled: open,
  });

  // Note: Product details are independent of a specific client; verification types vary per client-product mapping.
  const verificationTypes = { data: product.verificationTypes || [] };

  const productData = productDetails?.data || product;
  const types = verificationTypes.data || [];

  const details = [
    { icon: Package, label: 'Product Name', value: productData.name },
    { icon: Building2, label: 'Verification Types', value: 'Types vary per client-product mapping' },
    {
      icon: Calendar,
      label: 'Created Date',
      value: new Date(productData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    },
    { icon: CheckCircle, label: 'Status', value: <Badge variant="positive">Active</Badge> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 600px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <DialogHeader>
          <Stack direction="horizontal" gap={2} align="center">
            <Package size={20} />
            <DialogTitle>Product Details</DialogTitle>
          </Stack>
          <DialogDescription>
            Comprehensive information about {productData.name}
          </DialogDescription>
        </DialogHeader>

        <Stack gap={5}>
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Stack align="center" justify="center" style={{ minHeight: '8rem' }}>
                  <LoadingSpinner size="md" />
                </Stack>
              ) : (
                <Grid min={220}>
                  {details.map((item) => (
                    <Card key={item.label} tone="muted" staticCard>
                      <Stack gap={2}>
                        <Stack direction="horizontal" gap={2} align="center">
                          <item.icon size={16} style={{ color: 'var(--ui-text-soft)' }} />
                          <Text variant="label" tone="muted">{item.label}</Text>
                        </Stack>
                        {typeof item.value === 'string' ? (
                          <Text variant="body">{item.value}</Text>
                        ) : (
                          item.value
                        )}
                      </Stack>
                    </Card>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Stack direction="horizontal" gap={2} align="center">
                <CheckCircle size={20} />
                <CardTitle>Verification Types</CardTitle>
                <Badge variant="secondary">{types.length}</Badge>
              </Stack>
              <CardDescription>
                Verification types available for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              {types.length === 0 ? (
                <Stack gap={3} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
                  <CheckCircle size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.5 }} />
                  <Text tone="muted">No verification types found for this product</Text>
                </Stack>
              ) : (
                <Stack gap={2}>
                  {types.map((type) => (
                    <Card key={type.id} tone="muted" staticCard>
                      <Stack direction="horizontal" justify="space-between" align="center" gap={3} wrap="wrap">
                        <Stack gap={1}>
                          <Text variant="label">{type.name}</Text>
                          <Text variant="body-sm" tone="muted">
                          Created {new Date(type.createdAt).toLocaleDateString()}
                          </Text>
                        </Stack>
                        <Badge variant="positive">Active</Badge>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
