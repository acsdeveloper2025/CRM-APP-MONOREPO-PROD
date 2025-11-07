import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Building2, CheckCircle, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
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
  const verificationTypes = { data: product.verificationTypes || [] } as any;

  const productData = productDetails?.data || product;
  const types = verificationTypes?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Product Details</span>
          </DialogTitle>
          <DialogDescription>
            Comprehensive information about {productData.name}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Package className="h-4 w-4" />
                      <span>Product Name</span>
                    </div>
                    <p className="font-medium">{productData.name}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      <span>Verification Types</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Types vary per client-product mapping
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>Created Date</span>
                    </div>
                    <p className="text-sm">
                      {new Date(productData.createdAt).toLocaleDateString('en-US', {
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

          {/* Verification Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <span>Verification Types</span>
                <Badge variant="secondary">{types.length}</Badge>
              </CardTitle>
              <CardDescription>
                Verification types available for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              {types.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <CheckCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No verification types found for this product</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {types.map((type) => (
                    <div key={type.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-1">
                        <p className="font-medium">{type.name}</p>
                        <p className="text-sm text-gray-600">
                          Created {new Date(type.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
