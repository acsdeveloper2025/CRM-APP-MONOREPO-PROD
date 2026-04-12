import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Package, CheckCircle, XCircle, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { productsService } from '@/services/products';
import { ProductsTable } from '@/components/clients/ProductsTable';
import { CreateProductDialog } from '@/components/clients/CreateProductDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';

export function ProductsPage() {
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Unified search with 800ms debounce
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Reset pagination to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => productsService.getProducts({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
  });

  // Fetch product stats
  const { data: statsData } = useQuery({
    queryKey: ['product-stats'],
    queryFn: () => productsService.getProductStats(),
  });

  const products = productsData?.data || [];
  const stats = statsData?.data || { total: 0, active: 0, inactive: 0, byCategory: {} };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Product Management</h1>
          <p className="text-gray-600">
            Manage verification products, categories, and pricing
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-600">
              All products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-gray-600">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Products</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-gray-600">
              Disabled products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Rates</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.filter(p => p.hasRates).length}</div>
            <p className="text-xs text-gray-600">
              Rate configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recently Added</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => {
                if (!p.createdAt) {return false;}
                const created = new Date(p.createdAt);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return created >= thirtyDaysAgo;
              }).length}
            </div>
            <p className="text-xs text-gray-600">
              Last 30 days
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
            <UnifiedSearchFilterLayout
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              onSearchClear={clearSearch}
              isSearchLoading={isDebouncing}
              searchPlaceholder="Search products by name, code or category..."
              showFilters={false}
              actions={
                <Button
                  size="sm"
                  onClick={() => setShowCreateProduct(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              }
            />

            {/* Products Table */}
            <ProductsTable
              data={products}
              isLoading={productsLoading}
            />

            {/* Pagination Controls */}
            {productsData?.pagination && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                <div className="text-sm text-gray-600">
                  Showing {productsData.data?.length || 0} of {productsData.pagination.total} products
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {currentPage} of {productsData.pagination.totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= (productsData.pagination.totalPages || 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
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
