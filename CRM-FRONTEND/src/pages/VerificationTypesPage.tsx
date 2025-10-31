import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { verificationTypesService } from '@/services/verificationTypes';
import { VerificationTypesTable } from '@/components/clients/VerificationTypesTable';
import { CreateVerificationTypeDialog } from '@/components/clients/CreateVerificationTypeDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchInput } from '@/components/ui/unified-search-input';

export function VerificationTypesPage() {
  const [showCreateVerificationType, setShowCreateVerificationType] = useState(false);
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

  const { data: verificationTypesData, isLoading: verificationTypesLoading } = useQuery({
    queryKey: ['verification-types', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => verificationTypesService.getVerificationTypes({
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verification Types Management</h1>
          <p className="text-muted-foreground">
            Manage verification types, categories, and configurations
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All verification types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Disabled or archived types
            </p>
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
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={() => setShowCreateVerificationType(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </div>

            {/* Verification Types Table */}
            <VerificationTypesTable
              data={verificationTypes}
              isLoading={verificationTypesLoading}
            />

            {/* Pagination Controls */}
            {verificationTypesData?.pagination && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {verificationTypesData.data?.length || 0} of {verificationTypesData.pagination.total} verification types
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
                    Page {currentPage} of {verificationTypesData.pagination.totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
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
