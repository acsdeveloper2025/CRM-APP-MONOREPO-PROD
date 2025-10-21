import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchWithActions } from '@/components/ui/search-layout';
import { useSearchInput } from '@/components/ui/search-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { productsService } from '@/services/products';
import { ProductsTable } from '@/components/clients/ProductsTable';
import { CreateProductDialog } from '@/components/clients/CreateProductDialog';

export function ProductsPage() {
  const [showCreateProduct, setShowCreateProduct] = useState(false);

  // Use standardized search with debouncing
  const { debouncedSearchValue, setSearchValue } = useSearchInput('', 400);

  // Fetch products data
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', debouncedSearchValue],
    queryFn: () => productsService.getProducts({ search: debouncedSearchValue }),
  });

  // Fetch product stats
  const { data: statsData } = useQuery({
    queryKey: ['product-stats'],
    queryFn: () => productsService.getProductStats(),
  });

  const products = productsData?.data || [];
  const stats = statsData?.data || { total: 0, active: 0, inactive: 0, byCategory: {} };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Management</h1>
          <p className="text-muted-foreground">
            Manage verification products, categories, and pricing
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All products across clients
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active products
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Disabled or archived products
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products Console</CardTitle>
              <CardDescription>
                Create, edit, and manage verification products
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Standardized Search and Actions */}
            <SearchWithActions
              onSearch={setSearchValue}
              placeholder="Search products..."
              isLoading={productsLoading}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px]"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowCreateProduct(true)}
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </>
              }
            />

            {/* Products Table */}
            <ProductsTable
              data={products}
              isLoading={productsLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateProductDialog
        open={showCreateProduct}
        onOpenChange={setShowCreateProduct}
      />
    </div>
  );
}
