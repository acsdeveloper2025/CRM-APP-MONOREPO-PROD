import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Package, CheckCircle, Calendar, Code, Shield, FileText } from 'lucide-react';
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
import { LoadingSpinner } from '@/components/ui/loading';
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
  const verificationTypes = clientData.verificationTypes || [];
  const documentTypes = clientData.documentTypes || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
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
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      <span>Client Name</span>
                    </div>
                    <p className="font-medium">{clientData.name}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Code className="h-4 w-4" />
                      <span>Client Code</span>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {clientData.code}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
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
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
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
                <div className="text-center py-8 text-gray-600">
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
                          <p className="text-sm text-gray-600">
                            {product.verificationTypes?.length || 0} verification types
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
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

          {/* Verification Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Verification Types</span>
                <Badge variant="secondary">{verificationTypes.length}</Badge>
              </CardTitle>
              <CardDescription>
                Verification types available through this client's products
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verificationTypes.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No verification types found for this client</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {verificationTypes.map((vt: any) => (
                    <div key={vt.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-1">
                        <p className="font-medium">{vt.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {vt.code}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Document Types</span>
                <Badge variant="secondary">{documentTypes.length}</Badge>
              </CardTitle>
              <CardDescription>
                Document types assigned to this client
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documentTypes.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No document types assigned to this client</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documentTypes.map((dt: any) => (
                    <div key={dt.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-1">
                        <p className="font-medium">{dt.name}</p>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {dt.code}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {dt.category}
                          </Badge>
                        </div>
                      </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">{products.length}</p>
                  <p className="text-sm text-gray-600">Products</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">{verificationTypes.length}</p>
                  <p className="text-sm text-gray-600">Verification Types</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">{documentTypes.length}</p>
                  <p className="text-sm text-gray-600">Document Types</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
