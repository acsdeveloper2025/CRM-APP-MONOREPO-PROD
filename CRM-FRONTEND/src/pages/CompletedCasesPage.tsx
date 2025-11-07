import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompletedCaseTable } from '@/components/cases/CompletedCaseTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { useCases, useRefreshCases } from '@/hooks/useCases';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { Download, RefreshCw, CheckCircle } from 'lucide-react';
import { casesService, type CaseListQuery } from '@/services/cases';

interface CompletedCaseFilters {
  priority?: string;
  clientId?: string;
}

export const CompletedCasesPage: React.FC = () => {
  // Unified search with 800ms debounce
  const {
    searchValue: _searchValue,
    debouncedSearchValue,
    setSearchValue: _setSearchValue,
    clearSearch: _clearSearch,
    isDebouncing: _isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
    setFilter: _setFilter,
    clearFilters: _clearFilters,
    hasActiveFilters: _hasActiveFilters,
  } = useUnifiedFilters<CompletedCaseFilters>({
    syncWithUrl: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    sortBy: 'completedAt',
    sortOrder: 'desc' as const,
  });

  // Build query with search and filters
  const query: CaseListQuery = {
    ...pagination,
    status: 'COMPLETED',
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority ? parseInt(activeFilters.priority) : undefined,
    clientId: activeFilters.clientId || undefined,
  };

  const { data: casesData, isLoading, refetch: _refetch } = useCases(query);
  const { refreshCases } = useRefreshCases();

  const cases = casesData?.data || [];
  const _paginationData = casesData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  const _activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof CompletedCaseFilters] !== undefined
  ).length;

  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'completed',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export completed cases:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Completed Cases</h1>
          <p className="mt-2 text-muted-foreground">
            View and manage all completed verification cases
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={async () => {
            await refreshCases({
              clearCache: true,
              preserveFilters: true,
              showToast: true
            });
          }} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Completed</p>
                <p className="text-2xl font-bold text-foreground">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-semibold">📅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-foreground">
                  {cases.filter(c => {
                    const completedDate = new Date(c.completedAt || c.updatedAt);
                    const now = new Date();
                    return completedDate.getMonth() === now.getMonth() && 
                           completedDate.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-semibold">⭐</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-foreground">
                  {cases.filter(c => c.priority >= 4).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-semibold">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Field Users</p>
                <p className="text-2xl font-bold text-foreground">
                  {new Set(cases.map(c => c.assignedToId)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-semibold">⏱️</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg TAT</p>
                <p className="text-2xl font-bold text-foreground">
                  {cases.length > 0
                    ? Math.round(cases.reduce((acc, c) => {
                        if (!c.createdAt || !c.completedAt) {return acc;}
                        const created = new Date(c.createdAt);
                        const completed = new Date(c.completedAt);
                        const tatInDays = Math.floor((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                        return acc + tatInDays;
                      }, 0) / cases.length)
                    : 0} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Completed Cases</CardTitle>
              <CardDescription>
                {pagination.total > 0 
                  ? `Showing ${pagination.total} completed case${pagination.total === 1 ? '' : 's'}`
                  : 'No completed cases found'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <CompletedCaseTable
            cases={cases}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.total > 0 && (
        <CasePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
