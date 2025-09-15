import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { ratesService, type AvailableRateType } from '@/services/rates';
import toast from 'react-hot-toast';

interface RateInput {
  rateTypeId: string;
  amount: string;
  currency: string;
}

export function RateAssignmentTab() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedVerificationTypeId, setSelectedVerificationTypeId] = useState<number | null>(null);
  const [rateInputs, setRateInputs] = useState<Record<number, RateInput>>({});

  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients({ limit: 100 }),
  });

  // Fetch products for selected client
  const { data: productsData } = useQuery({
    queryKey: ['client-products', selectedClientId],
    queryFn: () => productsService.getProductsByClient(selectedClientId!),
    enabled: !!selectedClientId,
  });

  // Fetch verification types for selected product
  const { data: verificationTypesData } = useQuery({
    queryKey: ['product-verification-types', selectedProductId],
    queryFn: () => verificationTypesService.getVerificationTypesByProduct(selectedProductId!),
    enabled: !!selectedProductId,
  });

  // Fetch available rate types for selected combination
  const { data: availableRateTypesData, isLoading: rateTypesLoading } = useQuery({
    queryKey: ['available-rate-types', selectedClientId, selectedProductId, selectedVerificationTypeId],
    queryFn: () => ratesService.getAvailableRateTypesForAssignment({
      clientId: selectedClientId!,
      productId: selectedProductId!,
      verificationTypeId: selectedVerificationTypeId!,
    }),
    enabled: !!(selectedClientId && selectedProductId && selectedVerificationTypeId),
  });

  // Initialize rate inputs when available rate types change
  useEffect(() => {
    if (availableRateTypesData?.data) {
      const inputs: Record<string, RateInput> = {};
      availableRateTypesData.data.forEach(rateType => {
        inputs[rateType.rateTypeId] = {
          rateTypeId: rateType.rateTypeId,
          amount: rateType.currentAmount?.toString() || '',
          currency: 'INR',
        };
      });
      setRateInputs(inputs);
    }
  }, [availableRateTypesData]);

  // Save rate mutation
  const saveRateMutation = useMutation({
    mutationFn: async (rateData: { rateTypeId: number; amount: number; currency: string }) => {
      return ratesService.createOrUpdateRate({
        clientId: selectedClientId!,
        productId: selectedProductId!,
        verificationTypeId: selectedVerificationTypeId!,
        rateTypeId: rateData.rateTypeId,
        amount: rateData.amount,
        currency: rateData.currency,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['available-rate-types', selectedClientId, selectedProductId, selectedVerificationTypeId]
      });
      queryClient.invalidateQueries({ queryKey: ['rate-management-stats'] });
      toast.success('Rate saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save rate');
    },
  });

  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];
  const availableRateTypes = availableRateTypesData?.data || [];

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(Number(clientId));
    setSelectedProductId(null);
    setSelectedVerificationTypeId(null);
    setRateInputs({});
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(Number(productId));
    setSelectedVerificationTypeId(null);
    setRateInputs({});
  };

  const handleVerificationTypeChange = (verificationTypeId: string) => {
    setSelectedVerificationTypeId(Number(verificationTypeId));
    setRateInputs({});
  };

  const handleRateInputChange = (rateTypeId: number, field: keyof RateInput, value: string) => {
    setRateInputs(prev => ({
      ...prev,
      [rateTypeId]: {
        ...prev[rateTypeId],
        [field]: value,
      },
    }));
  };

  const handleSaveRate = async (rateTypeId: number) => {
    const rateInput = rateInputs[rateTypeId];
    if (!rateInput || !rateInput.amount) {
      toast.error('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(rateInput.amount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    await saveRateMutation.mutateAsync({
      rateTypeId,
      amount,
      currency: rateInput.currency,
    });
  };

  const canShowRateTypes = selectedClientId && selectedProductId && selectedVerificationTypeId;

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
              <Select value={selectedClientId ? String(selectedClientId) : ""} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
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
                value={selectedProductId ? String(selectedProductId) : ""}
                onValueChange={handleProductChange}
                disabled={!selectedClientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
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
                value={selectedVerificationTypeId ? String(selectedVerificationTypeId) : ""}
                onValueChange={handleVerificationTypeChange}
                disabled={!selectedProductId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select verification type" />
                </SelectTrigger>
                <SelectContent>
                  {verificationTypes.map((vt) => (
                    <SelectItem key={vt.id} value={String(vt.id)}>
                      {vt.name} ({vt.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selection Summary */}
          {canShowRateTypes && (
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

      {/* Rate Assignment */}
      {canShowRateTypes && (
        <Card>
          <CardHeader>
            <CardTitle>Set Rate Amounts</CardTitle>
          </CardHeader>
          <CardContent>
            {rateTypesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : availableRateTypes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No rate types are assigned to this combination.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please assign rate types in the "Rate Type Assignment" tab first.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rate Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Current Amount</TableHead>
                      <TableHead>New Amount</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableRateTypes.map((rateType) => {
                      const rateInput = rateInputs[rateType.rateTypeId] || {
                        rateTypeId: rateType.rateTypeId,
                        amount: '',
                        currency: 'INR',
                      };

                      return (
                        <TableRow key={rateType.rateTypeId}>
                          <TableCell className="font-medium">
                            {rateType.rateTypeName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {rateType.rateTypeDescription || 'No description'}
                          </TableCell>
                          <TableCell>
                            {rateType.hasRate ? (
                              <Badge variant="default">
                                ₹{Number(rateType.currentAmount || 0).toFixed(2)}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Not set</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="Enter amount"
                              value={rateInput.amount}
                              onChange={(e) =>
                                handleRateInputChange(rateType.rateTypeId, 'amount', e.target.value)
                              }
                              className="w-32"
                              min="0"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={rateInput.currency}
                              onValueChange={(value) =>
                                handleRateInputChange(rateType.rateTypeId, 'currency', value)
                              }
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INR">INR</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleSaveRate(rateType.rateTypeId)}
                              disabled={!rateInput.amount || saveRateMutation.isPending}
                            >
                              {saveRateMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
            <li>Select a client, product, and verification type combination</li>
            <li>Only rate types that have been assigned in the previous tab will appear here</li>
            <li>Enter the rate amount for each rate type</li>
            <li>Select the currency (default is INR)</li>
            <li>Click "Save" to set the rate for that specific rate type</li>
            <li>Current rates will be displayed if they have been set previously</li>
            <li>You can update existing rates by entering a new amount and saving</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
