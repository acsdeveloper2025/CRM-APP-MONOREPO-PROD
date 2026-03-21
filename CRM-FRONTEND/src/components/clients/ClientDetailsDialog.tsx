import { useQuery } from '@tanstack/react-query';
import { Building2, Package, CheckCircle, Calendar, Code, Shield, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import { Badge } from '@/ui/components/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Separator } from '@/ui/components/Separator';
import { LoadingSpinner } from '@/ui/components/Loading';
import { Grid } from '@/ui/layout/Grid';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { clientsService } from '@/services/clients';
import { Client, VerificationType } from '@/types/client';


interface ClientDetailsDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailsDialog({ client, open, onOpenChange }: ClientDetailsDialogProps) {
  const { data: clientDetails, isLoading } = useQuery({
    queryKey: ['client', client.id],
    queryFn: () => clientsService.getClientById(client.id),
    enabled: open,
  });

  const { data: clientProducts } = useQuery({
    queryKey: ['client-products', client.id],
    queryFn: () => clientsService.getProductsByClient(client.id),
    enabled: open,
  });

  const clientData = clientDetails?.data || client;
  const products = clientProducts?.data || [];
  const verificationTypes = clientData.verificationTypes || [];
  const documentTypes = clientData.documentTypes || [];

  const details = [
    { icon: Building2, label: 'Client Name', value: clientData.name },
    { icon: Code, label: 'Client Code', value: <Badge variant="outline">{clientData.code}</Badge> },
    {
      icon: Calendar,
      label: 'Created Date',
      value: new Date(clientData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    },
    { icon: CheckCircle, label: 'Status', value: <Badge variant="positive">Active</Badge> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 600px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <DialogHeader>
          <Stack direction="horizontal" gap={2} align="center">
            <Building2 size={20} />
            <DialogTitle>Client Details</DialogTitle>
          </Stack>
          <DialogDescription>
            Comprehensive information about {clientData.name}
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
                <Package size={20} />
                <CardTitle>Products</CardTitle>
                <Badge variant="secondary">{products.length}</Badge>
              </Stack>
              <CardDescription>
                Products associated with this client
              </CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <Stack gap={3} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
                  <Package size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.5 }} />
                  <Text tone="muted">No products found for this client</Text>
                </Stack>
              ) : (
                <Stack gap={3}>
                  {products.map((product, index) => (
                    <Box key={product.id}>
                      <Card tone="muted" staticCard>
                        <Stack direction="horizontal" justify="space-between" align="center" gap={3} wrap="wrap">
                          <Stack gap={1}>
                            <Text variant="label">{product.name}</Text>
                            <Text variant="body-sm" tone="muted">
                              {product.verificationTypes?.length || 0} verification types
                            </Text>
                          </Stack>
                          <Text variant="body-sm" tone="muted">
                            Created {new Date(product.createdAt).toLocaleDateString()}
                          </Text>
                        </Stack>
                      </Card>
                      {index < products.length - 1 && <Separator style={{ marginBlock: '0.5rem' }} />}
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Stack direction="horizontal" gap={2} align="center">
                <Shield size={20} />
                <CardTitle>Verification Types</CardTitle>
                <Badge variant="secondary">{verificationTypes.length}</Badge>
              </Stack>
              <CardDescription>
                Verification types available through this client&apos;s products
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verificationTypes.length === 0 ? (
                <Stack gap={3} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
                  <Shield size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.5 }} />
                  <Text tone="muted">No verification types found for this client</Text>
                </Stack>
              ) : (
                <Grid min={220}>
                  {verificationTypes.map((vt: VerificationType) => (
                    <Card key={vt.id} tone="muted" staticCard>
                      <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                        <Stack gap={1}>
                          <Text variant="label">{vt.name}</Text>
                          <Badge variant="outline">
                          {vt.code}
                          </Badge>
                        </Stack>
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
                <FileText size={20} />
                <CardTitle>Document Types</CardTitle>
                <Badge variant="secondary">{documentTypes.length}</Badge>
              </Stack>
              <CardDescription>
                Document types assigned to this client
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documentTypes.length === 0 ? (
                <Stack gap={3} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
                  <FileText size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.5 }} />
                  <Text tone="muted">No document types assigned to this client</Text>
                </Stack>
              ) : (
                <Grid min={220}>
                  {documentTypes.map((dt) => (
                    <Card key={dt.id} tone="muted" staticCard>
                      <Stack gap={1}>
                        <Text variant="label">{dt.name}</Text>
                        <Stack direction="horizontal" gap={2} wrap="wrap">
                          <Badge variant="outline">
                            {dt.code}
                          </Badge>
                        </Stack>
                      </Stack>
                    </Card>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <Grid min={160}>
                {[
                  ['Products', products.length],
                  ['Verification Types', verificationTypes.length],
                  ['Document Types', documentTypes.length],
                ].map(([label, value]) => (
                  <Card key={label} tone="highlight" staticCard>
                    <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
                      <Text variant="headline" tone="accent">{value}</Text>
                      <Text variant="body-sm" tone="muted">{label}</Text>
                    </Stack>
                  </Card>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
