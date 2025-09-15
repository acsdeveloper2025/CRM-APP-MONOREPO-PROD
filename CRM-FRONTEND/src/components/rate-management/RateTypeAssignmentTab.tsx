import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { rateTypeAssignmentsService, type RateTypeAssignmentStatus } from '@/services/rateTypeAssignments';
import toast from 'react-hot-toast';

export function RateTypeAssignmentTab() {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVerificationTypeId, setSelectedVerificationTypeId] = useState<string>('');
  const [assignedRateTypeIds, setAssignedRateTypeIds] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients({ limit: 100 }),
  });

  // Fetch products for selected client
  const { data: productsData } = useQuery({
    queryKey: ['client-products', selectedClientId],
    queryFn: () => productsService.getProductsByClient(selectedClientId),
    enabled: !!selectedClientId,
  });

  // Fetch verification types for selected product
  const { data: verificationTypesData } = useQuery({
    queryKey: ['product-verification-types', selectedProductId],
    queryFn: () => verificationTypesService.getVerificationTypesByProduct(selectedProductId),
    enabled: !!selectedProductId,
  });

  // Fetch assignment status for selected combination
  const { data: assignmentStatusData, isLoading: assignmentLoading } = useQuery({
    queryKey: ['rate-type-assignments', selectedClientId, selectedProductId, selectedVerificationTypeId],
    queryFn: () => rateTypeAssignmentsService.getAssignmentsByCombination({
      clientId: selectedClientId,
      productId: selectedProductId,
      verificationTypeId: selectedVerificationTypeId,
    }),
    enabled: !!(selectedClientId && selectedProductId && selectedVerificationTypeId),
  });

  // Update assigned rate types when assignment status changes
  useEffect(() => {
    if (assignmentStatusData?.data) {
      const assigned = assignmentStatusData.data
        .filter(item => item.isAssigned)
        .map(item => item.rateTypeId);
      setAssignedRateTypeIds(assigned);
    }
  }, [assignmentStatusData]);

  // Save assignments mutation
  const saveAssignmentsMutation = useMutation({
    mutationFn: () => rateTypeAssignmentsService.bulkAssignRateTypes({
      clientId: selectedClientId,
      productId: selectedProductId,
      verificationTypeId: selectedVerificationTypeId,
      rateTypeIds: assignedRateTypeIds,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['rate-type-assignments', selectedClientId, selectedProductId, selectedVerificationTypeId]
      });
      toast.success('Rate type assignments saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save assignments');
    },
  });

  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];
  const assignmentStatus = assignmentStatusData?.data || [];

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedProductId('');
    setSelectedVerificationTypeId('');
    setAssignedRateTypeIds([]);
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedVerificationTypeId('');
    setAssignedRateTypeIds([]);
  };

  const handleVerificationTypeChange = (verificationTypeId: string) => {
    setSelectedVerificationTypeId(verificationTypeId);
    setAssignedRateTypeIds([]);
  };

  const handleRateTypeToggle = (rateTypeId: string, checked: boolean) => {
    if (checked) {
      setAssignedRateTypeIds(prev => [...prev, rateTypeId]);
    } else {
      setAssignedRateTypeIds(prev => prev.filter(id => id !== rateTypeId));
    }
  };

  const handleSaveAssignments = () => {
    saveAssignmentsMutation.mutate();
  };

  const canShowAssignments = selectedClientId && selectedProductId && selectedVerificationTypeId;
  const hasChanges = assignmentStatus.length > 0 &&
    JSON.stringify(assignedRateTypeIds.sort()) !==
    JSON.stringify(assignmentStatus.filter(item => item.isAssigned).map(item => item.rateTypeId).sort());

  return (
    <div className="space-y-6">
      {/* Selection Form */}
      <Card>
        <CardHeader>
          <CardTitle>Select Client-Product-Verification Type Combination</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client-select">Client *</Label>
              <Select value={selectedClientId} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} ({client.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="product-select">Product *</Label>
              <Select
                value={selectedProductId}
                onValueChange={handleProductChange}
                disabled={!selectedClientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Verification Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="verification-type-select">Verification Type *</Label>
              <Select
                value={selectedVerificationTypeId}
                onValueChange={handleVerificationTypeChange}
                disabled={!selectedProductId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select verification type" />
                </SelectTrigger>
                <SelectContent>
                  {verificationTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.name} ({vt.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selection Summary */}
          {canShowAssignments && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Selected Combination:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Client: {clients.find(c => c.id === selectedClientId)?.name}
                </Badge>
                <Badge variant="outline">
                  Product: {products.find(p => p.id === selectedProductId)?.name}
                </Badge>
                <Badge variant="outline">
                  Verification: {verificationTypes.find(vt => vt.id === selectedVerificationTypeId)?.name}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate Type Assignment */}
      {canShowAssignments && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Rate Types</CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : assignmentStatus.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No rate types available for assignment
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assignmentStatus.map((rateType) => (
                    <div
                      key={rateType.rateTypeId}
                      className="flex items-center space-x-3 p-3 border rounded-lg"
                    >
                      <Checkbox
                        id={rateType.rateTypeId}
                        checked={assignedRateTypeIds.includes(rateType.rateTypeId)}
                        onCheckedChange={(checked) =>
                          handleRateTypeToggle(rateType.rateTypeId, checked as boolean)
                        }
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={rateType.rateTypeId}
                          className="font-medium cursor-pointer"
                        >
                          {rateType.rateTypeName}
                        </Label>
                        {rateType.rateTypeDescription && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {rateType.rateTypeDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveAssignments}
                    disabled={!hasChanges || saveAssignmentsMutation.isPending}
                  >
                    {saveAssignmentsMutation.isPending ? 'Saving...' : 'Save Assignments'}
                  </Button>
                </div>

                {/* Assignment Summary */}
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">
                    Assigned Rate Types ({assignedRateTypeIds.length}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {assignedRateTypeIds.length === 0 ? (
                      <span className="text-muted-foreground text-sm">No rate types assigned</span>
                    ) : (
                      assignedRateTypeIds.map(rateTypeId => {
                        const rateType = assignmentStatus.find(rt => rt.rateTypeId === rateTypeId);
                        return (
                          <Badge key={rateTypeId} variant="default">
                            {rateType?.rateTypeName}
                          </Badge>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Select a client from the dropdown to see available products and verification types</li>
            <li>Choose a product that is assigned to the selected client</li>
            <li>Select a verification type that is available for the client</li>
            <li>Check the rate types you want to assign to this combination</li>
            <li>Click "Save Assignments" to apply the changes</li>
            <li>Assigned rate types will be available for rate setting in the next tab</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
