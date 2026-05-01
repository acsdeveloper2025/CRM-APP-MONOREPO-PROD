import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Package, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { usersService } from '@/services/users';
import { productsService } from '@/services/products';
import type { User, UserClientAssignment } from '@/types/user';
import type { Product } from '@/types/product';
import { LoadingSpinner } from '@/components/ui/loading';
import { isBackendScopedUser } from '@/utils/userPermissionProfiles';

interface ProductAssignmentSectionProps {
  user: User;
}

export function ProductAssignmentSection({ user }: ProductAssignmentSectionProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  // 1. Fetch user's currently assigned clients — products dropdown is scoped to these.
  const { data: clientAssignmentsData, isLoading: clientAssignmentsLoading } = useQuery({
    queryKey: ['user-client-assignments', user.id],
    queryFn: () => usersService.getUserClientAssignments(user.id),
  });

  const assignedClients = useMemo<UserClientAssignment[]>(
    () => (Array.isArray(clientAssignmentsData?.data) ? clientAssignmentsData.data : []),
    [clientAssignmentsData]
  );

  // 2. For every assigned client, fetch its products in parallel.
  const productQueries = useQueries({
    queries: assignedClients.map((c) => ({
      queryKey: ['client-products', c.clientId],
      queryFn: () => productsService.getProductsByClient(String(c.clientId)),
      enabled: !!c.clientId,
    })),
  });

  const productsByClient = useMemo(() => {
    return assignedClients.map((c, i) => ({
      client: c,
      products: (productQueries[i]?.data?.data || []) as Product[],
    }));
  }, [assignedClients, productQueries]);

  const productsLoading = productQueries.some((q) => q.isLoading);

  // 3. Fetch current user product assignments to seed checked state.
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-product-assignments', user.id],
    queryFn: () => usersService.getUserProductAssignments(user.id),
  });

  useEffect(() => {
    if (assignmentsData?.data) {
      const assignedProductIds = assignmentsData.data.map(
        (assignment: { productId: number }) => assignment.productId
      );
      setSelectedProductIds(assignedProductIds);
    }
  }, [assignmentsData]);

  const saveAssignmentsMutation = useMutationWithInvalidation({
    mutationFn: (productIds: number[]) => usersService.assignProductsToUser(user.id, productIds),
    invalidateKeys: [
      ['users'],
      ['user-product-assignments', user.id],
      ['user-stats'],
    ],
    successMessage: 'Product assignments updated successfully',
    errorContext: 'Product Assignment',
    errorFallbackMessage: 'Failed to update product assignments',
  });

  if (!isBackendScopedUser(user)) {
    return null;
  }

  const handleProductToggle = (productId: number, checked: boolean) => {
    if (checked) {
      setSelectedProductIds((prev) => [...prev, productId]);
    } else {
      setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  const handleSaveAssignments = () => {
    saveAssignmentsMutation.mutate(selectedProductIds);
  };

  const isLoading =
    clientAssignmentsLoading ||
    productsLoading ||
    assignmentsLoading ||
    saveAssignmentsMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Assignments
        </CardTitle>
        <CardDescription>
          Select which products this user can access — products are grouped by their client. Assign
          clients first to see available products.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : assignedClients.length === 0 ? (
          <div className="text-sm text-gray-600 border rounded-md p-4">
            No clients assigned yet. Use the <strong>Client Assignments</strong> section above
            first; products will appear here grouped by the chosen clients.
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {productsByClient.map(({ client, products }) => (
                <div key={client.clientId} className="rounded-md border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold">{client.clientName}</span>
                    <Badge variant="outline" className="text-xs">
                      {client.clientCode}
                    </Badge>
                  </div>
                  {products.length === 0 ? (
                    <div className="text-xs text-gray-500 pl-2">
                      No products mapped to this client.
                    </div>
                  ) : (
                    <div className="space-y-1 pl-2">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`product-${client.clientId}-${product.id}`}
                            checked={selectedProductIds.includes(product.id)}
                            onCheckedChange={(checked) =>
                              handleProductToggle(product.id, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`product-${client.clientId}-${product.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {product.name}
                            {product.code && (
                              <span className="text-xs text-gray-500 ml-1">({product.code})</span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
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
