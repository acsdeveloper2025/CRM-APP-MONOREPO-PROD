import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import { Badge } from '@/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/table';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { documentTypeRatesService } from '@/services/documentTypeRates';
import { apiService } from '@/services/api';
import { Trash2, Edit, Plus, IndianRupee } from 'lucide-react';
import type { DocumentType, DocumentTypeRate } from '@/types/documentTypeRates';

export function DocumentTypeRatesTab() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClientId, selectedProductId]);

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients({ limit: 100 }),
  });

  // Fetch products for selected client
  const { data: productsData } = useQuery({
    queryKey: ['client-products', selectedClientId],
    queryFn: () => productsService.getProductsByClient(String(selectedClientId || 0)),
    enabled: !!selectedClientId,
  });

  // Fetch document types
  const { data: documentTypesData } = useQuery({
    queryKey: ['document-types'],
    queryFn: async () => {
      const response = await apiService.get<DocumentType[]>('/document-types', { limit: 100 });
      return response;
    },
  });

  // Fetch configured document type rates
  const { data: ratesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['document-type-rates', selectedClientId, selectedProductId, currentPage, pageSize],
    queryFn: () => documentTypeRatesService.getDocumentTypeRates({
      clientId: selectedClientId || undefined,
      productId: selectedProductId || undefined,
      isActive: true,
      page: currentPage,
      limit: pageSize,
    }),
    enabled: !!(selectedClientId || selectedProductId),
  });

  // Create/Update mutation
  const saveRateMutation = useMutationWithInvalidation({
    mutationFn: async (data: { clientId: number; productId: number; documentTypeId: number; amount: number; currency: string }) => {
      return documentTypeRatesService.createOrUpdateDocumentTypeRate(data);
    },
    invalidateKeys: [['document-type-rates'], ['rate-management-stats']],
    successMessage: editingRateId ? 'Rate updated successfully' : 'Rate created successfully',
    errorContext: 'Document Type Rate Save',
    errorFallbackMessage: 'Failed to save rate',
    onSuccess: () => {
      resetForm();
    },
  });

  // Delete mutation
  const deleteRateMutation = useMutationWithInvalidation({
    mutationFn: (rateId: number) => documentTypeRatesService.deleteDocumentTypeRate(rateId),
    invalidateKeys: [['document-type-rates'], ['rate-management-stats']],
    successMessage: 'Rate deleted successfully',
    errorContext: 'Document Type Rate Deletion',
    errorFallbackMessage: 'Failed to delete rate',
  });

  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const documentTypes = documentTypesData?.data || [];
  const rates = ratesData?.data || [];

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(Number(clientId));
    setSelectedProductId(null);
    resetForm();
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(Number(productId));
    resetForm();
  };

  const handleDocumentTypeChange = (documentTypeId: string) => {
    setSelectedDocumentTypeId(Number(documentTypeId));
  };

  const resetForm = () => {
    setSelectedDocumentTypeId(null);
    setAmount('');
    setCurrency('INR');
    setEditingRateId(null);
  };

  const handleSaveRate = async () => {
    if (!selectedClientId || !selectedProductId || !selectedDocumentTypeId) {
      toast.error('Please select client, product, and document type');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum < 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    await saveRateMutation.mutateAsync({
      clientId: selectedClientId,
      productId: selectedProductId,
      documentTypeId: selectedDocumentTypeId,
      amount: amountNum,
      currency,
    });
  };

  const handleEditRate = (rate: DocumentTypeRate) => {
    setSelectedClientId(rate.clientId);
    setSelectedProductId(rate.productId);
    setSelectedDocumentTypeId(rate.documentTypeId);
    setAmount(rate.amount.toString());
    setCurrency(rate.currency);
    setEditingRateId(rate.id);
  };

  const handleDeleteRate = async (rateId: number) => {
    // eslint-disable-next-line no-alert
    if (confirm('Are you sure you want to delete this rate?')) {
      await deleteRateMutation.mutateAsync(rateId);
    }
  };

  const canSave = selectedClientId && selectedProductId && selectedDocumentTypeId && amount;

  return (
    <div {...{ className: "space-y-6" }}>
      {/* Rate Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle {...{ className: "flex items-center gap-2" }}>
            <Plus {...{ className: "h-5 w-5" }} />
            {editingRateId ? 'Edit Document Type Rate' : 'Add Document Type Rate'}
          </CardTitle>
        </CardHeader>
        <CardContent {...{ className: "space-y-4" }}>
          <div {...{ className: "grid grid-cols-1 md:grid-cols-3 gap-4" }}>
            {/* Client Selection */}
            <div {...{ className: "space-y-2" }}>
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
            <div {...{ className: "space-y-2" }}>
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

            {/* Document Type Selection */}
            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="document-type-select">Document Type *</Label>
              <Select
                value={selectedDocumentTypeId ? String(selectedDocumentTypeId) : ""}
                onValueChange={handleDocumentTypeChange}
                disabled={!selectedProductId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((docType) => (
                    <SelectItem key={docType.id} value={String(docType.id)}>
                      {docType.name} ({docType.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div {...{ className: "grid grid-cols-1 md:grid-cols-3 gap-4" }}>
            {/* Amount Input */}
            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="amount-input">Amount *</Label>
              <div {...{ className: "relative" }}>
                <IndianRupee {...{ className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" }} />
                <Input
                  id="amount-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  {...{ className: "pl-10" }}
                  disabled={!selectedDocumentTypeId}
                />
              </div>
            </div>

            {/* Currency Selection */}
            <div {...{ className: "space-y-2" }}>
              <Label htmlFor="currency-select">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR (₹)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div {...{ className: "space-y-2" }}>
              <Label>&nbsp;</Label>
              <div {...{ className: "flex gap-2" }}>
                <Button
                  onClick={handleSaveRate}
                  disabled={!canSave || saveRateMutation.isPending}
                  {...{ className: "flex-1" }}
                >
                  {saveRateMutation.isPending ? 'Saving...' : editingRateId ? 'Update Rate' : 'Save Rate'}
                </Button>
                {editingRateId && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configured Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Document Type Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {ratesLoading ? (
            <div {...{ className: "text-center py-8 text-gray-500" }}>Loading rates...</div>
          ) : rates.length === 0 ? (
            <div {...{ className: "text-center py-8 text-gray-500" }}>
              No document type rates configured yet. Add your first rate above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead {...{ className: "text-right" }}>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead {...{ className: "text-right" }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell {...{ className: "font-medium" }}>{rate.clientName}</TableCell>
                    <TableCell>{rate.productName}</TableCell>
                    <TableCell>{rate.documentTypeName}</TableCell>
                    <TableCell {...{ className: "text-right font-mono" }}>
                      {rate.currency} {Number(rate.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.isActive ? 'default' : 'secondary'}>
                        {rate.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell {...{ className: "text-right" }}>
                      <div {...{ className: "flex justify-end gap-2" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRate(rate)}
                        >
                          <Edit {...{ className: "h-4 w-4" }} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRate(rate.id)}
                          disabled={deleteRateMutation.isPending}
                        >
                          <Trash2 {...{ className: "h-4 w-4 text-red-500" }} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {ratesData?.pagination && (
            <div {...{ className: "flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" }}>
              <div {...{ className: "text-sm text-gray-600" }}>
                Showing {rates.length} of {ratesData.pagination.total} document type rates
              </div>
              <div {...{ className: "flex items-center gap-2" }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div {...{ className: "text-sm" }}>
                  Page {currentPage} of {ratesData.pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage >= (ratesData.pagination.totalPages || 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
