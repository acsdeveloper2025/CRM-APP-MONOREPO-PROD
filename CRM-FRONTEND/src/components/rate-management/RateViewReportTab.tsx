import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Download, Filter, Trash2, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ratesService, type Rate } from '@/services/rates';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { rateTypesService } from '@/services/rateTypes';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import toast from 'react-hot-toast';

export function RateViewReportTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedVerificationTypeId, setSelectedVerificationTypeId] = useState<string>('all');
  const [selectedRateTypeId, setSelectedRateTypeId] = useState<string>('all');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [deletingRate, setDeletingRate] = useState<Rate | null>(null);

  const queryClient = useQueryClient();

  // Build filters for rates query
  const rateFilters = {
    search: searchQuery,
    clientId: selectedClientId === 'all' ? undefined : Number(selectedClientId),
    productId: selectedProductId === 'all' ? undefined : Number(selectedProductId),
    verificationTypeId: selectedVerificationTypeId === 'all' ? undefined : Number(selectedVerificationTypeId),
    rateTypeId: selectedRateTypeId === 'all' ? undefined : Number(selectedRateTypeId),
    isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'active',
    limit: 1000, // Get all rates for comprehensive view
  };

  // Fetch rates
  const { data: ratesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['rates', rateFilters],
    queryFn: () => ratesService.getRates(rateFilters),
  });

  // Fetch filter options
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients({ limit: 100 }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getProducts({ limit: 100 }),
  });

  const { data: verificationTypesData } = useQuery({
    queryKey: ['verification-types'],
    queryFn: () => verificationTypesService.getVerificationTypes({ limit: 100 }),
  });

  const { data: rateTypesData } = useQuery({
    queryKey: ['rate-types'],
    queryFn: () => rateTypesService.getRateTypes({ limit: 100 }),
  });

  // Delete rate mutation
  const deleteRateMutation = useMutation({
    mutationFn: (rateId: string) => ratesService.deleteRate(rateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rates'] });
      queryClient.invalidateQueries({ queryKey: ['rate-management-stats'] });
      toast.success('Rate deleted successfully');
      setDeletingRate(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete rate');
    },
  });

  const rates = ratesData?.data || [];
  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];
  const rateTypes = rateTypesData?.data || [];

  const handleDeleteRate = (rate: Rate) => {
    setDeletingRate(rate);
  };

  const confirmDeleteRate = () => {
    if (deletingRate) {
      deleteRateMutation.mutate(deletingRate.rateId);
    }
  };

  const handleExportRates = () => {
    // Create CSV content
    const headers = [
      'Client Name',
      'Client Code',
      'Product Name',
      'Product Code',
      'Verification Type',
      'Rate Type',
      'Amount',
      'Currency',
      'Status',
      'Created Date',
      'Updated Date'
    ];

    const csvContent = [
      headers.join(','),
      ...rates.map(rate => [
        `"${rate.clientName}"`,
        `"${rate.clientCode}"`,
        `"${rate.productName}"`,
        `"${rate.productCode}"`,
        `"${rate.verificationTypeName}"`,
        `"${rate.rateTypeName}"`,
        rate.amount,
        rate.currency,
        rate.isActive ? 'Active' : 'Inactive',
        new Date(rate.createdAt).toLocaleDateString(),
        new Date(rate.updatedAt).toLocaleDateString()
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rates-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('Rates exported successfully');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedClientId('all');
    setSelectedProductId('all');
    setSelectedVerificationTypeId('all');
    setSelectedRateTypeId('all');
    setIsActiveFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search rates by client, product, verification type, or rate type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleExportRates} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Product</label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Type</label>
              <Select value={selectedVerificationTypeId} onValueChange={setSelectedVerificationTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {verificationTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rate Type</label>
              <Select value={selectedRateTypeId} onValueChange={setSelectedRateTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="All rate types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rate types</SelectItem>
                  {rateTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={isActiveFilter} onValueChange={setIsActiveFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Rates ({rates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ratesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No rates found matching the current filters</p>
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Verification Type</TableHead>
                    <TableHead>Rate Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate, index) => (
                    <TableRow key={rate.rateId || `${rate.clientId}-${rate.productId}-${rate.verificationTypeId}-${rate.rateTypeId}-${index}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rate.clientName}</div>
                          <div className="text-xs text-muted-foreground">{rate.clientCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rate.productName}</div>
                          <div className="text-xs text-muted-foreground">{rate.productCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rate.verificationTypeName}</div>
                          <div className="text-xs text-muted-foreground">{rate.verificationTypeCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rate.rateTypeName}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {rate.currency} {Number(rate.amount || 0).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rate.isActive ? 'default' : 'secondary'}>
                          {rate.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(rate.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(rate.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRate(rate)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{rates.length}</div>
            <p className="text-xs text-muted-foreground">Total Rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {rates.filter(r => r.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">Active Rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              ₹{rates.length > 0 ? (rates.reduce((sum, r) => sum + Number(r.amount || 0), 0) / rates.length).toFixed(0) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Average Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {new Set(rates.map(r => r.clientId)).size}
            </div>
            <p className="text-xs text-muted-foreground">Unique Clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingRate && (
        <DeleteConfirmationDialog
          open={!!deletingRate}
          onOpenChange={(open) => !open && setDeletingRate(null)}
          title="Delete Rate"
          description={`Are you sure you want to delete the rate for ${deletingRate.clientName} - ${deletingRate.productName} - ${deletingRate.verificationTypeName} - ${deletingRate.rateTypeName}? This action cannot be undone.`}
          onConfirm={confirmDeleteRate}
          isLoading={deleteRateMutation.isPending}
        />
      )}
    </div>
  );
}
