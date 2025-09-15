import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Package, CheckCircle, Calendar, Code } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { clientsService } from '@/services/clients';
import { Client } from '@/types/client';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Client Details</span>
          </DialogTitle>
          <DialogDescription>
            Comprehensive information about {clientData.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>Client Name</span>
                    </div>
                    <p className="font-medium">{clientData.name}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Code className="h-4 w-4" />
                      <span>Client Code</span>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {clientData.code}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created Date</span>
                    </div>
                    <p className="text-sm">
                      {new Date(clientData.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      <span>Status</span>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Products</span>
                <Badge variant="secondary">{products.length}</Badge>
              </CardTitle>
              <CardDescription>
                Products associated with this client
              </CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No products found for this client</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {products.map((product, index) => (
                    <div key={product.id}>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.verificationTypes?.length || 0} verification types
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(product.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {index < products.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">{products.length}</p>
                  <p className="text-sm text-muted-foreground">Products</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">
                    {products.reduce((acc, product) => acc + (product.verificationTypes?.length || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Verification Types</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">0</p>
                  <p className="text-sm text-muted-foreground">Active Cases</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
