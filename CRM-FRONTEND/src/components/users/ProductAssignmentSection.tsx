import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { usersService } from '@/services/users';
import { productsService } from '@/services/products';
import { toast } from 'sonner';
import type { User } from '@/types/user';
import type { Product } from '@/types/product';
import { LoadingSpinner } from '@/components/ui/loading';
import { isBackendScopedUser } from '@/utils/userPermissionProfiles';

interface ProductAssignmentSectionProps {
  user: User;
}

export function ProductAssignmentSection({ user }: ProductAssignmentSectionProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch all products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productsService.getProducts({ limit: 100 }),
  });

  // Fetch current user product assignments
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-product-assignments', user.id],
    queryFn: () => usersService.getUserProductAssignments(user.id),
  });

  // Update selected products when assignments data loads
  useEffect(() => {
    if (assignmentsData?.data) {
      const assignedProductIds = assignmentsData.data.map((assignment: { productId: number }) => assignment.productId);
      setSelectedProductIds(assignedProductIds);
    }
  }, [assignmentsData]);

  // Save assignments mutation
  const saveAssignmentsMutation = useMutation({
    mutationFn: (productIds: number[]) => usersService.assignProductsToUser(user.id, productIds),
    onSuccess: () => {
      toast.success('Product assignments updated successfully');
      // Invalidate all user-related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-product-assignments', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to update product assignments');
    },
  });

  // Only show for BACKEND_USER users (moved after all hooks)
  if (!isBackendScopedUser(user)) {
    return null;
  }

  const products = productsData?.data || [];

  const handleProductToggle = (productId: number, checked: boolean) => {
    if (checked) {
      setSelectedProductIds(prev => [...prev, productId]);
    } else {
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
    }
  };

  const handleSaveAssignments = () => {
    saveAssignmentsMutation.mutate(selectedProductIds);
  };

  const isLoading = productsLoading || assignmentsLoading || saveAssignmentsMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Assignments
        </CardTitle>
        <CardDescription>
          Select which products this user can access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {products.map((product: Product) => (
                <div key={product.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`product-${product.id}`}
                    checked={selectedProductIds.includes(product.id)}
                    onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean)}
                  />
                  <label
                    htmlFor={`product-${product.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {product.name}
                  </label>
                </div>
              ))}
            </div>
            <Button 
              onClick={handleSaveAssignments}
              disabled={saveAssignmentsMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Product Assignments
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
