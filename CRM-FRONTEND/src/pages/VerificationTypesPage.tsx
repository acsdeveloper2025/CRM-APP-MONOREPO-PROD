import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileCheck, CheckCircle, XCircle, Layers, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { verificationTypesService } from '@/services/verificationTypes';
import { VerificationTypesTable } from '@/components/clients/VerificationTypesTable';
import { CreateVerificationTypeDialog } from '@/components/clients/CreateVerificationTypeDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';

export function VerificationTypesPage() {
  const [showCreateVerificationType, setShowCreateVerificationType] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Unified search with 800ms debounce
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({
      syncWithUrl: true,
    });

  // Reset pagination to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const { data: verificationTypesData, isLoading: verificationTypesLoading } = useQuery({
    queryKey: ['verification-types', debouncedSearchValue, currentPage, pageSize],
    queryFn: () =>
      verificationTypesService.getVerificationTypes({
        search: debouncedSearchValue || undefined,
        page: currentPage,
        limit: pageSize,
      }),
  });

  // Fetch verification types stats
  const { data: statsData } = useQuery({
    queryKey: ['verification-types-stats'],
    queryFn: () => verificationTypesService.getVerificationTypeStats(),
  });

  const verificationTypes = verificationTypesData?.data || [];
  const stats = statsData?.data || { total: 0, active: 0, inactive: 0, byCategory: {} };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Verification Types</h1>
          <p className="text-gray-600">Manage verification types, categories, and configurations</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Types</CardTitle>
            <FileCheck className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-600">All types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Types</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-gray-600">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Types</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-gray-600">Disabled types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Layers className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.byCategory || {}).length}</div>
            <p className="text-xs text-gray-600">Type categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Rates</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {verificationTypes.filter((v) => v.hasRates).length}
            </div>
            <p className="text-xs text-gray-600">Rate mappings</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verification Types Console</CardTitle>
              <CardDescription>
                Create, edit, and manage verification types and configurations
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
              searchPlaceholder="Search verification types by name, code or category..."
              showFilters={false}
              actions={
                <Button size="sm" onClick={() => setShowCreateVerificationType(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Type
                </Button>
              }
            />

            {/* Verification Types Table */}
            <VerificationTypesTable data={verificationTypes} isLoading={verificationTypesLoading} />

            {/* Pagination Controls */}
            {verificationTypesData?.pagination && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                <div className="text-sm text-gray-600">
                  Showing {verificationTypesData.data?.length || 0} of{' '}
                  {verificationTypesData.pagination.total} verification types
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {currentPage} of {verificationTypesData.pagination.totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={currentPage >= (verificationTypesData.pagination.totalPages || 1)}
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
      <CreateVerificationTypeDialog
        open={showCreateVerificationType}
        onOpenChange={setShowCreateVerificationType}
      />
    </div>
  );
}
