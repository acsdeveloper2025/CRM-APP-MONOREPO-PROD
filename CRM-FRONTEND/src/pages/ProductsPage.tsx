import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Package, CheckCircle, XCircle, TrendingUp, Calendar } from 'lucide-react';
import { productsService } from '@/services/products';
import { ProductsTable } from '@/components/clients/ProductsTable';
import { CreateProductDialog } from '@/components/clients/CreateProductDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/ui/components/unified-search-filter-layout';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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
    <Page
      title="Product Management"
      subtitle="Manage verification products, categories, and pricing."
      shell
      actions={(
        <Button icon={<Plus size={16} />} onClick={() => setShowCreateProduct(true)}>
          Add Product
        </Button>
      )}
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Catalog Console</Badge>
          <Text as="h2" variant="headline">Keep product configuration visible without changing the existing table and dialog workflow.</Text>
          <Text variant="body-sm" tone="muted">
            Search, create, and review product coverage from the shared operational shell.
          </Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            {
              title: 'Total Products',
              value: stats.total,
              detail: 'All products',
              icon: Package,
              tone: 'neutral',
            },
            {
              title: 'Active Products',
              value: stats.active,
              detail: 'Currently active',
              icon: CheckCircle,
              tone: 'positive',
            },
            {
              title: 'Inactive Products',
              value: stats.inactive,
              detail: 'Disabled products',
              icon: XCircle,
              tone: 'danger',
            },
            {
              title: 'With Rates',
              value: products.filter(p => p.hasRates).length,
              detail: 'Rate configured',
              icon: TrendingUp,
              tone: 'accent',
            },
            {
              title: 'Recently Added',
              value: products.filter((p) => {
                if (!p.createdAt) {
                  return false;
                }
                const created = new Date(p.createdAt);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return created >= thirtyDaysAgo;
              }).length,
              detail: 'Last 30 days',
              icon: Calendar,
              tone: 'warning',
            },
          ]}
        />
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <UnifiedSearchFilterLayout
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              onSearchClear={clearSearch}
              isSearchLoading={isDebouncing}
              searchPlaceholder="Search products by name, code or category..."
              showFilters={false}
              actions={undefined}
            />

            <ProductsTable
              data={products}
              isLoading={productsLoading}
            />

            {productsData?.pagination ? (
              <PaginationStatusCard
                page={currentPage}
                limit={pageSize}
                total={productsData.pagination.total}
                totalPages={productsData.pagination.totalPages || 1}
                onPrevious={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                onNext={() => setCurrentPage(prev => prev + 1)}
              />
            ) : null}
          </Stack>
        </Card>
      </Section>

      <CreateProductDialog
        open={showCreateProduct}
        onOpenChange={setShowCreateProduct}
      />
    </Page>
  );
}
